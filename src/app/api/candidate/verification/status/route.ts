import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import {
  VerificationRequestRow,
  rowToVerificationRequest,
  type DriverVerificationSummary,
} from '@/types/employment-verification'
import {
  getMergedCandidateEmployments,
  requestMatchesCandidateRow,
} from '@/lib/candidate-employment-verification'

/**
 * GET /api/candidate/verification/status
 *
 * Composable hub: merged employments from driver employment block, developer profile,
 * and general resume — plus applicant-initiated verification requests (all applicant types).
 */
export async function GET(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
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

    const employments = await getMergedCandidateEmployments(supabase, user.id)
    const totalEmployments = employments.length

    let query = supabase
      .from('employment_verification_requests')
      .select(
        `
        *,
        companies:requesting_company_id ( company_name )
      `,
      )
      .eq('driver_id', user.id)
      .in('applicant_type', ['driver', 'developer', 'general'])
      .order('created_at', { ascending: false })

    if (initiatedByFilter) {
      query = query.eq('initiated_by', initiatedByFilter)
    }

    const { data: rawRequests, error: requestsError } = await query

    if (requestsError) {
      if (requestsError.code === '42P01' || requestsError.message?.includes('does not exist')) {
        return NextResponse.json({
          success: true,
          employments,
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
      console.error('[CANDIDATE VERIFICATION STATUS]', requestsError)
      return NextResponse.json({ error: 'Failed to fetch verification data' }, { status: 500 })
    }

    const requests = (rawRequests || []).map((r) => {
      const companyName =
        r.initiated_by === 'applicant'
          ? 'Self-Initiated'
          : (r.companies as { company_name?: string } | null)?.company_name
      const req = rowToVerificationRequest(r as VerificationRequestRow, companyName)
      delete (req as { verificationToken?: string }).verificationToken
      return req
    })

    const applicantRequests = requests.filter((r) => r.initiatedBy === 'applicant')

    const statusCounts = {
      selfReported: totalEmployments,
      pendingVerification: 0,
      verified: 0,
      partiallyVerified: 0,
      denied: 0,
      attemptsExhausted: 0,
    }
    const verifiedRowKeys = new Set<string>()
    const activeVerifications: DriverVerificationSummary['activeVerifications'] = []

    for (const req of applicantRequests) {
      const status = req.status
      if (status === 'VERIFICATION_REQUESTED' || status === 'VERIFICATION_IN_PROGRESS') {
        statusCounts.pendingVerification++
        const raw = (rawRequests || []).find((x) => x.id === req.id) as
          | { attempt_count?: number }
          | undefined
        activeVerifications.push({
          employmentId: req.employmentId,
          employerName: req.previousEmployerName,
          requestingCompanyName: 'Self-Initiated',
          status,
          attemptCount: raw?.attempt_count ?? 0,
        })
      } else if (status === 'VERIFIED' || status === 'PARTIALLY_VERIFIED') {
        statusCounts.verified += status === 'VERIFIED' ? 1 : 0
        statusCounts.partiallyVerified += status === 'PARTIALLY_VERIFIED' ? 1 : 0
        for (const row of employments) {
          if (requestMatchesCandidateRow(req, row)) {
            verifiedRowKeys.add(row.verificationKey)
            break
          }
        }
      } else if (status === 'VERIFICATION_DENIED') {
        statusCounts.denied++
      } else if (status === 'ATTEMPTS_EXHAUSTED') {
        statusCounts.attemptsExhausted++
      }
    }

    statusCounts.selfReported = Math.max(0, totalEmployments - verifiedRowKeys.size)

    const summary: DriverVerificationSummary = {
      totalEmployments,
      ...statusCounts,
      activeVerifications,
    }

    return NextResponse.json({
      success: true,
      employments,
      summary,
      requests,
    })
  } catch (error) {
    console.error('[CANDIDATE VERIFICATION STATUS]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
