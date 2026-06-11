/**
 * GET /api/mvr/[orderId]/pdf?sessionUserId=...&employerCandidateUserId=...
 *
 * Streams a Storm-branded MVR PDF for the given order.
 *
 * Auth mirrors `/api/mvr/status/[orderId]`:
 *   - Candidate: wallet must own `mvr_orders.driver_user_id`
 *   - Employer:  pass `employerCandidateUserId`; wallet must belong to a user
 *                in the same company that paid (`ordered_by_company_id`).
 *
 * Force Node runtime — @react-pdf/renderer uses Node-only APIs (Buffer, fs,
 * canvas font cache) and won't run on the Edge runtime.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import React from 'react'

import { resolveEmployerCompanyForWallet } from '@/lib/employer-talent-auth'
import { parseAccioMvrResult } from '@/lib/accio-xml-parser'
import { MvrReportPdf } from '@/lib/pdf/MvrReportPdf'
import type { ScreeningOutcome } from '@/lib/accio-result-status'
import { getStormUserIdFromRequest } from '@/lib/auth-session'

export const runtime = 'nodejs'
// Reports rarely change once filled, but cache headers are a downstream call.
export const dynamic = 'force-dynamic'

interface MvrOrderRow {
  id: string
  driver_user_id: string
  status: string
  result_outcome: string | null
  result_xml: string | null
  ordered_by_company_id: string | null
  completed_at: string | null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const { orderId } = await params
    const { searchParams } = new URL(request.url)
    const sessionUserId = await getStormUserIdFromRequest(request)
    const employerCandidateUserId = searchParams.get('employerCandidateUserId')
    // `inline` for modal iframe preview; default `attachment` for Download button.
    const disposition =
      searchParams.get('disposition') === 'inline' ? 'inline' : 'attachment'

    if (!sessionUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    let mvrOrder: MvrOrderRow | null = null
    let candidateName = 'Driver'

    if (employerCandidateUserId) {
      const ctx = await resolveEmployerCompanyForWallet(supabase, sessionUserId)
      if (!ctx) {
        return NextResponse.json({ error: 'No company access' }, { status: 403 })
      }

      const { data, error } = await supabase
        .from('mvr_orders')
        .select('id, driver_user_id, status, result_outcome, result_xml, ordered_by_company_id, completed_at')
        .eq('id', orderId)
        .eq('driver_user_id', employerCandidateUserId)
        .eq('ordered_by_company_id', ctx.companyId)
        .single()

      if (error || !data) {
        return NextResponse.json({ error: 'MVR order not found' }, { status: 404 })
      }
      mvrOrder = data as MvrOrderRow
    } else {
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('id', sessionUserId)
        .single()

      if (userError || !user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      const { data, error } = await supabase
        .from('mvr_orders')
        .select('id, driver_user_id, status, result_outcome, result_xml, ordered_by_company_id, completed_at')
        .eq('id', orderId)
        .eq('driver_user_id', user.id)
        .single()

      if (error || !data) {
        return NextResponse.json({ error: 'MVR order not found' }, { status: 404 })
      }
      mvrOrder = data as MvrOrderRow
    }

    if (!mvrOrder.result_xml) {
      return NextResponse.json(
        { error: 'Report not yet available — order is still processing' },
        { status: 409 },
      )
    }

    // Pull a friendly display name from user_profiles (best-effort; the parsed
    // XML subject is preferred when present, but we want a fallback for the
    // file metadata even if parsing returns no subject block).
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('first_name, last_name, phone')
      .eq('user_id', mvrOrder.driver_user_id)
      .maybeSingle()
    if (profile) {
      candidateName =
        [profile.first_name, profile.last_name].filter(Boolean).join(' ') ||
        candidateName
    }

    const parsed = parseAccioMvrResult(mvrOrder.result_xml)

    // MvrReportPdf composes <StormPdfDocument> at the root, which renders to
    // react-pdf's <Document>. The outer prop type isn't DocumentProps (it's
    // our component's props), so cast through unknown to satisfy renderToBuffer.
    const element = React.createElement(MvrReportPdf, {
      parsed,
      meta: {
        stormOrderId: mvrOrder.id,
        candidateName,
        generatedAtIso: new Date().toISOString(),
        outcome: (mvrOrder.result_outcome as ScreeningOutcome) ?? null,
        profilePhone: profile?.phone ?? null,
      },
    }) as unknown as React.ReactElement<DocumentProps>
    const buffer = await renderToBuffer(element)

    const filename = `storm-mvr-${mvrOrder.id.slice(0, 8)}.pdf`
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${disposition}; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[MVR PDF] Error:', error)
    return NextResponse.json({ error: 'Failed to render report', details: message }, { status: 500 })
  }
}
