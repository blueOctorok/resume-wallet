import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import {
  companyCanRequestEvShare,
  getEmployerCompanyAccess,
} from '@/lib/employer-company-access'
import { createNotification } from '@/lib/create-notification'
import { sendCandidateRequestNotification } from '@/lib/send-admin-notification'
import {
  EV_EMP_SHARE_REQ_VERSION,
  EV_EMPLOYER_SHARE_REQUEST,
} from '@/lib/ev-consent-documents'
import { getRequestMeta, hashEvDocument } from '@/lib/ev-share'
import { companyHasCurrentEmployerTerms } from '@/lib/company-terms'

/**
 * POST /api/employer/ev/share-requests
 *
 * Records the employer per-request clickwrap artifact
 * (PROVVEN-EV-EMP-SHARE-REQ-0.1) and opens a PENDING driver-authorization
 * state. Product rule from the draft: creating this artifact must NOT unlock
 * any EV view endpoint — view requires a non-revoked driver Step 6 grant.
 *
 * Body: { driverUserId, applicationContext, checkboxEventId? }
 * v0.1: payload_type is forced to 'proof' (full EV disabled by product config).
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const { driverUserId, applicationContext, checkboxEventId } = body as {
      driverUserId?: string
      applicationContext?: string
      checkboxEventId?: string
    }

    if (!driverUserId) {
      return NextResponse.json({ error: 'driverUserId is required' }, { status: 400 })
    }
    // The clickwrap certifies a current hiring-related need tied to a named
    // driver — a concrete application / role context is mandatory.
    if (!applicationContext?.trim()) {
      return NextResponse.json(
        { error: 'An application or hiring context is required' },
        { status: 400 },
      )
    }

    const supabase = await getAdminSupabaseClient()

    const access = await getEmployerCompanyAccess(supabase, userId)
    if (!access) {
      return NextResponse.json({ error: 'No company access' }, { status: 403 })
    }
    if (!(await companyCanRequestEvShare(supabase, access.companyId))) {
      return NextResponse.json(
        { error: 'Install the Employment verification share requests block first' },
        { status: 403 },
      )
    }
    if (!(await companyHasCurrentEmployerTerms(supabase, access.companyId))) {
      return NextResponse.json(
        { error: 'Your company must accept the current employer terms before requesting an Employment Verification share' },
        { status: 403 },
      )
    }

    const { data: driver } = await supabase
      .from('users')
      .select('id, role, email')
      .eq('id', driverUserId)
      .maybeSingle()
    if (!driver) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
    }
    if (driver.role === 'employer') {
      return NextResponse.json(
        { error: 'Cannot request EV share from an employer account' },
        { status: 400 },
      )
    }

    // One open request per company + driver — no reminder-fatigue re-asks.
    const { data: existing } = await supabase
      .from('ev_share_requests')
      .select('id, status')
      .eq('company_id', access.companyId)
      .eq('driver_user_id', driverUserId)
      .eq('status', 'pending')
      .maybeSingle()
    if (existing) {
      return NextResponse.json(
        { error: 'A share request is already pending for this driver', shareRequestId: existing.id },
        { status: 409 },
      )
    }

    const { data: company } = await supabase
      .from('companies')
      .select('company_name')
      .eq('id', access.companyId)
      .single()
    const companyName = company?.company_name || 'Your company'

    const { data: driverProfile } = await supabase
      .from('user_profiles')
      .select('first_name, last_name, email')
      .eq('user_id', driverUserId)
      .maybeSingle()
    const driverName =
      [driverProfile?.first_name, driverProfile?.last_name].filter(Boolean).join(' ') || 'the driver'

    const { ipAddress, userAgent } = getRequestMeta(request)

    // Snapshot hash of the clickwrap exactly as shown (dynamic fields filled).
    const documentSha256 = hashEvDocument(EV_EMPLOYER_SHARE_REQUEST, {
      driverName,
      employerLegalName: companyName,
      applicationContext: applicationContext.trim(),
    })

    const { data: shareRequest, error: insertError } = await supabase
      .from('ev_share_requests')
      .insert({
        company_id: access.companyId,
        requesting_user_id: userId,
        driver_user_id: driverUserId,
        application_context: applicationContext.trim(),
        payload_type: 'proof',
        document_version: EV_EMP_SHARE_REQ_VERSION,
        document_sha256: documentSha256,
        ip_address: ipAddress,
        user_agent: userAgent,
        checkbox_event_id: checkboxEventId ?? null,
      })
      .select('id, status, created_at')
      .single()

    if (insertError) {
      console.error('[EV SHARE REQUEST] Insert error:', insertError.code, insertError.message)
      if (insertError.code === '42P01') {
        return NextResponse.json(
          { error: 'EV consent tables not set up. Run migration 110.' },
          { status: 503 },
        )
      }
      return NextResponse.json({ error: 'Failed to create share request' }, { status: 500 })
    }

    await createNotification({
      userId: driverUserId,
      type: 'ev_share_request',
      title: `${companyName} requests your employment verification`,
      body: `${companyName} asked to view your Employment Verification material for: ${applicationContext.trim()}. Nothing is shared unless you authorize it — you can also decline.`,
      actionUrl: '/?onboard=employment-verification',
      data: { shareRequestId: shareRequest.id, companyName },
    })

    const driverEmail = driver.email || driverProfile?.email || null
    if (driverEmail) {
      await sendCandidateRequestNotification({
        candidateEmail: driverEmail,
        candidateName: driverName,
        companyName,
        requestType: 'ev_share',
      })
    }

    console.log(
      `[EV SHARE REQUEST] ${shareRequest.id} pending — company ${access.companyId} → driver ${driverUserId}`,
    )
    return NextResponse.json({ success: true, shareRequest })
  } catch (error) {
    console.error('[EV SHARE REQUEST] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET /api/employer/ev/share-requests?driverUserId=...
 *
 * Status for the employer UX copy (pending / declined / authorized / revoked).
 * Never returns EV content — that is the view endpoint, gated on the grant.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()
    const access = await getEmployerCompanyAccess(supabase, userId)
    if (!access) {
      return NextResponse.json({ error: 'No company access' }, { status: 403 })
    }

    const driverUserId = request.nextUrl.searchParams.get('driverUserId')
    let query = supabase
      .from('ev_share_requests')
      .select('id, driver_user_id, application_context, payload_type, status, certified_at, created_at')
      .eq('company_id', access.companyId)
      .order('created_at', { ascending: false })
    if (driverUserId) query = query.eq('driver_user_id', driverUserId)

    const { data, error } = await query
    if (error) {
      console.error('[EV SHARE REQUEST] List error:', error.message)
      return NextResponse.json({ error: 'Failed to load share requests' }, { status: 500 })
    }

    // The clickwrap must display the employer legal name — return it here so
    // the UI has it without a second fetch.
    const { data: company } = await supabase
      .from('companies')
      .select('company_name')
      .eq('id', access.companyId)
      .single()

    const canRequest = await companyCanRequestEvShare(supabase, access.companyId)

    return NextResponse.json({
      shareRequests: data ?? [],
      companyName: company?.company_name ?? null,
      canRequestEvShare: canRequest,
    })
  } catch (error) {
    console.error('[EV SHARE REQUEST] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
