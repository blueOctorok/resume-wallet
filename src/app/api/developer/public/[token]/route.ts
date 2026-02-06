import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

/**
 * GET /api/developer/public/[token]
 *
 * Fetches a developer's public Career Card by share token.
 * No auth required. Respects share_settings (showPortfolio, showGitHub, showResume, showContact, allowConnect).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    if (!token || token.length < 8) {
      return NextResponse.json(
        { error: 'Invalid share token' },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    const { data: profile, error: profileError } = await supabase
      .from('developer_profiles')
      .select(
        `
        id,
        user_id,
        first_name,
        last_name,
        display_name,
        email,
        phone,
        location,
        headline,
        bio,
        years_experience,
        github_username,
        github_access_token,
        portfolio_url,
        linkedin_url,
        personal_website,
        skills,
        education,
        certifications,
        share_settings,
        share_views_count
      `
      )
      .eq('share_token', token)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profile not found or sharing is disabled' },
        { status: 404 }
      )
    }

    const settings = (profile.share_settings as {
      showResume?: boolean
      showPortfolio?: boolean
      showGitHub?: boolean
      showContact?: boolean
      allowConnect?: boolean
    }) ?? {
      showResume: true,
      showPortfolio: true,
      showGitHub: true,
      showContact: false,
      allowConnect: true,
    }

    // Increment view count (fire and forget)
    supabase
      .from('developer_profiles')
      .update({ share_views_count: (profile.share_views_count || 0) + 1 })
      .eq('id', profile.id)
      .then(() => {})
      .catch(() => {})

    const publicProfile: Record<string, unknown> = {
      id: profile.id,
      firstName: profile.first_name,
      lastName: profile.last_name,
      displayName: profile.display_name,
      location: profile.location ?? null,
      headline: profile.headline ?? null,
      bio: profile.bio ?? null,
      yearsExperience: profile.years_experience ?? null,
      skills: profile.skills ?? [],
      education: profile.education ?? [],
      certifications: profile.certifications ?? [],
      portfolioUrl: settings.showPortfolio
        ? (profile.portfolio_url ?? null)
        : null,
      githubUsername: settings.showGitHub
        ? (profile.github_username ?? null)
        : null,
      linkedinUrl: profile.linkedin_url ?? null,
      personalWebsite: profile.personal_website ?? null,
    }

    if (settings.showContact) {
      publicProfile.contact = {
        email: profile.email ?? null,
        phone: profile.phone ?? null,
      }
    }

    let projects: Array<{
      id: string
      title: string
      description: string | null
      techStack: string[]
      liveUrl: string | null
      repoUrl: string | null
      demoVideoUrl: string | null
      isFeatured: boolean
    }> = []
    if (settings.showPortfolio) {
      const { data: projectsData } = await supabase
        .from('developer_projects')
        .select(
          'id, title, description, tech_stack, live_url, repo_url, demo_video_url, is_featured'
        )
        .eq('user_id', profile.user_id)
        .eq('is_public', true)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false })

      projects = (projectsData ?? []).map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description ?? null,
        techStack: (p.tech_stack as string[]) ?? [],
        liveUrl: p.live_url ?? null,
        repoUrl: p.repo_url ?? null,
        demoVideoUrl: p.demo_video_url ?? null,
        isFeatured: p.is_featured ?? false,
      }))
    }

    let resume: {
      id: string
      title: string
      filename: string
      verified: boolean
      blockchainVerified: boolean
      type: string
      createdAt: string
      ipfsHash: string | null
      structuredData?: unknown // Developer resume structured data for preview
    } | null = null
    if (settings.showResume) {
      // First try to get a developer-built resume (preferred for preview)
      const { data: devResumeData } = await supabase
        .from('resumes')
        .select(
          'id, title, filename, ipfs_hash, verification_status, blockchain_tx_hash, created_at, resume_type, structured_data'
        )
        .eq('user_id', profile.user_id)
        .eq('resume_type', 'developer_built')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (devResumeData) {
        resume = {
          id: devResumeData.id,
          title: devResumeData.title ?? devResumeData.filename,
          filename: devResumeData.filename,
          verified: devResumeData.verification_status === 'VERIFIED',
          blockchainVerified: !!devResumeData.blockchain_tx_hash,
          type: 'developer_built',
          createdAt: devResumeData.created_at,
          ipfsHash: devResumeData.ipfs_hash ?? null,
          structuredData: devResumeData.structured_data,
        }
      } else {
        // Fall back to any verified resume
        const { data: resumeData } = await supabase
          .from('resumes')
          .select(
            'id, title, filename, ipfs_hash, verification_status, blockchain_tx_hash, created_at, resume_type'
          )
          .eq('user_id', profile.user_id)
          .eq('verification_status', 'VERIFIED')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (resumeData) {
          resume = {
            id: resumeData.id,
            title: resumeData.title ?? resumeData.filename,
            filename: resumeData.filename,
            verified: resumeData.verification_status === 'VERIFIED',
            blockchainVerified: !!resumeData.blockchain_tx_hash,
            type: (resumeData.resume_type as string) ?? 'file',
            createdAt: resumeData.created_at,
            ipfsHash: resumeData.ipfs_hash ?? null,
          }
        }
      }
    }

    // Fetch GitHub data if GitHub is enabled and connected
    let githubData: {
      connected: boolean
      publicRepos: number
      privateRepos: number
      totalRepos: number
      followers: number
      following: number
      publicGists: number
      avatarUrl: string
      bio: string | null
      repos: Array<{
        name: string
        description: string | null
        stars: number
        forks: number
        language: string | null
        url: string
        isPrivate: boolean
      }>
      languages: Array<{ language: string; count: number; percentage: number }>
    } | null = null

    if (settings.showGitHub && profile.github_username) {
      const hasToken = !!profile.github_access_token
      const headers: Record<string, string> = {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'StormChain-CareerCard',
      }

      // Use OAuth token if available for private data
      if (hasToken && profile.github_access_token) {
        headers.Authorization = `Bearer ${profile.github_access_token}`
      }

      try {
        // Fetch user profile
        const userRes = await fetch(
          `https://api.github.com/user${hasToken ? '' : 's/' + profile.github_username}`,
          { headers }
        )
        const userData = await userRes.json()

        if (userData && !userData.message) {
          // Fetch repos (with token, includes private)
          const reposRes = await fetch(
            `https://api.github.com/${hasToken ? 'user/repos?per_page=100&sort=updated' : `users/${profile.github_username}/repos?per_page=100&sort=updated`}`,
            { headers }
          )
          const reposData = await reposRes.json()

          const repos = Array.isArray(reposData)
            ? reposData
                .map((r: Record<string, unknown>) => ({
                  name: r.name as string,
                  description: r.description as string | null,
                  stars: (r.stargazers_count as number) ?? 0,
                  forks: (r.forks_count as number) ?? 0,
                  language: r.language as string | null,
                  url: r.html_url as string,
                  isPrivate: (r.private as boolean) ?? false,
                  updatedAt: r.updated_at as string,
                }))
                .sort(
                  (a, b) =>
                    b.stars - a.stars ||
                    new Date(b.updatedAt).getTime() -
                      new Date(a.updatedAt).getTime()
                )
            : []

          // Calculate language stats
          const langCount: Record<string, number> = {}
          repos.forEach((r) => {
            if (r.language) {
              langCount[r.language] = (langCount[r.language] || 0) + 1
            }
          })
          const totalLangs = Object.values(langCount).reduce((a, b) => a + b, 0)
          const languages = Object.entries(langCount)
            .map(([language, count]) => ({
              language,
              count,
              percentage: Math.round((count / totalLangs) * 100),
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 6)

          githubData = {
            connected: hasToken,
            publicRepos: userData.public_repos ?? 0,
            privateRepos: hasToken
              ? (userData.total_private_repos ??
                userData.owned_private_repos ??
                0)
              : 0,
            totalRepos: repos.length,
            followers: userData.followers ?? 0,
            following: userData.following ?? 0,
            publicGists: userData.public_gists ?? 0,
            avatarUrl: userData.avatar_url ?? '',
            bio: userData.bio ?? null,
            repos: repos.slice(0, 6), // Top 6 repos
            languages,
          }
        }
      } catch (err) {
        console.error('[DEVELOPER PUBLIC] GitHub fetch error:', err)
        // Continue without GitHub data
      }
    }

    // Verified employment (for career card trust badges)
    const { data: verifiedRows } = await supabase
      .from('employment_verification_requests')
      .select('previous_employer_name, claimed_position, claimed_start_date, claimed_end_date, status')
      .eq('driver_id', profile.user_id)
      .eq('applicant_type', 'developer')
      .in('status', ['VERIFIED', 'PARTIALLY_VERIFIED'])
      .order('verified_at', { ascending: false })

    const verifiedEmployments = (verifiedRows ?? []).map((r) => ({
      companyName: r.previous_employer_name,
      position: r.claimed_position,
      startDate: r.claimed_start_date ?? null,
      endDate: r.claimed_end_date ?? null,
      status: r.status,
    }))

    return NextResponse.json({
      success: true,
      profile: publicProfile,
      projects,
      resume,
      githubData,
      verifiedEmployments,
      settings: {
        allowConnect: settings.allowConnect ?? true,
      },
      viewCount: (profile.share_views_count || 0) + 1,
    })
  } catch (error) {
    console.error('[DEVELOPER PUBLIC] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
