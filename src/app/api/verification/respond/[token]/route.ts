import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { 
  VerificationRequestRow, 
  rowToVerificationRequest,
  VerificationAnswers,
  VerificationStatus
} from '@/types/employment-verification'

/**
 * GET /api/verification/respond/[token]
 * 
 * Get verification request details for previous employer to respond.
 * No authentication required - token is the auth.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    if (!token) {
      return NextResponse.json(
        { error: 'Verification token required' },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    // Get the verification request by token
    const { data: request_data, error } = await supabase
      .from('employment_verification_requests')
      .select(`
        *,
        companies:requesting_company_id (
          company_name
        )
      `)
      .eq('verification_token', token)
      .single()

    if (error || !request_data) {
      console.error('Verification request not found:', error)
      return NextResponse.json(
        { error: 'Invalid or expired verification token' },
        { status: 404 }
      )
    }

    // Check if token is expired
    if (new Date(request_data.token_expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Verification token has expired' },
        { status: 410 }
      )
    }

    // Check if already responded
    if (['VERIFIED', 'PARTIALLY_VERIFIED', 'VERIFICATION_DENIED', 'VERIFICATION_DECLINED'].includes(request_data.status)) {
      return NextResponse.json(
        { 
          error: 'This verification has already been completed',
          status: request_data.status,
          verifiedAt: request_data.verified_at
        },
        { status: 409 }
      )
    }

    const applicantType = (request_data.applicant_type as string) || 'driver'
    const requestingCompanyName =
      (request_data.companies as { company_name?: string } | null)?.company_name ||
      (request_data.initiated_by === 'applicant' ? 'The applicant (self-requested)' : 'Unknown Company')

    let applicantName = 'Unknown Applicant'
    const { data: applicantProfile } = await supabase
      .from('user_profiles')
      .select('first_name, last_name')
      .eq('user_id', request_data.driver_id)
      .maybeSingle()
    if (applicantProfile) {
      applicantName = [applicantProfile.first_name, applicantProfile.last_name].filter(Boolean).join(' ') || 'Unknown Applicant'
    }

    const verificationRequest = rowToVerificationRequest(
      request_data as VerificationRequestRow,
      requestingCompanyName
    )

    // Don't expose the token in the response
    delete verificationRequest.verificationToken

    return NextResponse.json({
      success: true,
      verificationRequest,
      applicantType,
      applicantName,
      driverName: applicantName, // legacy key for backward compatibility
      requestingCompanyName,
    })

  } catch (error) {
    console.error('Error fetching verification request:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/verification/respond/[token]
 * 
 * Previous employer submits their verification response.
 * No authentication required - token is the auth.
 * 
 * Required:
 * - verifierEmail: Email of person responding
 * - verifierName: Name of person responding
 * - verifierTitle: Title of person responding
 * - action: 'verify' | 'deny' | 'decline'
 * - answers: The 6 FMCSA verification answers
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    if (!token) {
      return NextResponse.json(
        { error: 'Verification token required' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { 
      verifierEmail, 
      verifierName, 
      verifierTitle, 
      action, 
      answers 
    } = body as {
      verifierEmail: string
      verifierName: string
      verifierTitle: string
      action: 'verify' | 'deny' | 'decline'
      answers: VerificationAnswers
    }

    // Validate required fields
    if (!verifierEmail || !verifierName || !action) {
      return NextResponse.json(
        { error: 'verifierEmail, verifierName, and action are required' },
        { status: 400 }
      )
    }

    if (!['verify', 'deny', 'decline'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be verify, deny, or decline' },
        { status: 400 }
      )
    }

    // For verify/deny, answers are required
    if (action !== 'decline' && !answers) {
      return NextResponse.json(
        { error: 'answers are required for verify/deny actions' },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    // Get the verification request by token
    const { data: request_data, error: fetchError } = await supabase
      .from('employment_verification_requests')
      .select('*')
      .eq('verification_token', token)
      .single()

    if (fetchError || !request_data) {
      return NextResponse.json(
        { error: 'Invalid verification token' },
        { status: 404 }
      )
    }

    const applicantType = (request_data.applicant_type as string) || 'driver'

    // Check if token is expired
    if (new Date(request_data.token_expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Verification token has expired' },
        { status: 410 }
      )
    }

    // Check if already responded
    if (['VERIFIED', 'PARTIALLY_VERIFIED', 'VERIFICATION_DENIED', 'VERIFICATION_DECLINED'].includes(request_data.status)) {
      return NextResponse.json(
        { 
          error: 'This verification has already been completed',
          status: request_data.status
        },
        { status: 409 }
      )
    }

    // For verify/deny, validate required answers by applicant type (driver = 6 FMCSA questions, developer = 3)
    if (action !== 'decline' && answers) {
      const hasDates = answers.datesCorrect != null
      const hasTerminated = answers.wasTerminated != null
      const hasEligible = answers.eligibleToReturn != null
      if (!hasDates || !hasTerminated || !hasEligible) {
        return NextResponse.json(
          { error: 'Please answer all required verification questions (dates, termination, eligible to return).' },
          { status: 400 }
        )
      }
      if (applicantType === 'driver') {
        const hasAccident = answers.hadAccident != null
        const hasClearinghouse = answers.failedClearinghouseTest != null
        const hasDrugTest = answers.randomDrugTestOrRefused != null
        if (!hasAccident || !hasClearinghouse || !hasDrugTest) {
          return NextResponse.json(
            { error: 'Please answer all verification questions (including accident and drug test questions).' },
            { status: 400 }
          )
        }
      }
    }

    // Determine final status
    let newStatus: VerificationStatus
    if (action === 'decline') {
      newStatus = 'VERIFICATION_DECLINED'
    } else if (action === 'deny') {
      newStatus = 'VERIFICATION_DENIED'
    } else {
      // verify - check if partial
      newStatus = answers?.datesCorrect === 'partial' ? 'PARTIALLY_VERIFIED' : 'VERIFIED'
    }

    // Build update data
    const updateData: Record<string, unknown> = {
      status: newStatus,
      verified_at: new Date().toISOString(),
      verified_by_email: verifierEmail,
      verified_by_name: verifierName,
      verified_by_title: verifierTitle || null,
      verification_method: 'portal',
      finalized_at: new Date().toISOString(),
      next_attempt_at: null,
    }

    // Add answers if provided
    if (answers) {
      updateData.dates_correct = answers.datesCorrect
      updateData.corrected_start_date = answers.correctedStartDate || null
      updateData.corrected_end_date = answers.correctedEndDate || null
      updateData.was_terminated = answers.wasTerminated
      updateData.termination_reason = answers.terminationReason || null
      updateData.eligible_to_return = answers.eligibleToReturn
      updateData.return_notes = answers.returnNotes || null
      updateData.had_accident = answers.hadAccident
      updateData.accident_details = answers.accidentDetails || null
      updateData.failed_clearinghouse_test = answers.failedClearinghouseTest
      updateData.clearinghouse_notes = answers.clearinghouseNotes || null
      updateData.random_drug_test_or_refused = answers.randomDrugTestOrRefused
      updateData.drug_test_details = answers.drugTestDetails || null
      updateData.additional_notes = answers.additionalNotes || null
    }

    // Update the verification request
    const { error: updateError } = await supabase
      .from('employment_verification_requests')
      .update(updateData)
      .eq('id', request_data.id)

    if (updateError) {
      console.error('Error updating verification:', updateError)
      return NextResponse.json(
        { error: 'Failed to submit verification response' },
        { status: 500 }
      )
    }

    // Mark the last attempt as responded (if any attempts exist)
    if (request_data.attempt_count > 0) {
      await supabase
        .from('verification_attempts')
        .update({
          response_received: true,
          responded_at: new Date().toISOString(),
        })
        .eq('verification_request_id', request_data.id)
        .eq('attempt_number', request_data.attempt_count)
    }

    console.log('✅ Verification response submitted:', {
      requestId: request_data.id,
      status: newStatus,
      verifier: verifierEmail,
    })

    return NextResponse.json({
      success: true,
      status: newStatus,
      message: action === 'decline' 
        ? 'Thank you. You have declined to verify this employment.'
        : action === 'deny'
        ? 'Thank you for your response. The verification has been marked as denied.'
        : 'Thank you! The employment has been verified successfully.',
    })

  } catch (error) {
    console.error('Error submitting verification response:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
