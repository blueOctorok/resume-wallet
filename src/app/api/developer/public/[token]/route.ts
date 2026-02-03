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
    } | null = null
    if (settings.showResume) {
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

    return NextResponse.json({
      success: true,
      profile: publicProfile,
      projects,
      resume,
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
