import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

/**
 * GET /api/employer/hub
 * 
 * Aggregates all employer data for the Employer Hub dashboard.
 * Single API call to fetch everything needed for the hub view.
 * 
 * Now supports team-based access via company_members table.
 * 
 * Headers:
 *   x-wallet-address: User's wallet address
 * 
 * Returns:
 *   - company: Employer's company profile
 *   - userRole: User's role within the company (owner, admin, recruiter, etc.)
 *   - jobPostings: All job postings with application counts
 *   - applicants: Recent applicants across all jobs
 *   - mvrOrders: MVR orders placed for applicants
 *   - stats: Computed statistics for quick view
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

    // Get user by wallet address
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, created_at, role')
      .ilike('wallet_address', walletAddress)
      .single()

    if (userError || !user) {
      // User not found - return empty hub (new user state)
      return NextResponse.json({
        success: true,
        isNewUser: true,
        company: null,
        jobPostings: [],
        applicants: [],
        mvrOrders: [],
        stats: {
          activeJobs: 0,
          totalApplicants: 0,
          pendingReview: 0,
          interviewing: 0,
          hiresThisMonth: 0,
          totalMvrOrders: 0,
        },
        pipeline: {
          new: 0,
          reviewing: 0,
          interviewing: 0,
          offerSent: 0,
          hired: 0,
          rejected: 0,
        }
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

    // Fall back to legacy employer_user_id check if no membership found
    let company = membership?.companies as any
    let userRole = membership?.role || null

    if (!company) {
      const { data: legacyCompany } = await supabase
        .from('companies')
        .select('*')
        .eq('employer_user_id', user.id)
        .maybeSingle()
      
      company = legacyCompany
      userRole = legacyCompany ? 'owner' : null // Legacy single-owner is always owner
    }

    // If no company, return empty state (employer needs to create company first)
    if (!company) {
      return NextResponse.json({
        success: true,
        isNewUser: false,
        needsCompanySetup: true,
        company: null,
        userRole: null,
        jobPostings: [],
        applicants: [],
        mvrOrders: [],
        stats: {
          activeJobs: 0,
          totalApplicants: 0,
          pendingReview: 0,
          interviewing: 0,
          hiresThisMonth: 0,
          totalMvrOrders: 0,
        },
        pipeline: {
          new: 0,
          reviewing: 0,
          interviewing: 0,
          offerSent: 0,
          hired: 0,
          rejected: 0,
        },
        memberSince: user.created_at,
      })
    }

    // Fetch all data in parallel for performance
    const [
      jobPostingsResult,
      applicationsResult,
      mvrOrdersResult,
    ] = await Promise.all([
      // 1. All job postings for this company
      supabase
        .from('job_postings')
        .select(`
          id, title, description, target_role, location_city, location_state,
          salary_min, salary_max, job_type, is_active, created_at, updated_at,
          experience_required, route_type, remote_allowed
        `)
        .eq('company_id', company.id)
        .order('created_at', { ascending: false }),

      // 2. All applications to this company's jobs
      // Note: applicant_user_id was renamed from driver_user_id in migration 016
      // driver_profiles must be nested inside users (join path: applications → users → driver_profiles)
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
            driver_profiles (
              first_name, last_name, phone, email,
              cdl_number, cdl_class, cdl_state, cdl_expiration,
              experience_years
            )
          ),
          resumes (
            id, title, filename, ipfs_hash, verification_status
          )
        `)
        .eq('job_postings.company_id', company.id)
        .order('applied_at', { ascending: false }),

      // 3. MVR orders placed by this employer for applicants
      supabase
        .from('mvr_orders')
        .select(`
          id, status, dl_state, created_at, completed_at, fee_amount,
          driver_user_id,
          mvr_results (
            id, license_status, total_points, violation_count, result_status
          )
        `)
        .eq('employer_user_id', user.id)
        .order('created_at', { ascending: false }),
    ])

    // Process job postings with application counts
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
        // Computed counts
        totalApplications: jobApps.length,
        newApplications: jobApps.filter(a => a.status === 'submitted').length,
        viewedApplications: jobApps.filter(a => a.view_count > 0).length,
      }
    })

    // Process applicants (flatten from applications)
    // Generic naming: "applicant" instead of "driver" for role-agnostic support
    const applicants = applications.map(app => {
      const applicantUser = app.users as any
      // driver_profiles is now nested inside users (correct join path)
      const driverProfiles = applicantUser?.driver_profiles
      const driverProfile = Array.isArray(driverProfiles) 
        ? driverProfiles[0] 
        : driverProfiles
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
        // Applicant info (generic)
        applicantUserId: app.applicant_user_id,
        applicantRole: applicantUser?.role || 'driver', // driver, developer, etc.
        applicantName: driverProfile 
          ? `${driverProfile.first_name || ''} ${driverProfile.last_name || ''}`.trim() || 'Unknown'
          : 'Unknown',
        applicantEmail: driverProfile?.email || applicantUser?.email || null,
        applicantPhone: driverProfile?.phone || null,
        // CDL info (driver-specific, null for other roles)
        cdlClass: driverProfile?.cdl_class || null,
        cdlState: driverProfile?.cdl_state || null,
        cdlExpiration: driverProfile?.cdl_expiration || null,
        experienceYears: driverProfile?.experience_years || null,
        // Job info
        jobPostingId: app.job_posting_id,
        jobTitle: jobPosting?.title || 'Unknown Position',
        jobTargetRole: jobPosting?.target_role || 'driver',
        // Resume info
        hasResume: !!resume,
        resumeId: resume?.id || null,
        resumeVerified: resume?.verification_status === 'VERIFIED',
        // Legacy aliases for backward compatibility
        driverUserId: app.applicant_user_id,
        driverName: driverProfile 
          ? `${driverProfile.first_name || ''} ${driverProfile.last_name || ''}`.trim() || 'Unknown'
          : 'Unknown',
        driverEmail: driverProfile?.email || applicantUser?.email || null,
        driverPhone: driverProfile?.phone || null,
      }
    })

    // Process MVR orders
    const mvrOrders = (mvrOrdersResult.data || []).map(order => {
      const result = Array.isArray(order.mvr_results) 
        ? order.mvr_results[0] 
        : order.mvr_results
      
      // Find applicant name for this MVR (using applicantUserId or legacy driverUserId)
      const applicant = applicants.find(a => a.applicantUserId === order.driver_user_id)
      
      return {
        id: order.id,
        status: order.status,
        licenseState: order.dl_state,
        createdAt: order.created_at,
        completedAt: order.completed_at,
        feeAmount: order.fee_amount,
        driverUserId: order.driver_user_id,
        driverName: applicant?.driverName || 'Unknown',
        // Result data
        hasResult: !!result,
        licenseStatus: result?.license_status || null,
        totalPoints: result?.total_points || null,
        violationCount: result?.violation_count || 0,
        resultStatus: result?.result_status || null,
      }
    })

    // Calculate pipeline stats
    const pipeline = {
      new: applications.filter(a => a.status === 'submitted').length,
      reviewing: applications.filter(a => a.status === 'reviewing' || a.status === 'viewed').length,
      interviewing: applications.filter(a => ['interview', 'interviewing'].includes(a.status)).length,
      offerSent: applications.filter(a => a.status === 'offer_sent' || a.status === 'offer').length,
      hired: applications.filter(a => a.status === 'hired').length,
      rejected: applications.filter(a => a.status === 'rejected').length,
    }

    // Calculate this month's hires
    const thisMonth = new Date()
    thisMonth.setDate(1)
    thisMonth.setHours(0, 0, 0, 0)
    const hiresThisMonth = applications.filter(a => 
      a.status === 'hired' && new Date(a.applied_at) >= thisMonth
    ).length

    // Calculate stats
    const stats = {
      activeJobs: jobPostings.filter(j => j.isActive).length,
      totalJobs: jobPostings.length,
      totalApplicants: applicants.length,
      pendingReview: pipeline.new,
      interviewing: pipeline.interviewing,
      hiresThisMonth,
      totalHires: pipeline.hired,
      totalMvrOrders: mvrOrders.length,
      completedMvrOrders: mvrOrders.filter(m => m.status === 'completed').length,
    }

    return NextResponse.json({
      success: true,
      isNewUser: false,
      needsCompanySetup: false,
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
      },
      // User's role within the company (owner, admin, hr_manager, hiring_manager, recruiter, interviewer, viewer)
      userRole,
      jobPostings,
      applicants,
      mvrOrders,
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
