import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getAppBaseUrl } from '@/lib/app-url'
import { 
  VerificationAttemptRow,
  rowToVerificationAttempt 
} from '@/types/employment-verification'

/**
 * POST /api/verification/attempt
 * 
 * Record a new verification attempt (contact to previous employer).
 * Called when system sends email/makes phone call.
 * 
 * Required:
 * - x-wallet-address header (employer's wallet or system)
 * - requestId: UUID of the verification request
 * - method: 'email' | 'phone' | 'portal' | 'fax' | 'mail'
 * 
 * Optional:
 * - contactEmail: Email address used
 * - contactPhone: Phone number used
 * - contactPerson: Name of person contacted
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
    const { requestId, method, contactEmail, contactPhone, contactPerson } = body

    if (!requestId || !method) {
      return NextResponse.json(
        { error: 'requestId and method are required' },
        { status: 400 }
      )
    }

    if (!['email', 'phone', 'portal', 'fax', 'mail'].includes(method)) {
      return NextResponse.json(
        { error: 'method must be email, phone, portal, fax, or mail' },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    // Verify the user has access to this request (owns the company that initiated it)
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .ilike('wallet_address', walletAddress)
      .single()

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Get the verification request
    const { data: verificationRequest, error: reqError } = await supabase
      .from('employment_verification_requests')
      .select(`
        id,
        status,
        attempt_count,
        requesting_company_id,
        previous_employer_email,
        previous_employer_phone,
        verification_token
      `)
      .eq('id', requestId)
      .single()

    if (reqError || !verificationRequest) {
      return NextResponse.json(
        { error: 'Verification request not found' },
        { status: 404 }
      )
    }

    // Check user has access (owns the requesting company)
    // Schema: companies.employer_user_id links to users.id
    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .eq('employer_user_id', user.id)
      .eq('id', verificationRequest.requesting_company_id)
      .single()

    if (!company) {
      return NextResponse.json(
        { error: 'You do not have access to this verification request' },
        { status: 403 }
      )
    }

    // Check if request can accept more attempts
    if (!['VERIFICATION_REQUESTED', 'VERIFICATION_IN_PROGRESS'].includes(verificationRequest.status)) {
      return NextResponse.json(
        { error: 'This verification has already been finalized' },
        { status: 409 }
      )
    }

    if (verificationRequest.attempt_count >= 3) {
      return NextResponse.json(
        { error: 'Maximum attempts (3) already reached' },
        { status: 409 }
      )
    }

    const newAttemptNumber = verificationRequest.attempt_count + 1

    // Create the attempt record
    const { data: attempt, error: attemptError } = await supabase
      .from('verification_attempts')
      .insert({
        verification_request_id: requestId,
        attempt_number: newAttemptNumber,
        method,
        contact_email: contactEmail || verificationRequest.previous_employer_email,
        contact_phone: contactPhone || verificationRequest.previous_employer_phone,
        contact_person: contactPerson || null,
      })
      .select()
      .single()

    if (attemptError) {
      console.error('Error creating attempt:', attemptError)
      return NextResponse.json(
        { error: 'Failed to record attempt' },
        { status: 500 }
      )
    }

    // Update the verification request
    const updateData: Record<string, unknown> = {
      attempt_count: newAttemptNumber,
      last_attempt_at: new Date().toISOString(),
      status: 'VERIFICATION_IN_PROGRESS',
    }

    // Set next attempt time if under 3
    if (newAttemptNumber < 3) {
      const nextAttempt = new Date()
      nextAttempt.setDate(nextAttempt.getDate() + 3) // 3 days later
      updateData.next_attempt_at = nextAttempt.toISOString()
    } else {
      updateData.next_attempt_at = null
    }

    await supabase
      .from('employment_verification_requests')
      .update(updateData)
      .eq('id', requestId)

    console.log('✅ Verification attempt recorded:', {
      requestId,
      attemptNumber: newAttemptNumber,
      method,
    })

    // Build verification link for previous employer (uses request host in prod)
    const verificationLink = `${getAppBaseUrl(request)}/verify/${verificationRequest.verification_token}`

    return NextResponse.json({
      success: true,
      attempt: rowToVerificationAttempt(attempt as VerificationAttemptRow),
      attemptNumber: newAttemptNumber,
      remainingAttempts: 3 - newAttemptNumber,
      verificationLink, // For email/sms templates
      message: newAttemptNumber === 3 
        ? 'Final attempt recorded. If no response, verification will be marked as exhausted.'
        : `Attempt ${newAttemptNumber}/3 recorded. Next attempt in 3 days if no response.`,
    })

  } catch (error) {
    console.error('Error recording verification attempt:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/verification/attempt
 * 
 * Mark an attempt as having received a response (for tracking).
 * Also used to mark verifications as exhausted after 3 failed attempts.
 * 
 * Body options:
 * - requestId + attemptId + responseNotes: Mark attempt as responded
 * - requestId + markExhausted: true: Mark verification as exhausted
 */
export async function PATCH(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { requestId, attemptId, responseNotes, markExhausted } = body

    if (!requestId) {
      return NextResponse.json(
        { error: 'requestId is required' },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    // Verify user access
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .ilike('wallet_address', walletAddress)
      .single()

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Get the verification request
    const { data: verificationRequest } = await supabase
      .from('employment_verification_requests')
      .select('id, status, attempt_count, requesting_company_id')
      .eq('id', requestId)
      .single()

    if (!verificationRequest) {
      return NextResponse.json(
        { error: 'Verification request not found' },
        { status: 404 }
      )
    }

    // Check user has access (owns the requesting company)
    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .eq('employer_user_id', user.id)
      .eq('id', verificationRequest.requesting_company_id)
      .single()

    if (!company) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Handle mark exhausted
    if (markExhausted) {
      if (verificationRequest.attempt_count < 3) {
        return NextResponse.json(
          { error: 'Cannot mark as exhausted until 3 attempts have been made' },
          { status: 400 }
        )
      }

      if (verificationRequest.status !== 'VERIFICATION_IN_PROGRESS') {
        return NextResponse.json(
          { error: 'Verification is not in progress' },
          { status: 409 }
        )
      }

      await supabase
        .from('employment_verification_requests')
        .update({
          status: 'ATTEMPTS_EXHAUSTED',
          finalized_at: new Date().toISOString(),
          next_attempt_at: null,
        })
        .eq('id', requestId)

      return NextResponse.json({
        success: true,
        message: 'Verification marked as exhausted after 3 attempts with no response',
      })
    }

    // Handle marking attempt as responded
    if (attemptId) {
      await supabase
        .from('verification_attempts')
        .update({
          response_received: true,
          responded_at: new Date().toISOString(),
          response_notes: responseNotes || null,
        })
        .eq('id', attemptId)

      return NextResponse.json({
        success: true,
        message: 'Attempt marked as responded',
      })
    }

    return NextResponse.json(
      { error: 'Either attemptId or markExhausted is required' },
      { status: 400 }
    )

  } catch (error) {
    console.error('Error updating verification attempt:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
