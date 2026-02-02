import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

/**
 * GET /api/developer/hub
 *
 * Aggregates all developer data for the Developer Hub dashboard.
 * Single API call to fetch everything needed for the hub view.
 *
 * Headers:
 *   x-wallet-address: User's wallet address
 *
 * Returns:
 *   - profile: Developer profile (or null if not created)
 *   - projects: All portfolio projects
 *   - jobApplications: Job applications (shared with drivers)
 *   - stats: Computed statistics for quick view
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
      .select('id, email, created_at')
      .ilike('wallet_address', walletAddress)
      .single()

    if (userError || !user) {
      // User not found - return empty hub (new user state)
      return NextResponse.json({
        success: true,
        isNewUser: true,
        profile: null,
        projects: [],
        jobApplications: [],
        stats: {
          profileCompleteness: 0,
          totalProjects: 0,
          featuredProjects: 0,
          githubConnected: false,
          totalJobApplications: 0,
          pendingApplications: 0,
        },
      })
    }

    // Fetch all data in parallel for performance
    const [profileResult, projectsResult, jobAppsResult] = await Promise.all([
      // 1. Developer profile
      supabase
        .from('developer_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle(),

      // 2. All portfolio projects
      supabase
        .from('developer_projects')
        .select('*')
        .eq('user_id', user.id)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false }),

      // 3. Job applications (shared table with drivers)
      supabase
        .from('applications')
        .select(
          `
          id, status, applied_at, view_count,
          job_postings (
            title,
            companies (company_name)
          )
        `
        )
        .eq('driver_user_id', user.id) // TODO: Add developer_user_id column or rename to user_id
        .order('applied_at', { ascending: false }),
    ])

    // Process profile
    const profile = profileResult.data || null

    // Process projects
    const projects = (projectsResult.data || []).map((project) => ({
      id: project.id,
      title: project.title,
      description: project.description,
      longDescription: project.long_description,
      techStack: project.tech_stack || [],
      liveUrl: project.live_url,
      repoUrl: project.repo_url,
      demoVideoUrl: project.demo_video_url,
      thumbnailUrl: project.thumbnail_url,
      screenshots: project.screenshots || [],
      role: project.role,
      teamSize: project.team_size,
      startDate: project.start_date,
      endDate: project.end_date,
      isOngoing: project.is_ongoing,
      isFeatured: project.is_featured,
      isPublic: project.is_public,
      displayOrder: project.display_order,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
    }))

    // Process job applications
    const jobApplications = (jobAppsResult.data || []).map((app) => {
      const jobPosting = app.job_postings as {
        title: string
        companies: { company_name: string } | null
      } | null
      return {
        id: app.id,
        status: app.status,
        appliedAt: app.applied_at,
        viewCount: app.view_count || 0,
        jobTitle: jobPosting?.title || 'Unknown Position',
        companyName: jobPosting?.companies?.company_name || 'Unknown Company',
      }
    })

    // Calculate statistics
    const totalProjects = projects.length
    const featuredProjects = projects.filter((p) => p.isFeatured).length
    const githubConnected = !!profile?.github_username
    const totalJobApplications = jobApplications.length
    const pendingApplications = jobApplications.filter(
      (a) => a.status === 'pending'
    ).length

    // Calculate profile completeness (weighted)
    // Basic profile: 15%, Headline/Bio: 15%, Projects: 25%, Skills: 15%, GitHub: 20%, Job prefs: 10%
    let profileCompleteness = 15 // Base for having an account
    if (profile) {
      if (profile.headline || profile.bio) profileCompleteness += 15
      if ((profile.skills as unknown[])?.length > 0) profileCompleteness += 15
      if (profile.github_username) profileCompleteness += 20
      if (profile.job_types?.length > 0 || profile.work_styles?.length > 0)
        profileCompleteness += 10
    }
    if (totalProjects > 0) profileCompleteness += 25

    return NextResponse.json({
      success: true,
      isNewUser: false,
      profile: profile
        ? {
            id: profile.id,
            firstName: profile.first_name,
            lastName: profile.last_name,
            displayName: profile.display_name,
            email: profile.email || user.email,
            phone: profile.phone,
            location: profile.location,
            headline: profile.headline,
            bio: profile.bio,
            yearsExperience: profile.years_experience,
            githubUsername: profile.github_username,
            githubConnectedAt: profile.github_connected_at,
            githubData: profile.github_data,
            portfolioUrl: profile.portfolio_url,
            linkedinUrl: profile.linkedin_url,
            twitterUrl: profile.twitter_url,
            personalWebsite: profile.personal_website,
            skills: profile.skills || [],
            jobTypes: profile.job_types || [],
            workStyles: profile.work_styles || [],
            willingToRelocate: profile.willing_to_relocate,
            desiredSalaryMin: profile.desired_salary_min,
            desiredSalaryMax: profile.desired_salary_max,
            availableForWork: profile.available_for_work,
            availableFrom: profile.available_from,
            education: profile.education || [],
            certifications: profile.certifications || [],
            createdAt: profile.created_at,
            updatedAt: profile.updated_at,
          }
        : null,
      projects,
      jobApplications,
      stats: {
        profileCompleteness,
        totalProjects,
        featuredProjects,
        githubConnected,
        totalJobApplications,
        pendingApplications,
      },
      memberSince: user.created_at,
    })
  } catch (error) {
    console.error('[DEVELOPER HUB] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch developer hub data' },
      { status: 500 }
    )
  }
}
