import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { 
  VerificationRequestRow, 
  rowToVerificationRequest 
} from '@/types/employment-verification'
import { getDriverEmployment } from '@/lib/block-data'

/**
 * POST /api/verification/initiate
 * 
 * Future employer initiates employment verification for a driver.
 * Creates a verification request and prepares for first contact attempt.
 * 
 * Auth: Supabase session cookie (falls back to x-wallet-address until T1.12).
 * Required:
 * - driverId: UUID of the driver
 * - employmentId: ID from driver's employment_history array
 * 
 * Optional:
 * - previousEmployerEmail: Override email for previous employer
 * - previousEmployerPhone: Override phone for previous employer
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { driverId, employmentId, previousEmployerEmail, previousEmployerPhone } = body

    if (!driverId || !employmentId) {
      return NextResponse.json(
        { error: 'driverId and employmentId are required' },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    // 1. Get the requesting user's company
    // Schema: companies.employer_user_id links to users.id (one company per employer)
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, company_name, verified')
      .eq('employer_user_id', userId)
      .single()

    if (companyError || !company) {
      return NextResponse.json(
        { error: 'You must have a company profile to initiate verifications' },
        { status: 403 }
      )
    }

    const companyId = company.id
    const companyName = company.company_name

    // 2. Get the driver's employment history from block tables
    const employmentHistory = await getDriverEmployment(supabase, driverId)

    if (employmentHistory.length === 0) {
      console.error('Driver employment history not found for:', driverId)
      return NextResponse.json(
        { error: 'Driver profile not found' },
        { status: 404 }
      )
    }

    // 3. Find the specific employment entry
    const employment = employmentHistory.find((e) => e.id === employmentId)

    if (!employment) {
      return NextResponse.json(
        { error: 'Employment entry not found in driver profile' },
        { status: 404 }
      )
    }

    // 4. Check if verification already exists for this employment + company combo
    const { data: existingRequest } = await supabase
      .from('employment_verification_requests')
      .select('id, status')
      .eq('driver_id', driverId)
      .eq('employment_id', employmentId)
      .eq('requesting_company_id', companyId)
      .not('status', 'in', '("ATTEMPTS_EXHAUSTED","VERIFICATION_DENIED","VERIFICATION_DECLINED")')
      .maybeSingle()

    if (existingRequest) {
      return NextResponse.json(
        { 
          error: 'Verification already in progress for this employment',
          existingRequestId: existingRequest.id,
          status: existingRequest.status
        },
        { status: 409 }
      )
    }

    // 5. Create the verification request
    const insertData = {
      driver_id: driverId,
      employment_id: employmentId,
      requesting_company_id: companyId,
      previous_employer_name: employment.companyName,
      previous_employer_email: previousEmployerEmail || employment.supervisorEmail || null,
      previous_employer_phone: previousEmployerPhone || employment.supervisorPhone || null,
      previous_employer_address: employment.location || null,
      claimed_position: employment.position,
      claimed_start_date: employment.startDate,
      claimed_end_date: employment.endDate || null,
      claimed_reason_for_leaving: employment.reasonForLeaving || null,
      status: 'VERIFICATION_REQUESTED',
      attempt_count: 0,
      next_attempt_at: new Date().toISOString(), // Ready for first attempt
    }

    const { data: newRequest, error: insertError } = await supabase
      .from('employment_verification_requests')
      .insert(insertData)
      .select()
      .single()

    if (insertError) {
      console.error('Error creating verification request:', insertError)
      // Handle table-not-exist error
      if (insertError.code === '42P01' || insertError.message?.includes('does not exist')) {
        return NextResponse.json(
          { error: 'Verification system not yet set up. Please run the database migration.' },
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
      companyName
    )

    console.log('✅ Verification request created:', {
      requestId: newRequest.id,
      driverId,
      employmentId,
      previousEmployer: employment.companyName,
      requestingCompany: companyName,
    })

    return NextResponse.json({
      success: true,
      verificationRequest,
      message: 'Verification request created. First contact attempt will be sent shortly.',
    })

  } catch (error) {
    console.error('Error in verification initiate:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
