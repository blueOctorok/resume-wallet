import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

/**
 * GET /api/employer/talent/[userId]
 * 
 * Gets the full career card data for a specific candidate.
 * Returns profile, resume, credentials, work history, and verification status.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    const { userId } = await params

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 401 }
      )
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
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
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
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
      return NextResponse.json(
        { error: 'No company access' },
        { status: 403 }
      )
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
        { status: 404 }
      )
    }

    // Get additional details not in the view

    // 1. User basic info
    const { data: candidate } = await supabase
      .from('users')
      .select('id, email, role, created_at')
      .eq('id', userId)
      .single()

    // 2. Driver profile details (if driver)
    let driverProfile = null
    if (careerCard.driver_profile_id) {
      const { data: dp } = await supabase
        .from('driver_profiles')
        .select(`
          id, first_name, middle_name, last_name, email, phone,
          address, city, state, zip_code, professional_summary,
          cdl_class, cdl_state, cdl_number, cdl_expiration,
          endorsements, cdl_endorsements, restrictions,
          experience_years, employment_history, education, skills,
          share_token, share_settings, created_at
        `)
        .eq('id', careerCard.driver_profile_id)
        .single()

      driverProfile = dp
    }

    // 3. Developer profile (if developer)
    let developerProfile = null
    if (candidate?.role === 'developer') {
      const { data: devp } = await supabase
        .from('developer_profiles')
        .select(`
          id, full_name, email, phone, location, professional_summary,
          title, years_experience, employment_history,
          github_url, linkedin_url, portfolio_url,
          skills, education, share_token, share_settings
        `)
        .eq('user_id', userId)
        .single()

      developerProfile = devp
    }

    // 4. Latest resume with structured data
    let resume = null
    if (careerCard.resume_id) {
      const { data: res } = await supabase
        .from('resumes')
        .select(`
          id, title, filename, ipfs_hash, verification_status,
          structured_data, created_at
        `)
        .eq('id', careerCard.resume_id)
        .single()

      resume = res
    }

    // 5. Driver application (DOT form)
    let driverApplication = null
    if (careerCard.driver_application_id) {
      const { data: da } = await supabase
        .from('driver_applications')
        .select(`
          id, verification_status, is_complete, created_at
        `)
        .eq('id', careerCard.driver_application_id)
        .single()

      driverApplication = da
    }

    // 6. MVR data
    let mvrData = null
    if (careerCard.latest_mvr_id) {
      const { data: mvr } = await supabase
        .from('mvr_orders')
        .select(`
          id, status, dl_state, created_at, completed_at,
          ordered_by_company_id
        `)
        .eq('id', careerCard.latest_mvr_id)
        .single()

      if (mvr) {
        // Get MVR results
        const { data: mvrResults } = await supabase
          .from('mvr_results')
          .select(`
            id, license_status, license_class, total_points,
            violation_count, parsed_data
          `)
          .eq('mvr_order_id', mvr.id)
          .single()

        mvrData = {
          order: mvr,
          results: mvrResults,
          wasOrderedByEmployer: !!mvr.ordered_by_company_id,
        }
      }
    }

    // 7. Employment verifications
    const { data: verifications } = await supabase
      .from('employment_verification_requests')
      .select(`
        id, previous_employer_name, claimed_position,
        claimed_start_date, claimed_end_date, status,
        verified_at, created_at
      `)
      .eq('driver_id', userId)
      .order('created_at', { ascending: false })

    // 8. Pending requests from this company
    const { data: pendingRequests } = await supabase
      .from('candidate_requests')
      .select('id, request_type, status, created_at')
      .eq('candidate_user_id', userId)
      .eq('company_id', companyId)
      .in('status', ['pending', 'viewed'])

    // 9. Existing applications to company's jobs
    const { data: companyJobs } = await supabase
      .from('job_postings')
      .select('id')
      .eq('company_id', companyId)

    const jobIds = (companyJobs || []).map(j => j.id)
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

    // Build the response
    const profile = driverProfile || developerProfile
    const fullName = driverProfile
      ? `${driverProfile.first_name || ''} ${driverProfile.middle_name || ''} ${driverProfile.last_name || ''}`.replace(/\s+/g, ' ').trim()
      : developerProfile?.full_name || 'Unknown'

    return NextResponse.json({
      success: true,
      careerCard: {
        // Basic info
        userId: candidate?.id,
        role: candidate?.role,
        name: fullName || careerCard.full_name || 'Unknown',
        email: profile?.email || candidate?.email,
        phone: profile?.phone,
        location: profile?.city && profile?.state
          ? `${profile.city}, ${profile.state}`
          : profile?.location || careerCard.state,
        memberSince: candidate?.created_at,

        // Profile
        profile: profile ? {
          ...profile,
          fullName,
        } : null,

        // Resume
        resume: resume ? {
          id: resume.id,
          title: resume.title,
          filename: resume.filename,
          ipfsHash: resume.ipfs_hash,
          verificationStatus: resume.verification_status,
          structuredData: resume.structured_data,
          createdAt: resume.created_at,
        } : null,

        // Driver-specific
        driverApplication: driverApplication ? {
          id: driverApplication.id,
          status: driverApplication.verification_status,
          isComplete: driverApplication.is_complete,
          createdAt: driverApplication.created_at,
        } : null,

        // MVR
        mvr: mvrData ? {
          orderId: mvrData.order.id,
          orderStatus: mvrData.order.status,
          licenseState: mvrData.order.dl_state,
          orderedAt: mvrData.order.created_at,
          completedAt: mvrData.order.completed_at,
          wasOrderedByEmployer: mvrData.wasOrderedByEmployer,
          results: mvrData.results ? {
            licenseStatus: mvrData.results.license_status,
            licenseClass: mvrData.results.license_class,
            totalPoints: mvrData.results.total_points,
            violationCount: mvrData.results.violation_count,
          } : null,
        } : null,

        // Work history & verifications
        workHistory: driverProfile?.employment_history || developerProfile?.employment_history || [],
        verifications: (verifications || []).map(v => ({
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
      },
    })

  } catch (error) {
    console.error('[CAREER CARD] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
