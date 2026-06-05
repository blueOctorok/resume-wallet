/**
 * GET /api/psp/[orderId]/pdf?sessionUserId=...&employerCandidateUserId=...
 *
 * Streams a Storm-branded FMCSA PSP PDF for the given order. Mirrors the auth
 * & runtime shape of `/api/mvr/[orderId]/pdf`.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import React from 'react'

import { resolveEmployerCompanyForWallet } from '@/lib/employer-talent-auth'
import { parsePspResult } from '@/lib/accio-psp-parser'
import { PspReportPdf } from '@/lib/pdf/PspReportPdf'
import type { ScreeningOutcome } from '@/lib/accio-result-status'
import { getStormUserIdFromRequest } from '@/lib/auth-session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface PspOrderRow {
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

    if (!sessionUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    let pspOrder: PspOrderRow | null = null
    let candidateName = 'Driver'

    if (employerCandidateUserId) {
      const ctx = await resolveEmployerCompanyForWallet(supabase, sessionUserId)
      if (!ctx) {
        return NextResponse.json({ error: 'No company access' }, { status: 403 })
      }

      const { data, error } = await supabase
        .from('psp_orders')
        .select('id, driver_user_id, status, result_outcome, result_xml, ordered_by_company_id, completed_at')
        .eq('id', orderId)
        .eq('driver_user_id', employerCandidateUserId)
        .eq('ordered_by_company_id', ctx.companyId)
        .single()

      if (error || !data) {
        return NextResponse.json({ error: 'PSP order not found' }, { status: 404 })
      }
      pspOrder = data as PspOrderRow
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
        .from('psp_orders')
        .select('id, driver_user_id, status, result_outcome, result_xml, ordered_by_company_id, completed_at')
        .eq('id', orderId)
        .eq('driver_user_id', user.id)
        .single()

      if (error || !data) {
        return NextResponse.json({ error: 'PSP order not found' }, { status: 404 })
      }
      pspOrder = data as PspOrderRow
    }

    if (!pspOrder.result_xml) {
      return NextResponse.json(
        { error: 'Report not yet available — order is still processing' },
        { status: 409 },
      )
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('first_name, last_name')
      .eq('user_id', pspOrder.driver_user_id)
      .maybeSingle()
    if (profile) {
      candidateName =
        [profile.first_name, profile.last_name].filter(Boolean).join(' ') ||
        candidateName
    }

    const parsed = parsePspResult(pspOrder.result_xml)

    // PspReportPdf composes <StormPdfDocument> (a <Document>) at the root —
    // cast through unknown so renderToBuffer's strict DocumentProps signature
    // accepts our component-prop element. See same pattern in the MVR pdf route.
    const element = React.createElement(PspReportPdf, {
      parsed,
      meta: {
        stormOrderId: pspOrder.id,
        candidateName,
        generatedAtIso: new Date().toISOString(),
        outcome: (pspOrder.result_outcome as ScreeningOutcome) ?? null,
      },
    }) as unknown as React.ReactElement<DocumentProps>
    const buffer = await renderToBuffer(element)

    const filename = `storm-psp-${pspOrder.id.slice(0, 8)}.pdf`
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[PSP PDF] Error:', error)
    return NextResponse.json({ error: 'Failed to render report', details: message }, { status: 500 })
  }
}
