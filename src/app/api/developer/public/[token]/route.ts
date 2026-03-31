import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import {
  getDevProfile,
  getDevGithub,
  getDevPortfolio,
  getSkills,
  getEducation,
} from '@/lib/block-data'

/**
 * GET /api/developer/public/[token]
 *
 * Fetches a developer's public Career Card by share token.
 * No auth required. Respects share_settings (showPortfolio, showGitHub, showResume, showContact, allowConnect).
 *
 * share_token lookup uses the `users` table (migrated in 036).
 * Profile data comes from block tables + user_profiles.
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

    // share_token lives on users table (036_unified_share_token)
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, share_settings, share_views_count')
      .eq('share_token', token)
      .single()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Profile not found or sharing is disabled' },
        { status: 404 }
      )
    }

    const userId = user.id

    // Parallel reads from block tables + user_profiles
    const [devProfile, github, portfolio, skills, education, userProfileResult] = await Promise.all([
      getDevProfile(supabase, userId),
      getDevGithub(supabase, userId),
      getDevPortfolio(supabase, userId),
      getSkills(supabase, userId),
      getEducation(supabase, userId),
      supabase.from('user_profiles').select('first_name, last_name, display_name, email, phone, city, state, headline').eq('user_id', userId).maybeSingle(),
    ])

    const userProfile = userProfileResult.data

    const settings = (user.share_settings as {
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

    // Increment view count on users table (fire and forget)
    supabase
      .from('users')
      .update({ share_views_count: (user.share_views_count || 0) + 1 })
      .eq('id', userId)
      .then(() => {})
      .catch(() => {})

    const publicProfile: Record<string, unknown> = {
      id: devProfile?.id ?? userId,
      firstName: userProfile?.first_name ?? null,
      lastName: userProfile?.last_name ?? null,
      displayName: userProfile?.display_name ?? null,
      location: userProfile?.city && userProfile?.state
        ? `${userProfile.city}, ${userProfile.state}`
        : null,
      headline: userProfile?.headline ?? null,
      bio: devProfile?.bio ?? null,
      yearsExperience: devProfile?.years_experience ?? null,
      skills: skills ?? [],
      education: education ?? [],
      certifications: devProfile?.certifications ?? [],
      portfolioUrl: settings.showPortfolio
        ? (portfolio?.portfolio_url ?? null)
        : null,
      githubUsername: settings.showGitHub
        ? (github?.username ?? null)
        : null,
      linkedinUrl: portfolio?.linkedin_url ?? null,
      personalWebsite: portfolio?.personal_website ?? null,
    }

    if (settings.showContact) {
      publicProfile.contact = {
        email: userProfile?.email ?? null,
        phone: userProfile?.phone ?? null,
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
        .eq('user_id', userId)
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
      structuredData?: unknown
    } | null = null
    if (settings.showResume) {
      const { data: devResumeData } = await supabase
        .from('resumes')
        .select(
          'id, title, filename, ipfs_hash, verification_status, blockchain_tx_hash, created_at, resume_type, structured_data'
        )
        .eq('user_id', userId)
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
        const { data: resumeData } = await supabase
          .from('resumes')
          .select(
            'id, title, filename, ipfs_hash, verification_status, blockchain_tx_hash, created_at, resume_type'
          )
          .eq('user_id', userId)
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

    const githubUsername = github?.username
    if (settings.showGitHub && githubUsername) {
      const hasToken = !!github?.access_token
      const headers: Record<string, string> = {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Storm-CareerCard',
      }

      if (hasToken && github?.access_token) {
        headers.Authorization = `Bearer ${github.access_token}`
      }

      try {
        const userRes = await fetch(
          `https://api.github.com/user${hasToken ? '' : 's/' + githubUsername}`,
          { headers }
        )
        const userData = await userRes.json()

        if (userData && !userData.message) {
          const reposRes = await fetch(
            `https://api.github.com/${hasToken ? 'user/repos?per_page=100&sort=updated' : `users/${githubUsername}/repos?per_page=100&sort=updated`}`,
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
            repos: repos.slice(0, 6),
            languages,
          }
        }
      } catch (err) {
        console.error('[DEVELOPER PUBLIC] GitHub fetch error:', err)
      }
    }

    // Verified employment (for career card trust badges)
    const { data: verifiedRows } = await supabase
      .from('employment_verification_requests')
      .select('previous_employer_name, claimed_position, claimed_start_date, claimed_end_date, status')
      .eq('driver_id', userId)
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
      viewCount: (user.share_views_count || 0) + 1,
    })
  } catch (error) {
    console.error('[DEVELOPER PUBLIC] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
