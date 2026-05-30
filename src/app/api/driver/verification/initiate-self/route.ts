import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import {
  VerificationRequestRow,
  rowToVerificationRequest,
} from '@/types/employment-verification'
import { sendVerificationEmail } from '@/lib/send-verification-email'
import { getAppBaseUrl } from '@/lib/app-url'
import { getDriverEmployment } from '@/lib/block-data'
import { getStormUserIdFromRequest } from '@/lib/auth-session'

/** Normalize date string to PostgreSQL DATE (YYYY-MM-DD). Returns null for empty/unparseable. */
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
 * POST /api/driver/verification/initiate-self
 *
 * Driver-only: driver initiates employment verification from their own
 * employment history (from block_driver_employment, populated by DOT forms / resume prefill).
 * No developer or DOT form data is used in this route.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const { employmentId, previousEmployerEmail, previousEmployerPhone } = body

    if (!employmentId) {
      return NextResponse.json(
        { error: 'employmentId is required' },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    const employmentHistory = await getDriverEmployment(supabase, userId)

    if (employmentHistory.length === 0) {
      return NextResponse.json(
        { error: 'Driver profile not found. Complete your DOT application or add a resume first.' },
        { status: 404 }
      )
    }

    const employment = employmentHistory.find((e) => e.id === employmentId)

    if (!employment) {
      return NextResponse.json(
        { error: 'Employment entry not found in your profile' },
        { status: 404 }
      )
    }

    const contactEmail = previousEmployerEmail ?? employment.supervisorEmail ?? null
    const contactPhone = previousEmployerPhone ?? employment.supervisorPhone ?? null

    if (!contactEmail && !contactPhone) {
      return NextResponse.json(
        {
          error: 'No contact information for previous employer. Please provide an email or phone number.',
          needsContactInfo: true,
        },
        { status: 400 }
      )
    }

    // DB expects DATE (YYYY-MM-DD). Normalize from profile/DOT format.
    const claimedStartDate = toDateOnly(employment.startDate)
    if (!claimedStartDate) {
      return NextResponse.json(
        {
          error: 'Start date for this employment is missing or invalid. Please add a valid start date in your DOT application or profile.',
        },
        { status: 400 }
      )
    }
    const claimedEndDate = toDateOnly(employment.endDate)

    const { data: existingRequest } = await supabase
      .from('employment_verification_requests')
      .select('id, status')
      .eq('driver_id', userId)
      .eq('employment_id', employmentId)
      .eq('initiated_by', 'applicant')
      .eq('applicant_type', 'driver')
      .not('status', 'in', '("ATTEMPTS_EXHAUSTED","VERIFICATION_DENIED","VERIFICATION_DECLINED")')
      .maybeSingle()

    if (existingRequest) {
      return NextResponse.json(
        {
          error: 'You already have a verification in progress for this employment',
          existingRequestId: existingRequest.id,
          status: existingRequest.status,
        },
        { status: 409 }
      )
    }

    const insertData = {
      driver_id: userId,
      employment_id: employmentId,
      requesting_company_id: null,
      initiated_by: 'applicant',
      applicant_type: 'driver',
      previous_employer_name: employment.companyName,
      previous_employer_email: contactEmail,
      previous_employer_phone: contactPhone,
      previous_employer_address: employment.location ?? null,
      claimed_position: employment.position,
      claimed_start_date: claimedStartDate,
      claimed_end_date: claimedEndDate,
      claimed_reason_for_leaving: employment.reasonForLeaving ?? null,
      status: 'VERIFICATION_REQUESTED',
      attempt_count: 0,
      next_attempt_at: new Date().toISOString(),
    }

    const { data: newRequest, error: insertError } = await supabase
      .from('employment_verification_requests')
      .insert(insertData)
      .select()
      .single()

    if (insertError) {
      console.error('[DRIVER VERIFICATION] Create error:', insertError)
      if (insertError.code === '42703' || insertError.message?.includes('column')) {
        return NextResponse.json(
          { error: 'Verification system needs update. Run migration 015.' },
          { status: 503 }
        )
      }
      if (insertError.code === '42P01' || insertError.message?.includes('does not exist')) {
        return NextResponse.json(
          { error: 'Verification system not set up. Run database migration.' },
          { status: 503 }
        )
      }
      return NextResponse.json(
        { error: 'Failed to create verification request' },
        { status: 500 }
      )
    }

    const verificationRequest = rowToVerificationRequest(
      newRequest as VerificationRequestRow,
      'Self-Initiated'
    )

    // Send email to previous employer if we have an address (non-blocking)
    const token = (newRequest as { verification_token?: string }).verification_token
    if (contactEmail && token) {
      const verificationLink = `${getAppBaseUrl(request)}/verify/${token}`
      const emailResult = await sendVerificationEmail({
        to: contactEmail,
        verificationLink,
        previousEmployerName: employment.companyName ?? '',
        claimedPosition: employment.position ?? '',
        claimedCompanyName: employment.companyName ?? '',
        claimedStartDate: employment.startDate ?? undefined,
        claimedEndDate: employment.endDate ?? null,
      })
      if (!emailResult.ok) {
        console.warn('[DRIVER VERIFICATION] Email send failed:', emailResult.error)
      }
    }

    return NextResponse.json({
      success: true,
      verificationRequest,
      message: `Verification request created for ${employment.companyName}. We'll reach out to verify your employment.`,
    })
  } catch (error) {
    console.error('[DRIVER VERIFICATION] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
