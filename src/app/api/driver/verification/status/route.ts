import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import {
  VerificationRequestRow,
  VerificationAttemptRow,
  rowToVerificationRequest,
  rowToVerificationAttempt,
  DriverVerificationSummary,
} from '@/types/employment-verification'
import { getDriverEmployment } from '@/lib/block-data'

/**
 * GET /api/driver/verification/status
 *
 * Driver-only: returns employment verification status for the authenticated driver.
 * Reads from block_driver_employment (DOT forms / resume prefill). No developer data.
 *
 * Query params:
 * - initiatedBy: 'applicant' | 'employer' (optional)
 * - requestId: UUID (optional, for single request details)
 */
export async function GET(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const requestId = searchParams.get('requestId')
    const initiatedByFilter = searchParams.get('initiatedBy') as 'applicant' | 'employer' | null

    const supabase = await getAdminSupabaseClient()

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .ilike('wallet_address', walletAddress)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (requestId) {
      return getDriverVerificationDetails(supabase, user.id, requestId)
    }

    // Employment history from block table
    const employmentHistory = await getDriverEmployment(supabase, user.id)
    const totalEmployments = employmentHistory.length

    let query = supabase
      .from('employment_verification_requests')
      .select(`
        *,
        companies:requesting_company_id ( company_name )
      `)
      .eq('driver_id', user.id)
      .eq('applicant_type', 'driver')
      .order('created_at', { ascending: false })

    if (initiatedByFilter) {
      query = query.eq('initiated_by', initiatedByFilter)
    }

    const { data: requests, error: requestsError } = await query

    if (requestsError) {
      if (requestsError.code === '42P01' || requestsError.message?.includes('does not exist')) {
        return NextResponse.json({
          success: true,
          summary: {
            totalEmployments,
            selfReported: totalEmployments,
            pendingVerification: 0,
            verified: 0,
            partiallyVerified: 0,
            denied: 0,
            attemptsExhausted: 0,
            activeVerifications: [],
          },
          requests: [],
          tableNotCreated: true,
        })
      }
      console.error('[DRIVER VERIFICATION STATUS]', requestsError)
      return NextResponse.json(
        { error: 'Failed to fetch verification data' },
        { status: 500 }
      )
    }

    const statusCounts = {
      selfReported: totalEmployments,
      pendingVerification: 0,
      verified: 0,
      partiallyVerified: 0,
      denied: 0,
      attemptsExhausted: 0,
    }
    const verifiedEmploymentIds = new Set<string>()
    const activeVerifications: DriverVerificationSummary['activeVerifications'] = []

    for (const req of requests || []) {
      const status = req.status
      if (['VERIFICATION_REQUESTED', 'VERIFICATION_IN_PROGRESS'].includes(status)) {
        statusCounts.pendingVerification++
        activeVerifications.push({
          employmentId: req.employment_id,
          employerName: req.previous_employer_name,
          requestingCompanyName:
            req.initiated_by === 'applicant'
              ? 'Self-Initiated'
              : (req.companies as { company_name?: string } | null)?.company_name ?? 'Unknown',
          status,
          attemptCount: req.attempt_count,
        })
      } else if (status === 'VERIFIED' || status === 'PARTIALLY_VERIFIED') {
        statusCounts.verified += status === 'VERIFIED' ? 1 : 0
        statusCounts.partiallyVerified += status === 'PARTIALLY_VERIFIED' ? 1 : 0
        verifiedEmploymentIds.add(req.employment_id)
      } else if (status === 'VERIFICATION_DENIED') {
        statusCounts.denied++
      } else if (status === 'ATTEMPTS_EXHAUSTED') {
        statusCounts.attemptsExhausted++
      }
    }

    statusCounts.selfReported = totalEmployments - verifiedEmploymentIds.size

    const summary: DriverVerificationSummary = {
      totalEmployments,
      ...statusCounts,
      activeVerifications,
    }

    return NextResponse.json({
      success: true,
      summary,
      requests: (requests || []).map((r) => {
        const companyName =
          r.initiated_by === 'applicant'
            ? 'Self-Initiated'
            : (r.companies as { company_name?: string } | null)?.company_name
        const req = rowToVerificationRequest(r as VerificationRequestRow, companyName)
        delete (req as { verificationToken?: string }).verificationToken
        return req
      }),
    })
  } catch (error) {
    console.error('[DRIVER VERIFICATION STATUS]', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function getDriverVerificationDetails(
  supabase: Awaited<ReturnType<typeof getAdminSupabaseClient>>,
  userId: string,
  requestId: string
) {
  const { data: requestData, error: requestError } = await supabase
    .from('employment_verification_requests')
    .select(
      `
      *,
      companies:requesting_company_id ( company_name )
    `
    )
    .eq('id', requestId)
    .eq('driver_id', userId)
    .eq('applicant_type', 'driver')
    .single()

  if (requestError || !requestData) {
    return NextResponse.json(
      { error: 'Verification request not found' },
      { status: 404 }
    )
  }

  const { data: attempts } = await supabase
    .from('verification_attempts')
    .select('*')
    .eq('verification_request_id', requestId)
    .order('attempt_number', { ascending: true })

  const verificationRequest = rowToVerificationRequest(
    requestData as VerificationRequestRow,
    (requestData.companies as { company_name?: string } | null)?.company_name
  )
  delete (verificationRequest as { verificationToken?: string }).verificationToken

  return NextResponse.json({
    success: true,
    verificationRequest,
    attempts: (attempts || []).map((a) =>
    rowToVerificationAttempt(a as VerificationAttemptRow)
  ),
  })
}
