/**
 * GET /api/mvr/[orderId]/pdf?sessionUserId=...&employerCandidateUserId=...
 *
 * Streams a Storm-branded MVR PDF for the given order.
 *
 * Auth mirrors `/api/mvr/status/[orderId]`:
 *   - Candidate: wallet must own `mvr_orders.driver_user_id`
 *   - Employer:  pass `employerCandidateUserId`; company-paid OR consenting-company
 *                driver-owned pre-screen (P3.4-C).
 *
 * Force Node runtime — @react-pdf/renderer uses Node-only APIs (Buffer, fs,
 * canvas font cache) and won't run on the Edge runtime.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import React from 'react'

import { resolveEmployerCompanyForWallet } from '@/lib/employer-talent-auth'
import { fetchEmployerAccessibleMvrOrder } from '@/lib/employer-screening-order-access'
import { parseAccioMvrResult } from '@/lib/accio-xml-parser'
import { MvrReportPdf } from '@/lib/pdf/MvrReportPdf'
import type { MvrReportParty } from '@/lib/pdf/MvrReportFcraCover'
import type { ScreeningOutcome } from '@/lib/accio-result-status'
import { getStormUserIdFromRequest } from '@/lib/auth-session'

export const runtime = 'nodejs'
// Reports rarely change once filled, but cache headers are a downstream call.
export const dynamic = 'force-dynamic'

const MVR_ORDER_COLUMNS =
  'id, driver_user_id, status, result_outcome, result_xml, ordered_by_company_id, ordered_by_user_id, completed_at'

interface MvrOrderRow {
  id: string
  driver_user_id: string
  status: string
  result_outcome: string | null
  result_xml: string | null
  ordered_by_company_id: string | null
  ordered_by_user_id: string | null
  completed_at: string | null
}

interface ProfileRow {
  first_name: string | null
  last_name: string | null
  email: string | null
}

interface CompanyRow {
  company_name: string | null
  address_street: string | null
  address_city: string | null
  address_state: string | null
  address_zip: string | null
  phone: string | null
}

/**
 * "Prepared for" = the party the consumer report was furnished to. For an
 * employer order that's the company; for a candidate self-order it's the
 * candidate (they own the report and may later share it — P3.4-C).
 */
async function resolvePreparedFor(
  supabase: SupabaseClient,
  order: MvrOrderRow,
  candidateName: string,
): Promise<MvrReportParty> {
  if (order.ordered_by_company_id) {
    const { data } = await supabase
      .from('companies')
      .select('company_name, address_street, address_city, address_state, address_zip, phone')
      .eq('id', order.ordered_by_company_id)
      .maybeSingle()
    const company = data as CompanyRow | null
    if (company?.company_name) {
      const cityLine = [company.address_city, company.address_state].filter(Boolean).join(', ')
      return {
        name: company.company_name,
        addressLines: [
          company.address_street ?? '',
          [cityLine, company.address_zip].filter(Boolean).join(' '),
        ].filter(Boolean),
        phone: company.phone,
      }
    }
  }
  return { name: candidateName, addressLines: ['Candidate-initiated report'] }
}

async function resolveRequestedBy(
  supabase: SupabaseClient,
  order: MvrOrderRow,
): Promise<MvrReportParty | null> {
  if (!order.ordered_by_user_id || order.ordered_by_user_id === order.driver_user_id) return null
  const { data } = await supabase
    .from('user_profiles')
    .select('first_name, last_name, email')
    .eq('user_id', order.ordered_by_user_id)
    .maybeSingle()
  const profile = data as ProfileRow | null
  const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
  if (!name && !profile?.email) return null
  return { name: name || 'Employer user', email: profile?.email ?? null }
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

      const { data, error } = await fetchEmployerAccessibleMvrOrder(supabase, MVR_ORDER_COLUMNS, {
        companyId: ctx.companyId,
        candidateUserId: employerCandidateUserId,
        orderId,
      })

      if (error || !data) {
        return NextResponse.json({ error: 'MVR order not found' }, { status: 404 })
      }
      // Helper returns an untyped row; the select above pins the shape.
      mvrOrder = data as unknown as MvrOrderRow
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
        .select(MVR_ORDER_COLUMNS)
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
    const [preparedFor, requestedBy] = await Promise.all([
      resolvePreparedFor(supabase, mvrOrder, candidateName),
      resolveRequestedBy(supabase, mvrOrder),
    ])

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
        preparedFor,
        requestedBy,
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
