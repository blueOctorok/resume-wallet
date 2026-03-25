import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

/**
 * GET /api/employer/hub
 *
 * Role-agnostic employer hub data. Returns universal applicant info only.
 * Role-specific data (CDL, MVR, DOT) is read from block tables when needed in the UI.
 *
 * Headers:
 *   x-wallet-address: User's wallet address
 *
 * Returns:
 *   - company: Employer's company profile
 *   - userRole: User's role within the company
 *   - jobPostings: All job postings with application counts
 *   - applicants: Recent applicants (universal fields only)
 *   - stats: Computed statistics
 *   - pipeline: Application status breakdown
 */
export async function GET(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, created_at, role, ava_auto_welcome_employer_at')
      .ilike('wallet_address', walletAddress)
      .single()

    if (userError || !user) {
      return NextResponse.json({
        success: true,
        isNewUser: true,
        avaAutoWelcomeEmployerDone: false,
        company: null,
        jobPostings: [],
        applicants: [],
        stats: {
          activeJobs: 0,
          totalApplicants: 0,
          pendingReview: 0,
          contacted: 0,
          archived: 0,
        },
        pipeline: {
          new: 0,
          contacted: 0,
          archived: 0,
        },
      })
    }

    // Check company_members first for team-based access
    const { data: membership } = await supabase
      .from('company_members')
      .select(`
        role,
        company_id,
        is_active,
        companies (*)
      `)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    let company = membership?.companies as any
    let userRole = membership?.role || null

    if (!company) {
      const { data: legacyCompany } = await supabase
        .from('companies')
        .select('*')
        .eq('employer_user_id', user.id)
        .maybeSingle()

      company = legacyCompany
      userRole = legacyCompany ? 'owner' : null
    }

    if (!company) {
      const { data: pendingAccess } = await supabase
        .from('employer_access_requests')
        .select('id, company_name, status, created_at, ai_reason')
        .ilike('wallet_address', walletAddress)
        .in('status', ['pending', 'flagged'])
        .maybeSingle()

      const hasPendingAccess = Boolean(pendingAccess)

      return NextResponse.json({
        success: true,
        isNewUser: false,
        // If they already submitted for review, do not loop them back into company-setup
        needsCompanySetup: !hasPendingAccess,
        employerAccessPending: hasPendingAccess
          ? {
              companyName: pendingAccess!.company_name,
              status: pendingAccess!.status,
              submittedAt: pendingAccess!.created_at,
              reviewNote: pendingAccess!.ai_reason,
            }
          : null,
        avaAutoWelcomeEmployerDone: Boolean(user.ava_auto_welcome_employer_at),
        company: null,
        userRole: null,
        jobPostings: [],
        applicants: [],
        stats: {
          activeJobs: 0,
          totalApplicants: 0,
          pendingReview: 0,
          contacted: 0,
          archived: 0,
        },
        pipeline: {
          new: 0,
          contacted: 0,
          archived: 0,
        },
        memberSince: user.created_at,
      })
    }

    // Fetch universal data in parallel — no role-specific queries
    const [jobPostingsResult, applicationsResult] = await Promise.all([
      supabase
        .from('job_postings')
        .select(`
          id, title, description, target_role, location_city, location_state,
          salary_min, salary_max, job_type, is_active, created_at, updated_at,
          experience_required, route_type, remote_allowed
        `)
        .eq('company_id', company.id)
        .order('created_at', { ascending: false }),

      // JOIN user_profiles for role-agnostic identity
      supabase
        .from('applications')
        .select(`
          id, status, applied_at, view_count, last_viewed_at, cover_letter,
          reviewer_notes, share_token,
          applicant_user_id,
          job_posting_id,
          job_postings!inner (
            id, title, company_id, target_role
          ),
          users!applications_applicant_user_id_fkey (
            id, wallet_address, email, role,
            user_profiles (
              first_name, last_name, phone, email, avatar_url, headline
            )
          ),
          resumes (
            id, title, filename, ipfs_hash, verification_status
          )
        `)
        .eq('job_postings.company_id', company.id)
        .order('applied_at', { ascending: false }),
    ])

    const applications = applicationsResult.data || []
    const jobPostings = (jobPostingsResult.data || []).map(job => {
      const jobApps = applications.filter(a => a.job_posting_id === job.id)
      return {
        id: job.id,
        title: job.title,
        description: job.description,
        targetRole: job.target_role,
        locationCity: job.location_city,
        locationState: job.location_state,
        salaryMin: job.salary_min,
        salaryMax: job.salary_max,
        jobType: job.job_type,
        isActive: job.is_active,
        createdAt: job.created_at,
        updatedAt: job.updated_at,
        experienceRequired: job.experience_required,
        routeType: job.route_type,
        remoteAllowed: job.remote_allowed,
        totalApplications: jobApps.length,
        newApplications: jobApps.filter(a => a.status === 'submitted').length,
        viewedApplications: jobApps.filter(a => a.view_count > 0).length,
      }
    })

    // Process applicants — universal fields only
    const applicants = applications.map(app => {
      const applicantUser = app.users as any
      const userProfiles = applicantUser?.user_profiles
      const profile = Array.isArray(userProfiles)
        ? userProfiles[0]
        : userProfiles
      const resume = Array.isArray(app.resumes) ? app.resumes[0] : app.resumes
      const jobPosting = app.job_postings as any

      return {
        applicationId: app.id,
        status: app.status,
        appliedAt: app.applied_at,
        viewCount: app.view_count || 0,
        lastViewedAt: app.last_viewed_at,
        coverLetter: app.cover_letter,
        reviewerNotes: app.reviewer_notes,
        shareToken: app.share_token,
        applicantUserId: app.applicant_user_id,
        applicantRole: applicantUser?.role || 'candidate',
        avatarUrl: profile?.avatar_url ?? null,
        applicantName: profile
          ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown'
          : 'Unknown',
        applicantEmail: profile?.email || applicantUser?.email || null,
        applicantPhone: profile?.phone || null,
        applicantHeadline: profile?.headline || null,
        jobPostingId: app.job_posting_id,
        jobTitle: jobPosting?.title || 'Unknown Position',
        jobTargetRole: jobPosting?.target_role || null,
        hasResume: !!resume,
        resumeId: resume?.id || null,
        resumeVerified: resume?.verification_status === 'VERIFIED',
      }
    })

    // Pipeline stats — submitted / contacted / archived only (migration 053)
    const pipeline = {
      new: applications.filter(a => a.status === 'submitted').length,
      contacted: applications.filter(a => a.status === 'contacted').length,
      archived: applications.filter(a => a.status === 'archived').length,
    }

    const thisMonth = new Date()
    thisMonth.setDate(1)
    thisMonth.setHours(0, 0, 0, 0)
    const archivedThisMonth = applications.filter(a =>
      a.status === 'archived' && new Date(a.applied_at) >= thisMonth
    ).length

    const stats = {
      activeJobs: jobPostings.filter(j => j.isActive).length,
      totalJobs: jobPostings.length,
      totalApplicants: applicants.length,
      pendingReview: pipeline.new,
      contacted: pipeline.contacted,
      archived: pipeline.archived,
      archivedThisMonth,
    }

    return NextResponse.json({
      success: true,
      isNewUser: false,
      needsCompanySetup: false,
      avaAutoWelcomeEmployerDone: Boolean(user.ava_auto_welcome_employer_at),
      company: {
        id: company.id,
        name: company.company_name,
        dotNumber: company.dot_number,
        mcNumber: company.mc_number,
        description: company.description,
        logoUrl: company.logo_url,
        verified: company.verified,
        companySize: company.company_size,
        industryType: company.industry_type,
        city: company.address_city,
        state: company.address_state,
        onboardingCompleted: company.onboarding_completed ?? false,
        walletAddress: company.wallet_address ?? null,
      },
      userRole,
      jobPostings,
      applicants,
      stats,
      pipeline,
      memberSince: user.created_at,
    })

  } catch (error) {
    console.error('[EMPLOYER HUB] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
