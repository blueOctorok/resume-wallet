import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

/**
 * GET /api/employer/reports
 *
 * Returns compliance-focused data for the employer reports page:
 *   - MVR orders (with candidate info and result summary)
 *   - DOT application completion across the pipeline
 *   - Background check consent status
 *
 * All data is scoped to the employer's company.
 */
export async function GET(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()

    // Resolve employer → company
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .ilike('wallet_address', walletAddress)
      .single()

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const { data: membership } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    let companyId = membership?.company_id ?? null

    if (!companyId) {
      const { data: legacy } = await supabase
        .from('companies')
        .select('id')
        .eq('employer_user_id', user.id)
        .single()
      companyId = legacy?.id ?? null
    }

    if (!companyId) {
      return NextResponse.json({ error: 'No company found' }, { status: 404 })
    }

    // All candidate user IDs in this company's pipeline
    const { data: applications } = await supabase
      .from('applications')
      .select('applicant_user_id, job_posting_id, job_postings!inner(company_id)')
      .eq('job_postings.company_id', companyId)

    const candidateUserIds = [...new Set(
      (applications ?? []).map(a => a.applicant_user_id).filter(Boolean)
    )]

    if (candidateUserIds.length === 0) {
      return NextResponse.json({
        mvr: { orders: [], summary: { total: 0, pending: 0, processing: 0, complete: 0, failed: 0 } },
        dot: { total: 0, completed: 0, incomplete: 0, candidates: [] },
        bgcheck: { total: 0, signed: 0, pending: 0 },
      })
    }

    // ── Fetch all data in parallel ────────────────────────────────────────────
    const [
      { data: mvrOrders },
      { data: dotApps },
      { data: consents },
      { data: driverProfiles },
      { data: candidateRequests },
    ] = await Promise.all([
      // All MVR orders for pipeline candidates (driver or employer initiated)
      supabase
        .from('mvr_orders')
        .select(`
          id, status, dl_state, ordered_at, ordered_by_employer,
          driver_user_id,
          mvr_results ( license_status, total_points, violation_count, result_status )
        `)
        .in('driver_user_id', candidateUserIds)
        .order('ordered_at', { ascending: false }),

      // DOT application status per candidate
      supabase
        .from('driver_applications')
        .select('user_id, is_complete, current_step, updated_at')
        .in('user_id', candidateUserIds)
        .order('updated_at', { ascending: false }),

      // Bgcheck consents this company has received
      supabase
        .from('bgcheck_consents')
        .select('driver_user_id, signed_at, signed_name')
        .in('driver_user_id', candidateUserIds)
        .eq('company_id', companyId)
        .order('signed_at', { ascending: false }),

      // Driver profile names for display
      supabase
        .from('driver_profiles')
        .select('user_id, first_name, last_name')
        .in('user_id', candidateUserIds),

      // Pending MVR requests (employer sent, driver hasn't signed yet)
      supabase
        .from('candidate_requests')
        .select('candidate_user_id, request_type, status, created_at')
        .in('candidate_user_id', candidateUserIds)
        .eq('request_type', 'mvr_order')
        .eq('requesting_company_id', companyId),
    ])

    // Build name lookup
    const nameMap = new Map<string, string>()
    for (const p of driverProfiles ?? []) {
      nameMap.set(p.user_id, `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'Unknown')
    }

    // ── MVR report ────────────────────────────────────────────────────────────
    const mvrList = (mvrOrders ?? []).map(order => {
      const result = Array.isArray(order.mvr_results)
        ? order.mvr_results[0]
        : order.mvr_results

      return {
        id:               order.id,
        candidateName:    nameMap.get(order.driver_user_id) ?? 'Unknown',
        candidateUserId:  order.driver_user_id,
        status:           order.status,
        dlState:          order.dl_state,
        orderedAt:        order.ordered_at,
        orderedByEmployer: order.ordered_by_employer ?? false,
        result: result ? {
          licenseStatus:  result.license_status,
          totalPoints:    result.total_points,
          violationCount: result.violation_count,
          resultStatus:   result.result_status,
        } : null,
      }
    })

    const mvrSummary = {
      total:      mvrList.length,
      pending:    mvrList.filter(o => ['pending', 'submitted'].includes(o.status)).length,
      processing: mvrList.filter(o => ['processing', 'in_progress'].includes(o.status)).length,
      complete:   mvrList.filter(o => ['complete', 'completed', 'returned'].includes(o.status)).length,
      failed:     mvrList.filter(o => ['failed', 'error'].includes(o.status)).length,
    }

    // ── DOT app report ────────────────────────────────────────────────────────
    // Most recent DOT app per user
    const dotByUser = new Map<string, typeof dotApps extends (infer T)[] | null ? T : never>()
    for (const app of dotApps ?? []) {
      if (!dotByUser.has(app.user_id)) dotByUser.set(app.user_id, app)
    }

    const dotCandidates = candidateUserIds.map(uid => ({
      candidateName:   nameMap.get(uid) ?? 'Unknown',
      candidateUserId: uid,
      hasApp:          dotByUser.has(uid),
      isComplete:      dotByUser.get(uid)?.is_complete ?? false,
      currentStep:     dotByUser.get(uid)?.current_step ?? 0,
      updatedAt:       dotByUser.get(uid)?.updated_at ?? null,
    }))

    const dotSummary = {
      total:     candidateUserIds.length,
      completed: dotCandidates.filter(c => c.isComplete).length,
      incomplete: dotCandidates.filter(c => !c.isComplete).length,
      candidates: dotCandidates,
    }

    // ── Bgcheck consent report ────────────────────────────────────────────────
    const signedUserIds = new Set((consents ?? []).map(c => c.driver_user_id))
    const pendingRequestUserIds = new Set(
      (candidateRequests ?? [])
        .filter(r => r.status === 'pending')
        .map(r => r.candidate_user_id)
    )

    const bgcheckReport = {
      total:   candidateUserIds.length,
      signed:  signedUserIds.size,
      pending: [...pendingRequestUserIds].filter(uid => !signedUserIds.has(uid)).length,
      candidates: candidateUserIds.map(uid => ({
        candidateName:   nameMap.get(uid) ?? 'Unknown',
        candidateUserId: uid,
        signed:          signedUserIds.has(uid),
        signedAt:        consents?.find(c => c.driver_user_id === uid)?.signed_at ?? null,
        signedName:      consents?.find(c => c.driver_user_id === uid)?.signed_name ?? null,
        requestPending:  pendingRequestUserIds.has(uid),
      })),
    }

    return NextResponse.json({ mvr: { orders: mvrList, summary: mvrSummary }, dot: dotSummary, bgcheck: bgcheckReport })

  } catch (err) {
    console.error('[EMPLOYER REPORTS] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
