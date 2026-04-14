import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { buildProjectedCareerCard, toMvrDataFromOrderRow } from '@/lib/projected-career-card'
import type { MvrData } from '@/types/career-card'

/**
 * GET /api/employer/talent/[userId]
 *
 * Returns the same hub-projected career card as GET /api/career-card (candidate self-view),
 * plus employer-only context (requests, company MVR, applications).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    const { userId } = await params

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 401 })
    }

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()

    const { data: employer } = await supabase
      .from('users')
      .select('id')
      .ilike('wallet_address', walletAddress)
      .single()

    if (!employer) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { data: membership } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', employer.id)
      .eq('is_active', true)
      .single()

    let companyId = membership?.company_id || null

    if (!companyId) {
      const { data: legacyCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('employer_user_id', employer.id)
        .single()

      companyId = legacyCompany?.id || null
    }

    if (!companyId) {
      return NextResponse.json({ error: 'No company access' }, { status: 403 })
    }

    const { data: careerRow, error: cardError } = await supabase
      .from('career_cards')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (cardError || !careerRow) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
    }

    const { data: candidate } = await supabase
      .from('users')
      .select('id, created_at, share_token, share_settings')
      .eq('id', userId)
      .single()

    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
    }

    const defaultShare = { showContact: false, allowConnect: true }
    const shareSettings = candidate.share_settings ?? defaultShare

    const card = await buildProjectedCareerCard(supabase, userId, {
      memberSince: candidate.created_at ?? new Date().toISOString(),
      shareToken: candidate.share_token ?? null,
      shareSettings,
      contactMode: 'employer',
    })

    let companyMvrData: MvrData | null = null
    const { data: companyMvr } = await supabase
      .from('mvr_orders')
      .select('id, status, dl_state, created_at, completed_at')
      .eq('driver_user_id', userId)
      .eq('ordered_by_company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (companyMvr) {
      const { data: companyMvrResults } = await supabase
        .from('mvr_results')
        .select('license_status, license_class, total_points, violation_count')
        .eq('mvr_order_id', companyMvr.id)
        .maybeSingle()

      companyMvrData = toMvrDataFromOrderRow(companyMvr, companyMvrResults)
    }

    card.employerCompanyMvr = companyMvrData

    // Append-only: log that this employer opened this candidate's card (insights for the candidate)
    try {
      const { error: viewLogError } = await supabase.from('career_card_views').insert({
        candidate_user_id: userId,
        viewer_user_id: employer.id,
        source: 'talent_search',
      })
      if (viewLogError) {
        console.warn('[EMPLOYER TALENT] career_card_views insert:', viewLogError.message)
      }
    } catch (e) {
      console.warn('[EMPLOYER TALENT] career_card_views insert failed:', e)
    }

    const { data: pendingRequests } = await supabase
      .from('candidate_requests')
      .select('id, request_type, document_type, target_block_type, status, created_at')
      .eq('candidate_user_id', userId)
      .eq('company_id', companyId)
      .in('status', ['pending', 'viewed'])

    const { data: bgcheckConsent } = await supabase
      .from('bgcheck_consents')
      .select('id, signed_at, form_data')
      .eq('company_id', companyId)
      .eq('driver_user_id', userId)
      .order('signed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { data: hubBlocks } = await supabase
      .from('hub_blocks')
      .select('block_type')
      .eq('user_id', userId)

    const installedBlockTypes = (hubBlocks || []).map((b) => b.block_type)

    const { data: companyJobs } = await supabase
      .from('job_postings')
      .select('id')
      .eq('company_id', companyId)

    const jobIds = (companyJobs || []).map((j) => j.id)
    let existingApplication = null

    if (jobIds.length > 0) {
      const { data: app } = await supabase
        .from('applications')
        .select('id, job_posting_id, status, created_at')
        .eq('applicant_user_id', userId)
        .in('job_posting_id', jobIds)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      existingApplication = app
    }

    const { data: companyWalletRow } = await supabase
      .from('companies')
      .select('wallet_address')
      .eq('id', companyId)
      .maybeSingle()

    const completionFlags = {
      hasResume: Boolean(careerRow.has_resume),
      hasMvr: Boolean(careerRow.has_mvr),
      hasDriverApp: Boolean(careerRow.has_driver_app),
      hasProfile: Boolean(careerRow.has_profile),
      hasWorkHistory: Boolean(careerRow.has_work_history),
    }

    return NextResponse.json({
      success: true,
      employerCompany: {
        id: companyId,
        walletAddress: companyWalletRow?.wallet_address ?? null,
      },
      card,
      installedBlockTypes,
      pendingRequests: pendingRequests || [],
      existingApplication,
      hasBgcheckConsent: !!bgcheckConsent,
      bgcheckConsentSignedAt: bgcheckConsent?.signed_at || null,
      bgcheckConsentFormData: bgcheckConsent?.form_data || null,
      completionFlags,
      completenessScore: careerRow.completeness_score ?? 0,
      verifiedJobsCount: careerRow.verified_jobs_count ?? 0,
      workHistoryCount: careerRow.work_history_count ?? 0,
    })
  } catch (error) {
    console.error('[EMPLOYER TALENT] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
