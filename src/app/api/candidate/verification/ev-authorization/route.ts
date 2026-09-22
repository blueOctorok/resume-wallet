import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import {
  EV_DISC_AUTH_VERSION,
  EV_DRIVER_AUTHORIZATION,
} from '@/lib/ev-consent-documents'
import { getRequestMeta, hashEvDocument } from '@/lib/ev-share'

/**
 * POST /api/candidate/verification/ev-authorization
 *
 * Creates the PDF-1 artifact (PROVVEN-EV-DISC-AUTH-B-0.1): the driver has
 * viewed the standalone Disclosure and checked the Authorization box. Outbound
 * EV routing (initiate-self) hard-gates on the returned id.
 *
 * Body: {
 *   signedName: string            — typed signature from the auth paper
 *   disclosureViewedAt: string    — ISO timestamp Screen A was fully viewed
 *   employerTargets: { companyName, email?, phone? }[]
 *   checkboxEventId?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const { signedName, disclosureViewedAt, employerTargets, checkboxEventId } = body as {
      signedName?: string
      disclosureViewedAt?: string
      employerTargets?: { companyName?: string; email?: string; phone?: string }[]
      checkboxEventId?: string
    }

    if (!signedName?.trim()) {
      return NextResponse.json({ error: 'Signed name is required' }, { status: 400 })
    }
    if (!disclosureViewedAt || Number.isNaN(new Date(disclosureViewedAt).getTime())) {
      return NextResponse.json(
        { error: 'The disclosure must be viewed before authorizing' },
        { status: 400 },
      )
    }
    if (!Array.isArray(employerTargets) || employerTargets.length === 0) {
      return NextResponse.json(
        { error: 'At least one prior employer target is required' },
        { status: 400 },
      )
    }

    const supabase = await getAdminSupabaseClient()
    const { ipAddress, userAgent } = getRequestMeta(request)

    const { data: authorization, error: insertError } = await supabase
      .from('ev_authorizations')
      .insert({
        driver_user_id: userId,
        document_version: EV_DISC_AUTH_VERSION,
        document_sha256: hashEvDocument(EV_DRIVER_AUTHORIZATION),
        signed_name: signedName.trim(),
        disclosure_viewed_at: disclosureViewedAt,
        employer_targets: employerTargets,
        ip_address: ipAddress,
        user_agent: userAgent,
        checkbox_event_id: checkboxEventId ?? null,
      })
      .select('id, document_version, authorized_at')
      .single()

    if (insertError) {
      console.error('[EV AUTHORIZATION] Insert error:', insertError.code, insertError.message)
      if (insertError.code === '42P01') {
        return NextResponse.json(
          { error: 'EV consent tables not set up. Run migration 110.' },
          { status: 503 },
        )
      }
      return NextResponse.json({ error: 'Failed to record authorization' }, { status: 500 })
    }

    console.log(`[EV AUTHORIZATION] Recorded ${authorization.id} for driver ${userId}`)
    return NextResponse.json({ success: true, evAuthorizationId: authorization.id })
  } catch (error) {
    console.error('[EV AUTHORIZATION] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
