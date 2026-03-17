import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import {
  getCdlData,
  getDriverEmployment,
  getSkills,
  getEducation,
  getDevGithub,
  getDevPortfolio,
  getDevProfile,
} from '@/lib/block-data'

/**
 * GET /api/employer/talent/[userId]
 *
 * Gets the full career card data for a specific candidate.
 * Returns profile, resume, credentials, work history, and verification status.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    const { userId } = await params

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 401 },
      )
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 },
      )
    }

    const supabase = await getAdminSupabaseClient()

    // Verify employer has company access
    const { data: employer } = await supabase
      .from('users')
      .select('id')
      .ilike('wallet_address', walletAddress)
      .single()

    if (!employer) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check company membership
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

    // Get career card from the view
    const { data: careerCard, error: cardError } = await supabase
      .from('career_cards')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (cardError || !careerCard) {
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404 },
      )
    }

    // Get additional details not in the view

    // 1. User basic info (share_token/share_settings live on users since migration 036)
    const { data: candidate } = await supabase
      .from('users')
      .select('id, email, role, created_at, share_token, share_settings')
      .eq('id', userId)
      .single()

    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('first_name, last_name, avatar_url, headline, email, phone, city, state, professional_summary')
      .eq('user_id', userId)
      .maybeSingle()

    // 2. Determine candidate type from installed blocks, then read block data
    const isDriver = !!careerCard.driver_profile_id
    const isDeveloper = !isDriver && !!careerCard.developer_profile_id

    // Parallel block reads — only fetch the blocks relevant to this candidate type
    const [cdlData, driverEmployment, skills, education, devProfileData, devGithub, devPortfolio] =
      await Promise.all([
        isDriver ? getCdlData(supabase, userId) : Promise.resolve(null),
        isDriver ? getDriverEmployment(supabase, userId) : Promise.resolve([]),
        getSkills(supabase, userId),
        getEducation(supabase, userId),
        isDeveloper ? getDevProfile(supabase, userId) : Promise.resolve(null),
        isDeveloper ? getDevGithub(supabase, userId) : Promise.resolve(null),
        isDeveloper ? getDevPortfolio(supabase, userId) : Promise.resolve(null),
      ])

    // 3. Reconstruct the profile shapes the CareerCard component expects
    let driverProfile = null
    if (isDriver) {
      driverProfile = {
        id: careerCard.driver_profile_id,
        professional_summary: userProfile?.professional_summary ?? null,
        cdl_class: cdlData?.cdl_class ?? null,
        cdl_state: cdlData?.cdl_state ?? null,
        cdl_number: cdlData?.cdl_number ?? null,
        cdl_expiration: cdlData?.cdl_expiration ?? null,
        endorsements: cdlData?.endorsements ?? [],
        restrictions: cdlData?.restrictions ?? [],
        employment_history: driverEmployment,
        education,
        skills,
        share_token: candidate?.share_token ?? null,
        share_settings: candidate?.share_settings ?? null,
      }
    }

    let developerProfile = null
    if (isDeveloper) {
      developerProfile = {
        id: careerCard.developer_profile_id,
        bio: devProfileData?.bio ?? null,
        headline: userProfile?.headline ?? null,
        title: userProfile?.headline ?? null,
        years_experience: devProfileData?.years_experience ?? null,
        employment_history: devProfileData?.employment_history ?? [],
        github_username: devGithub?.username ?? null,
        github_url: devGithub?.username ? `https://github.com/${devGithub.username}` : null,
        linkedin_url: devPortfolio?.linkedin_url ?? null,
        portfolio_url: devPortfolio?.portfolio_url ?? null,
        twitter_url: devPortfolio?.twitter_url ?? null,
        professional_summary: devProfileData?.bio ?? null,
        skills,
        education,
        share_token: candidate?.share_token ?? null,
      }
    }

    // 4. Latest resume with structured data
    let resume = null
    if (careerCard.resume_id) {
      const { data: res } = await supabase
        .from('resumes')
        .select(
          `
          id, title, filename, ipfs_hash, verification_status,
          structured_data, created_at
        `,
        )
        .eq('id', careerCard.resume_id)
        .single()

      resume = res
    }

    // 5. Driver application (DOT form)
    let driverApplication = null
    if (careerCard.driver_application_id) {
      const { data: da } = await supabase
        .from('driver_applications')
        .select(
          `
          id, verification_status, is_complete, created_at
        `,
        )
        .eq('id', careerCard.driver_application_id)
        .single()

      driverApplication = da
    }

    // 6. MVR data — dual lookup for FCRA compliance
    //
    // The career_cards view only surfaces self-ordered MVRs (migration 031).
    // Employer-ordered MVRs are fetched separately and only returned to the
    // company that paid for them — they are never visible to the driver or
    // other employers.

    let mvrData = null
    if (careerCard.latest_mvr_id) {
      // Self-ordered MVR (ordered_by_company_id IS NULL in DB, confirmed by view)
      const { data: mvr } = await supabase
        .from('mvr_orders')
        .select('id, status, dl_state, created_at, completed_at, ordered_by_company_id')
        .eq('id', careerCard.latest_mvr_id)
        .single()

      if (mvr) {
        const { data: mvrResults } = await supabase
          .from('mvr_results')
          .select('id, license_status, license_class, total_points, violation_count, parsed_data')
          .eq('mvr_order_id', mvr.id)
          .single()

        mvrData = { order: mvr, results: mvrResults }
      }
    }

    // This company's own private MVR order for the candidate (employer-initiated)
    let companyMvrData = null
    if (companyId) {
      const { data: companyMvr } = await supabase
        .from('mvr_orders')
        .select('id, status, dl_state, created_at, completed_at, ordered_by_company_id')
        .eq('driver_user_id', userId)
        .eq('ordered_by_company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (companyMvr) {
        const { data: companyMvrResults } = await supabase
          .from('mvr_results')
          .select('id, license_status, license_class, total_points, violation_count, parsed_data')
          .eq('mvr_order_id', companyMvr.id)
          .single()

        companyMvrData = { order: companyMvr, results: companyMvrResults }
      }
    }

    // 7. Employment verifications
    const { data: verifications } = await supabase
      .from('employment_verification_requests')
      .select(
        `
        id, previous_employer_name, claimed_position,
        claimed_start_date, claimed_end_date, status,
        verified_at, created_at
      `,
      )
      .eq('driver_id', userId)
      .order('created_at', { ascending: false })

    // 8. Pending requests from this company
    const { data: pendingRequests } = await supabase
      .from('candidate_requests')
      .select('id, request_type, document_type, status, created_at')
      .eq('candidate_user_id', userId)
      .eq('company_id', companyId)
      .in('status', ['pending', 'viewed'])

    // 9. Background check consent — has this driver signed the disclosure for this company?
    const { data: bgcheckConsent } = await supabase
      .from('bgcheck_consents')
      .select('id, signed_at, form_data')
      .eq('company_id', companyId)
      .eq('driver_user_id', userId)
      .order('signed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // 10. Candidate's installed block types — gates which request actions employers see
    const { data: hubBlocks } = await supabase
      .from('hub_blocks')
      .select('block_type')
      .eq('user_id', userId)

    const installedBlockTypes = (hubBlocks || []).map((b) => b.block_type)

    // 11. Existing applications to company's jobs
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

    // Build the response — identity comes from user_profiles, not role-specific profiles
    const upName = [userProfile?.first_name, userProfile?.last_name].filter(Boolean).join(' ')
    const effectiveRole = driverProfile ? 'driver' : developerProfile ? 'developer' : candidate?.role

    return NextResponse.json({
      success: true,
      careerCard: {
        userId: candidate?.id,
        role: effectiveRole,
        name: upName || careerCard.full_name || 'Unknown',
        avatarUrl: userProfile?.avatar_url ?? null,
        email: userProfile?.email || candidate?.email,
        phone: userProfile?.phone || null,
        location: userProfile?.city && userProfile?.state
          ? `${userProfile.city}, ${userProfile.state}`
          : careerCard.state || null,
        memberSince: candidate?.created_at,

        profile: (driverProfile || developerProfile)
          ? {
              ...(driverProfile || developerProfile),
              fullName: upName || 'Unknown',
            }
          : null,

        // Resume
        resume: resume
          ? {
              id: resume.id,
              title: resume.title,
              filename: resume.filename,
              ipfsHash: resume.ipfs_hash,
              verificationStatus: resume.verification_status,
              structuredData: resume.structured_data,
              createdAt: resume.created_at,
            }
          : null,

        // Driver-specific
        driverApplication: driverApplication
          ? {
              id: driverApplication.id,
              status: driverApplication.verification_status,
              isComplete: driverApplication.is_complete,
              createdAt: driverApplication.created_at,
            }
          : null,

        // Self-ordered MVR (shareable, visible to driver and all employers)
        mvr: mvrData
          ? {
              orderId: mvrData.order.id,
              orderStatus: mvrData.order.status,
              licenseState: mvrData.order.dl_state,
              orderedAt: mvrData.order.created_at,
              completedAt: mvrData.order.completed_at,
              wasOrderedByEmployer: false, // self-ordered by definition (view scoped this)
              results: mvrData.results
                ? {
                    licenseStatus: mvrData.results.license_status,
                    licenseClass: mvrData.results.license_class,
                    totalPoints: mvrData.results.total_points,
                    violationCount: mvrData.results.violation_count,
                  }
                : null,
            }
          : null,

        // This company's private MVR order — not visible to driver or other employers
        companyMvr: companyMvrData
          ? {
              orderId: companyMvrData.order.id,
              orderStatus: companyMvrData.order.status,
              licenseState: companyMvrData.order.dl_state,
              orderedAt: companyMvrData.order.created_at,
              completedAt: companyMvrData.order.completed_at,
              results: companyMvrData.results
                ? {
                    licenseStatus: companyMvrData.results.license_status,
                    licenseClass: companyMvrData.results.license_class,
                    totalPoints: companyMvrData.results.total_points,
                    violationCount: companyMvrData.results.violation_count,
                  }
                : null,
            }
          : null,

        // Work history & verifications
        workHistory:
          driverProfile?.employment_history ||
          developerProfile?.employment_history ||
          [],
        verifications: (verifications || []).map((v) => ({
          id: v.id,
          employer: v.previous_employer_name,
          position: v.claimed_position,
          startDate: v.claimed_start_date,
          endDate: v.claimed_end_date,
          status: v.status,
          verifiedAt: v.verified_at,
        })),

        // Scores
        completenessScore: careerCard.completeness_score,
        workHistoryCount: careerCard.work_history_count,
        verifiedJobsCount: careerCard.verified_jobs_count,

        // Flags
        hasProfile: careerCard.has_profile,
        hasResume: careerCard.has_resume,
        hasDriverApp: careerCard.has_driver_app,
        hasMvr: careerCard.has_mvr,
        hasWorkHistory: careerCard.has_work_history,

        // Company-specific context
        pendingRequests: pendingRequests || [],
        existingApplication,
        hasBgcheckConsent: !!bgcheckConsent,
        bgcheckConsentSignedAt: bgcheckConsent?.signed_at || null,
        bgcheckConsentFormData: bgcheckConsent?.form_data || null,
        installedBlockTypes,
      },
    })
  } catch (error) {
    console.error('[CAREER CARD] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
