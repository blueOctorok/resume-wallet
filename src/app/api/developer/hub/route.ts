import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getDevGithub, getDevPortfolio, getDevProfile, getSkills, getEducation } from '@/lib/block-data'

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

    // Fetch all data in parallel — reads from block tables
    const [userProfileResult, devProfileResult, devGithubResult, devPortfolioResult, skillsResult, educationResult, projectsResult, jobAppsResult] = await Promise.all([
      supabase.from('user_profiles').select('first_name, last_name, avatar_url, headline, email, phone, city, state, display_name, professional_summary').eq('user_id', user.id).maybeSingle(),
      getDevProfile(supabase, user.id),
      getDevGithub(supabase, user.id),
      getDevPortfolio(supabase, user.id),
      getSkills(supabase, user.id),
      getEducation(supabase, user.id),
      supabase
        .from('developer_projects')
        .select('*')
        .eq('user_id', user.id)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false }),
      supabase
        .from('applications')
        .select(`id, status, applied_at, view_count, job_postings (title, companies (company_name))`)
        .eq('driver_user_id', user.id)
        .order('applied_at', { ascending: false }),
    ])

    // Unpack block data
    const userProfile = userProfileResult.data
    const devProfile = devProfileResult
    const devGithub = devGithubResult
    const devPortfolio = devPortfolioResult
    const skills = skillsResult
    const education = educationResult
    const hasAnyProfile = userProfile || devProfile || devGithub || devPortfolio

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
    const githubConnected = !!devGithub?.access_token
    const totalJobApplications = jobApplications.length
    const pendingApplications = jobApplications.filter(
      (a) => a.status === 'pending'
    ).length

    // Calculate profile completeness (weighted)
    // Basic profile: 15%, Headline/Bio: 15%, Projects: 25%, Skills: 15%, GitHub: 20%, Job prefs: 10%
    let profileCompleteness = 15 // Base for having an account
    if (hasAnyProfile) {
      if (userProfile?.headline || devProfile?.bio) profileCompleteness += 15
      if (skills.length > 0) profileCompleteness += 15
      if (devGithub?.username) profileCompleteness += 20
      if (devProfile?.job_types?.length > 0 || devProfile?.work_styles?.length > 0)
        profileCompleteness += 10
    }
    if (totalProjects > 0) profileCompleteness += 25

    return NextResponse.json({
      success: true,
      isNewUser: false,
      userId: user.id, // The users table ID - needed for career score API
      profile: hasAnyProfile ? {
        id: null,
        firstName: userProfile?.first_name ?? null,
        lastName: userProfile?.last_name ?? null,
        displayName: userProfile?.display_name ?? null,
        email: userProfile?.email || user.email,
        phone: userProfile?.phone ?? null,
        location: userProfile?.city && userProfile?.state ? `${userProfile.city}, ${userProfile.state}` : null,
        headline: userProfile?.headline ?? null,
        bio: devProfile?.bio ?? userProfile?.professional_summary ?? null,
        yearsExperience: devProfile?.years_experience ?? null,
        githubUsername: devGithub?.username ?? null,
        githubConnected: !!devGithub?.access_token,
        githubConnectedAt: devGithub?.connected_at ?? null,
        githubData: devGithub?.data ?? null,
        portfolioUrl: devPortfolio?.portfolio_url ?? null,
        linkedinUrl: devPortfolio?.linkedin_url ?? null,
        twitterUrl: devPortfolio?.twitter_url ?? null,
        personalWebsite: devPortfolio?.personal_website ?? null,
        avatarUrl: userProfile?.avatar_url ?? null,
        skills: skills,
        jobTypes: devProfile?.job_types ?? [],
        workStyles: devProfile?.work_styles ?? [],
        willingToRelocate: devProfile?.willing_to_relocate ?? false,
        desiredSalaryMin: null,
        desiredSalaryMax: null,
        availableForWork: devProfile?.available_for_work ?? false,
        availableFrom: null,
        education: education,
        certifications: devProfile?.certifications ?? [],
        createdAt: null,
        updatedAt: null,
      } : null,
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
