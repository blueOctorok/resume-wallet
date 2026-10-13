import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import {
  VerificationRequestRow,
  rowToVerificationRequest,
} from '@/types/employment-verification'
import { getAppBaseUrl } from '@/lib/app-url'
import { sendOutreachAttempt, type OutreachRequestRow } from '@/lib/evr-outreach'
import { researchEmployerContact } from '@/lib/evr-contact-research'
import {
  applicantTypeForSource,
  getMergedCandidateEmployments,
} from '@/lib/candidate-employment-verification'
import { EV_DISC_AUTH_VERSION } from '@/lib/ev-consent-documents'

function toDateOnly(value: string | null | undefined): string | null {
  const s = typeof value === 'string' ? value.trim() : ''
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const ym = s.match(/^(\d{4})-(\d{2})$/)
  if (ym) return `${ym[1]}-${ym[2]}-01`
  if (/^\d{4}$/.test(s)) return `${s}-01-01`
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

/**
 * POST /api/candidate/verification/initiate-self
 *
 * Optional career-card boost: email a past employer to confirm dates (voluntary for them).
 * Body: { verificationKey, evAuthorizationId, previousEmployerEmail?, previousEmployerPhone? }
 * verificationKey format: driver:id | developer:id | general:id
 *
 * HARD GATE (docs/EV_CONSENT_STACK.md): no outbound EV route without a valid
 * ev_authorizations artifact for this driver at the current document version.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const {
      verificationKey,
      previousEmployerEmail,
      previousEmployerPhone,
      previousEmployerName,
      previousEmployerAddress,
      claimedStartDate: claimedStartDateOverride,
      claimedEndDate: claimedEndDateOverride,
      correctionOf,
      needsContactResearch,
      evAuthorizationId,
    } = body as {
      verificationKey?: string
      previousEmployerEmail?: string
      previousEmployerPhone?: string
      previousEmployerName?: string
      previousEmployerAddress?: string
      claimedStartDate?: string
      claimedEndDate?: string
      correctionOf?: string
      needsContactResearch?: boolean
      evAuthorizationId?: string
    }

    if (!verificationKey || typeof verificationKey !== 'string') {
      return NextResponse.json({ error: 'verificationKey is required' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()

    // Hard gate: a valid disclosure+authorization artifact must exist before
    // Provven routes anything outbound (Track B, PROVVEN-EV-DISC-AUTH-B-0.1).
    if (!evAuthorizationId || typeof evAuthorizationId !== 'string') {
      return NextResponse.json(
        { error: 'Authorization required. Review the disclosure and authorize the request first.' },
        { status: 403 },
      )
    }
    const { data: evAuth } = await supabase
      .from('ev_authorizations')
      .select('id, driver_user_id, document_version, status')
      .eq('id', evAuthorizationId)
      .maybeSingle()
    if (
      !evAuth ||
      evAuth.driver_user_id !== userId ||
      evAuth.status !== 'active' ||
      evAuth.document_version !== EV_DISC_AUTH_VERSION
    ) {
      return NextResponse.json(
        { error: 'Authorization is missing, withdrawn, or outdated. Authorize the request again.' },
        { status: 403 },
      )
    }

    const employments = await getMergedCandidateEmployments(supabase, userId)
    const row = employments.find((e) => e.verificationKey === verificationKey)

    if (!row) {
      return NextResponse.json(
        { error: 'Employment entry not found. Add work history via resume or DOT application first.' },
        { status: 404 },
      )
    }

    const contactEmail = previousEmployerEmail ?? row.supervisorEmail ?? null
    const contactPhone = previousEmployerPhone ?? row.supervisorPhone ?? null

    // Drivers can submit a signed authorization without knowing the employer's
    // contact info. The packet is created, nothing is emailed, and contact
    // research (FMCSA + web search) runs immediately so the driver can confirm
    // a contact instead of the packet parking at attempt 0 forever.
    if (!contactEmail && !contactPhone && !needsContactResearch) {
      return NextResponse.json(
        {
          error: 'No contact information for previous employer. Please provide an email or phone number.',
          needsContactInfo: true,
        },
        { status: 400 },
      )
    }

    const employerName = previousEmployerName?.trim() || row.companyName || ''
    const employerAddress = previousEmployerAddress?.trim() || row.location || null
    const claimedStartDate = toDateOnly(claimedStartDateOverride || row.startDate)
    if (!claimedStartDate) {
      return NextResponse.json(
        {
          error: 'Start date for this employment is missing or invalid. Update the job dates on this packet.',
        },
        { status: 400 },
      )
    }
    const claimedEndDate = toDateOnly(claimedEndDateOverride || row.endDate || undefined)

    const applicantType = applicantTypeForSource(row.source)

    const { data: existingRequest } = correctionOf
      ? { data: null }
      : await supabase
          .from('employment_verification_requests')
          .select('id, status')
          .eq('driver_id', userId)
          .eq('employment_id', verificationKey)
          .eq('initiated_by', 'applicant')
          .eq('applicant_type', applicantType)
          .not(
            'status',
            'in',
            '("ATTEMPTS_EXHAUSTED","VERIFICATION_DENIED","VERIFICATION_DECLINED","DRIVER_SEND_DECLINED")',
          )
          .maybeSingle()

    if (existingRequest) {
      return NextResponse.json(
        {
          error: 'You already have a verification in progress for this employment',
          existingRequestId: existingRequest.id,
          status: existingRequest.status,
        },
        { status: 409 },
      )
    }

    const insertData = {
      driver_id: userId,
      employment_id: verificationKey,
      requesting_company_id: null,
      initiated_by: 'applicant',
      applicant_type: applicantType,
      previous_employer_name: employerName,
      previous_employer_email: contactEmail,
      previous_employer_phone: contactPhone,
      previous_employer_address: employerAddress,
      claimed_position: row.position ?? '',
      claimed_start_date: claimedStartDate,
      claimed_end_date: claimedEndDate,
      claimed_reason_for_leaving: row.reasonForLeaving ?? null,
      status: 'VERIFICATION_REQUESTED',
      attempt_count: 0,
      // No email yet → the cron must not pick it up; research gates the first send.
      next_attempt_at: contactEmail ? new Date().toISOString() : null,
      contact_research_status: contactEmail ? 'not_requested' : 'pending',
      ev_authorization_id: evAuth.id,
      ...(typeof correctionOf === 'string' && correctionOf ? { correction_of: correctionOf } : {}),
    }

    const { data: newRequest, error: insertError } = await supabase
      .from('employment_verification_requests')
      .insert(insertData)
      .select()
      .single()

    if (insertError) {
      console.error('[CANDIDATE VERIFICATION] Create error:', insertError.code, insertError.message)
      if (insertError.code === '23514' || insertError.message?.includes('check constraint')) {
        return NextResponse.json(
          { error: 'Database needs migration 063 (applicant_type general). Run Supabase migrations.' },
          { status: 503 },
        )
      }
      if (insertError.code === '42703' || insertError.message?.includes('column')) {
        return NextResponse.json(
          { error: 'Verification system needs update. Run migrations 015 and 063.' },
          { status: 503 },
        )
      }
      if (insertError.code === '42P01' || insertError.message?.includes('does not exist')) {
        return NextResponse.json(
          { error: 'Verification system not set up. Run database migration.' },
          { status: 503 },
        )
      }
      return NextResponse.json({ error: 'Failed to create verification request' }, { status: 500 })
    }

    const verificationRequest = rowToVerificationRequest(
      newRequest as VerificationRequestRow,
      'Self-Initiated',
    )

    const requestId = String((newRequest as { id: string }).id)
    if (contactEmail) {
      await sendOutreachAttempt(supabase, newRequest as OutreachRequestRow, {
        baseUrl: getAppBaseUrl(request),
        triggeredBy: 'driver',
      })
    } else {
      // Best-effort: a research failure must not fail the authorization save.
      await researchEmployerContact(supabase, requestId).catch((err) =>
        console.warn('[CANDIDATE VERIFICATION] Contact research failed:', err),
      )
    }

    return NextResponse.json({
      success: true,
      verificationRequest,
      message: contactEmail
        ? `Verification request sent for ${employerName}. We follow up automatically on day 3 and day 7 if they do not reply.`
        : `Authorization saved for ${employerName}. We looked up the carrier's contact — confirm it to send.`,
    })
  } catch (error) {
    console.error('[CANDIDATE VERIFICATION] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
