import { NextRequest, NextResponse } from 'next/server'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { buildProjectedCareerCard, toMvrDataFromOrderRow, toPspDataFromOrderRow } from '@/lib/projected-career-card'
import {
  fetchLatestDriverOwnedMvrData,
  fetchLatestDriverOwnedPspData,
  getDriverOwnedScreeningFlags,
} from '@/lib/driver-owned-screening'
import { listVerifiedCredentialFactsForEmployer } from '@/lib/employer-credential-facts'
import { resolveCompanyDqForCandidate } from '@/lib/dq-file-load'
import { stripTier3FromFormData } from '@/lib/employer-pii'
import type { MvrData, PspData } from '@/types/career-card'

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
    const employerUserId = await getStormUserIdFromRequest(request)
    const { userId } = await params

    if (!employerUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()

    const { data: membership } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', employerUserId)
      .eq('is_active', true)
      .single()

    let companyId = membership?.company_id || null

    if (!companyId) {
      const { data: legacyCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('employer_user_id', employerUserId)
        .single()

      companyId = legacyCompany?.id || null
    }

    if (!companyId) {
      return NextResponse.json({ error: 'No company access' }, { status: 403 })
    }

    // Invite-only / DQ-engaged drivers may not have a materialized career_cards
    // row yet. The projected card is built from profile + hub blocks either way.
    const { data: careerRow } = await supabase
      .from('career_cards')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

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

    let companyPspData: PspData | null = null
    const { data: companyPsp } = await supabase
      .from('psp_orders')
      .select('id, status, dl_state, created_at, completed_at')
      .eq('driver_user_id', userId)
      .eq('ordered_by_company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (companyPsp) {
      const { data: companyPspResult } = await supabase
        .from('psp_results')
        .select('result_status')
        .eq('psp_order_id', companyPsp.id)
        .maybeSingle()

      companyPspData = toPspDataFromOrderRow(companyPsp, companyPspResult)
    }

    card.employerCompanyPsp = companyPspData

    // Append-only: log that this employer opened this candidate's card (insights for the candidate)
    try {
      const { error: viewLogError } = await supabase.from('career_card_views').insert({
        candidate_user_id: userId,
        viewer_user_id: employerUserId,
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

    const { data: pspFmcsaConsent } = await supabase
      .from('psp_consents')
      .select('id, signed_at, form_data')
      .eq('company_id', companyId)
      .eq('driver_user_id', userId)
      .order('signed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const [{ data: hubBlocks }, { data: employerHubRows }] = await Promise.all([
      supabase.from('hub_blocks').select('block_type').eq('user_id', userId),
      supabase.from('employer_hub_blocks').select('block_type').eq('company_id', companyId),
    ])

    const installedBlockTypes = (hubBlocks || []).map((b) => b.block_type)
    const installedEmployerBlocks = (employerHubRows || []).map((b) => b.block_type)

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

    const { data: latestScreeningBundle } = await supabase
      .from('screening_consent_bundles')
      .select('id')
      .eq('company_id', companyId)
      .eq('driver_user_id', userId)
      .eq('status', 'complete')
      .order('completed_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()

    const completionFlags = {
      hasResume: Boolean(careerRow?.has_resume),
      hasMvr: Boolean(careerRow?.has_mvr),
      hasPsp: Boolean((careerRow as Record<string, unknown> | null)?.has_psp),
      hasDriverApp: Boolean(careerRow?.has_driver_app),
      hasProfile: Boolean(careerRow?.has_profile),
      hasWorkHistory: Boolean(careerRow?.has_work_history),
      hasScreeningConsentBundle: Boolean(latestScreeningBundle),
    }

    let verifiedFacts: Awaited<ReturnType<typeof listVerifiedCredentialFactsForEmployer>> = []
    try {
      verifiedFacts = await listVerifiedCredentialFactsForEmployer(supabase, userId, companyId)
    } catch (e) {
      console.warn('[EMPLOYER TALENT] verifiedFacts load:', e)
    }

    const driverOwnedFlags = await getDriverOwnedScreeningFlags(supabase, userId)

    let dqFile: Awaited<ReturnType<typeof resolveCompanyDqForCandidate>> | null = null
    try {
      dqFile = await resolveCompanyDqForCandidate(supabase, companyId, userId)
    } catch (e) {
      console.warn('[EMPLOYER TALENT] dqFile load:', e)
    }

    // Consenting company may view driver-owned pre-screen on the card (not broad-published).
    if (latestScreeningBundle) {
      const [driverOwnedMvr, driverOwnedPsp] = await Promise.all([
        !companyMvrData ? fetchLatestDriverOwnedMvrData(supabase, userId) : Promise.resolve(null),
        !companyPspData ? fetchLatestDriverOwnedPspData(supabase, userId) : Promise.resolve(null),
      ])
      if (driverOwnedMvr) {
        if (!companyMvrData) {
          card.employerCompanyMvr = { ...driverOwnedMvr, employerPaidScreening: false }
        }
        const idx = card.sections.findIndex((s) => s.blockType === 'driver-mvr')
        if (idx >= 0) {
          card.sections[idx] = { ...card.sections[idx], data: driverOwnedMvr, needsSetup: false }
        }
      }
      if (driverOwnedPsp) {
        if (!companyPspData) {
          card.employerCompanyPsp = { ...driverOwnedPsp, employerPaidScreening: false }
        }
        const idx = card.sections.findIndex((s) => s.blockType === 'driver-psp')
        if (idx >= 0) {
          card.sections[idx] = { ...card.sections[idx], data: driverOwnedPsp, needsSetup: false }
        }
      }
    }

    return NextResponse.json({
      success: true,
      employerCompany: {
        id: companyId,
        companyWalletAddress: companyWalletRow?.wallet_address ?? null,
      },
      card,
      installedBlockTypes,
      installedEmployerBlocks,
      pendingRequests: pendingRequests || [],
      existingApplication,
      hasBgcheckConsent: !!bgcheckConsent,
      bgcheckConsentSignedAt: bgcheckConsent?.signed_at || null,
      // Prefills the legacy MVR/PSP order form. Stripped of Tier 3 so a signed
      // consent can't be used as a lookup for the driver's DOB and home address.
      bgcheckConsentFormData: stripTier3FromFormData(
        bgcheckConsent?.form_data as Record<string, unknown> | null
      ),
      hasPspFmcsaConsent: !!pspFmcsaConsent,
      pspFmcsaConsentSignedAt: pspFmcsaConsent?.signed_at || null,
      pspFmcsaConsentFormData: stripTier3FromFormData(
        pspFmcsaConsent?.form_data as Record<string, unknown> | null
      ),
      screeningConsentBundleId: latestScreeningBundle?.id ?? null,
      hasActiveDriverOwnedMvr: driverOwnedFlags.hasActiveDriverOwnedMvr,
      hasActiveDriverOwnedPsp: driverOwnedFlags.hasActiveDriverOwnedPsp,
      driverOwnedMvrStatus: driverOwnedFlags.driverOwnedMvrStatus,
      driverOwnedPspStatus: driverOwnedFlags.driverOwnedPspStatus,
      completionFlags,
      dqFile,
      verifiedFacts,
      completenessScore: careerRow?.completeness_score ?? 0,
      verifiedJobsCount: careerRow?.verified_jobs_count ?? 0,
      workHistoryCount: careerRow?.work_history_count ?? 0,
    })
  } catch (error) {
    console.error('[EMPLOYER TALENT] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
