import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { getEmployerCompanyAccess } from '@/lib/employer-company-access'
import {
  buildEvProofSummary,
  getActiveGrantForShareRequest,
  logEvAccess,
} from '@/lib/ev-share'

/**
 * GET /api/employer/ev/view/[shareRequestId]
 *
 * THE hard gate (docs/EV_CONSENT_STACK.md): EV material is returned only when
 * a non-revoked driver Step 6 grant exists for this exact share request and
 * the caller's company matches. Missing artifact → 403. Never soft-fail open.
 *
 * v0.1 payload is the proof summary — employer name, confirmed dates, DKIM
 * status, response date. The six FMCSA answers are 'full' payload and are not
 * served even if requested.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shareRequestId: string }> },
) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    const { shareRequestId } = await params

    const supabase = await getAdminSupabaseClient()
    const access = await getEmployerCompanyAccess(supabase, userId)
    if (!access) {
      return NextResponse.json({ error: 'No company access' }, { status: 403 })
    }

    const grant = await getActiveGrantForShareRequest(supabase, shareRequestId, access.companyId)
    if (!grant) {
      // Pending, declined, revoked, or someone else's request — same 403.
      return NextResponse.json(
        { error: 'The driver has not authorized sharing this material' },
        { status: 403 },
      )
    }

    const evRequestIds = Array.isArray(grant.ev_request_ids) ? grant.ev_request_ids : []
    if (evRequestIds.length === 0) {
      return NextResponse.json({ proofSummary: [] })
    }

    const { data: rows, error } = await supabase
      .from('employment_verification_requests')
      .select(
        'id, previous_employer_name, claimed_position, claimed_start_date, claimed_end_date, corrected_start_date, corrected_end_date, dates_correct, dkim_valid, dkim_domain, verified_at, status',
      )
      .in('id', evRequestIds)
      .eq('driver_id', grant.driver_user_id)

    if (error) {
      console.error('[EV VIEW] Load error:', error.message)
      return NextResponse.json({ error: 'Failed to load shared material' }, { status: 500 })
    }

    await logEvAccess(supabase, grant, userId)

    return NextResponse.json({
      payloadType: 'proof',
      acknowledgedAt: grant.acknowledged_at,
      proofSummary: buildEvProofSummary(rows ?? []),
    })
  } catch (error) {
    console.error('[EV VIEW] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
