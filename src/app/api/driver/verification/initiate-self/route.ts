import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import {
  VerificationRequestRow,
  rowToVerificationRequest,
} from '@/types/employment-verification'
import { sendVerificationEmail } from '@/lib/send-verification-email'

/**
 * POST /api/driver/verification/initiate-self
 *
 * Driver-only: driver initiates employment verification from their own
 * employment history (from driver_profiles, populated by DOT forms / resume prefill).
 * No developer or DOT form data is used in this route.
 */
export async function POST(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address required' },
        { status: 401 }
      )
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

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .ilike('wallet_address', walletAddress)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { data: driverProfile, error: driverError } = await supabase
      .from('driver_profiles')
      .select('employment_history')
      .eq('user_id', user.id)
      .single()

    if (driverError || !driverProfile) {
      return NextResponse.json(
        { error: 'Driver profile not found. Complete your DOT application or add a resume first.' },
        { status: 404 }
      )
    }

    const employmentHistory = driverProfile.employment_history || []
    const employment = employmentHistory.find((e: { id: string }) => e.id === employmentId)

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

    const { data: existingRequest } = await supabase
      .from('employment_verification_requests')
      .select('id, status')
      .eq('driver_id', user.id)
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
      driver_id: user.id,
      employment_id: employmentId,
      requesting_company_id: null,
      initiated_by: 'applicant',
      applicant_type: 'driver',
      previous_employer_name: employment.companyName,
      previous_employer_email: contactEmail,
      previous_employer_phone: contactPhone,
      previous_employer_address: employment.location ?? null,
      claimed_position: employment.position,
      claimed_start_date: employment.startDate,
      claimed_end_date: employment.endDate ?? null,
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
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
      const verificationLink = `${baseUrl}/verify/${token}`
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
