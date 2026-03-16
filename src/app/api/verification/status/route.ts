import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { 
  VerificationRequestRow, 
  VerificationAttemptRow,
  rowToVerificationRequest,
  rowToVerificationAttempt,
  EmployerVerificationSummary
} from '@/types/employment-verification'

/**
 * GET /api/verification/status
 *
 * Employer-only for summary. Drivers use GET /api/driver/verification/status.
 * Developers use GET /api/developer/verification/status.
 * DOT forms 1–3 and driver_profiles are driver-only; developer_profiles are developer-only.
 *
 * Query params:
 * - role: 'employer' (driver/developer should use their role-specific endpoints)
 * - requestId: UUID (optional, for single request details when employer)
 */
export async function GET(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    console.log('[VERIFICATION STATUS] Received request with wallet:', walletAddress)
    
    if (!walletAddress) {
      console.log('[VERIFICATION STATUS] No wallet address in header')
      return NextResponse.json(
        { error: 'Wallet address required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const roleParam = searchParams.get('role')
    const requestId = searchParams.get('requestId')
    console.log('[VERIFICATION STATUS] Role param:', roleParam, 'RequestId:', requestId)

    const supabase = await getAdminSupabaseClient()

    // Get the user (using ilike for case-insensitive wallet address matching)
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, role')
      .ilike('wallet_address', walletAddress)
      .single()

    console.log('[VERIFICATION STATUS] User lookup result:', { user, error: userError?.message })

    if (userError || !user) {
      console.log('[VERIFICATION STATUS] User not found for wallet:', walletAddress)
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }
    
    console.log('[VERIFICATION STATUS] Found user:', user.id, 'Role:', user.role || roleParam)

    const role = roleParam || user.role

    // Driver and developer must use their own endpoints (no mixing DOT/dev data)
    if (role === 'driver') {
      return NextResponse.json(
        { error: 'Use GET /api/driver/verification/status for driver verification status' },
        { status: 400 }
      )
    }
    if (role === 'developer') {
      return NextResponse.json(
        { error: 'Use GET /api/developer/verification/status for developer verification status' },
        { status: 400 }
      )
    }

    // If specific request ID is provided, return that request with attempts (employer view)
    if (requestId) {
      return getVerificationDetails(supabase, user.id, role, requestId)
    }

    if (role === 'employer') {
      return getEmployerVerificationSummary(supabase, user.id, walletAddress)
    }

    return NextResponse.json(
      { error: 'Invalid role. Use employer, or call driver/developer verification endpoints.' },
      { status: 400 }
    )

  } catch (error) {
    console.error('Error fetching verification status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function getVerificationDetails(
  supabase: Awaited<ReturnType<typeof getAdminSupabaseClient>>,
  userId: string,
  role: string,
  requestId: string
) {
  // Get the verification request
  const { data: request_data, error: requestError } = await supabase
    .from('employment_verification_requests')
    .select(`
      *,
      companies:requesting_company_id (
        company_name
      )
    `)
    .eq('id', requestId)
    .single()

  if (requestError || !request_data) {
    // Handle table-not-exist error
    if (requestError?.code === '42P01' || requestError?.message?.includes('does not exist')) {
      return NextResponse.json(
        { error: 'Verification system not yet set up' },
        { status: 404 }
      )
    }
    return NextResponse.json(
      { error: 'Verification request not found' },
      { status: 404 }
    )
  }

  // Verify access - driver can see their own, employer can see their company's
  if (role === 'driver' && request_data.driver_id !== userId) {
    return NextResponse.json(
      { error: 'Access denied' },
      { status: 403 }
    )
  }

  // For employers, check companies.employer_user_id
  // In production, add proper company membership check

  // Get attempts for this request
  const { data: attempts } = await supabase
    .from('verification_attempts')
    .select('*')
    .eq('verification_request_id', requestId)
    .order('attempt_number', { ascending: true })

  const verificationRequest = rowToVerificationRequest(
    request_data as VerificationRequestRow,
    (request_data.companies as any)?.company_name
  )

  // Don't expose token to frontend
  delete verificationRequest.verificationToken

  return NextResponse.json({
    success: true,
    verificationRequest,
    attempts: (attempts || []).map(a => rowToVerificationAttempt(a as VerificationAttemptRow)),
  })
}

async function getEmployerVerificationSummary(
  supabase: Awaited<ReturnType<typeof getAdminSupabaseClient>>,
  userId: string,
  walletAddress: string
) {
  // Get employer's company
  // Schema: companies.employer_user_id links to users.id (one company per employer)
  const { data: company } = await supabase
    .from('companies')
    .select('id, company_name')
    .eq('employer_user_id', userId)
    .single()

  if (!company?.id) {
    return NextResponse.json({
      success: true,
      summary: {
        totalRequested: 0,
        pendingResponse: 0,
        verified: 0,
        denied: 0,
        attemptsExhausted: 0,
        requests: [],
      },
      hasCompany: false,
    })
  }

  const companyId = company.id
  const companyName = company.company_name

  // Get all verification requests by this company
  // Note: This table may not exist if migration hasn't run yet
  const { data: requests, error: requestsError } = await supabase
    .from('employment_verification_requests')
    .select('*')
    .eq('requesting_company_id', companyId)
    .order('created_at', { ascending: false })

  // If table doesn't exist yet, return empty summary gracefully
  if (requestsError) {
    if (requestsError.code === '42P01' || requestsError.message?.includes('does not exist')) {
      console.log('Verification table not yet created - returning empty employer summary')
      return NextResponse.json({
        success: true,
        summary: {
          totalRequested: 0,
          pendingResponse: 0,
          verified: 0,
          denied: 0,
          attemptsExhausted: 0,
          requests: [],
        },
        hasCompany: true,
        companyName,
        tableNotCreated: true,
      })
    }
    console.error('Error fetching employer verifications:', requestsError)
    return NextResponse.json(
      { error: 'Failed to fetch verification data' },
      { status: 500 }
    )
  }

  // Batch-fetch names from user_profiles
  const driverIds = [...new Set((requests || []).map(r => r.driver_id).filter(Boolean))]
  const { data: userProfiles } = driverIds.length
    ? await supabase.from('user_profiles').select('user_id, first_name, last_name').in('user_id', driverIds)
    : { data: [] }
  const nameMap = new Map<string, string>()
  for (const p of userProfiles ?? []) {
    nameMap.set(p.user_id, [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unknown')
  }

  // Count statuses
  const statusCounts = {
    totalRequested: requests?.length || 0,
    pendingResponse: 0,
    verified: 0,
    denied: 0,
    attemptsExhausted: 0,
  }

  for (const req of (requests || [])) {
    const status = req.status
    if (['VERIFICATION_REQUESTED', 'VERIFICATION_IN_PROGRESS'].includes(status)) {
      statusCounts.pendingResponse++
    } else if (status === 'VERIFIED' || status === 'PARTIALLY_VERIFIED') {
      statusCounts.verified++
    } else if (status === 'VERIFICATION_DENIED') {
      statusCounts.denied++
    } else if (status === 'ATTEMPTS_EXHAUSTED') {
      statusCounts.attemptsExhausted++
    }
  }

  const formattedRequests = (requests || []).map(r => {
    const req = rowToVerificationRequest(r as VerificationRequestRow, companyName)
    ;(req as any).driverName = nameMap.get(r.driver_id) ?? 'Unknown'
    // Don't expose token
    delete req.verificationToken
    return req
  })

  const summary: EmployerVerificationSummary = {
    ...statusCounts,
    requests: formattedRequests,
  }

  return NextResponse.json({
    success: true,
    summary,
    hasCompany: true,
    companyName,
  })
}
