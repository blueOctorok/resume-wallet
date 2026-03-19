import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getUserByWallet } from '@/lib/user-by-wallet'
import { getBlockDefinition } from '@/lib/block-registry'
import {
  getCdlData,
  getDevPortfolio,
  getDevGithub,
  getSkills,
  getDriverEmployment,
  getDevProfile,
} from '@/lib/block-data'
import type {
  ProjectedCareerCard,
  CareerCardSection,
  SectionBlockType,
  ResumeData,
  DotAppData,
  MvrData,
  CdlData,
  PortfolioData,
  GitHubData,
  ProjectsData,
  SkillsData,
  WorkHistoryData,
} from '@/types/career-card'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * GET /api/career-card
 *
 * Builds a projected career card from the user's installed hub blocks.
 *
 * Auth modes:
 *   - `x-wallet-address` header → self-view (authenticated user)
 *   - `?token=xxx` query param → public view (no auth, share token lookup)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await getAdminSupabaseClient()

    const walletAddress = request.headers.get('x-wallet-address')
    const { searchParams } = new URL(request.url)
    const shareToken = searchParams.get('token')

    let userId: string
    let userName: string
    let avatarUrl: string | null = null
    let memberSince: string
    let shareTokenValue: string | null = null
    let shareSettings = { showContact: false, allowConnect: true }
    let viewCount: number | undefined
    let isPublicView = false

    if (shareToken) {
      // ── Public view via share token ──
      isPublicView = true
      const { data: user } = await supabase
        .from('users')
        .select('id, email, role, created_at, share_token, share_settings, share_views_count')
        .eq('share_token', shareToken)
        .single()

      if (!user) {
        return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
      }

      userId = user.id
      memberSince = user.created_at
      shareTokenValue = user.share_token
      shareSettings = user.share_settings ?? shareSettings
      viewCount = user.share_views_count ?? 0

      // Increment view count
      await supabase
        .from('users')
        .update({ share_views_count: (viewCount ?? 0) + 1 })
        .eq('id', userId)

    } else if (walletAddress) {
      // ── Self view via wallet ──
      const user = await getUserByWallet(supabase, walletAddress)
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      userId = user.id
      memberSince = user.created_at ?? new Date().toISOString()
      shareTokenValue = (user as Record<string, unknown>).share_token as string | null ?? null
      shareSettings = (user as Record<string, unknown>).share_settings as typeof shareSettings ?? shareSettings

    } else {
      return NextResponse.json({ error: 'Wallet address or share token required' }, { status: 401 })
    }

    // ── Fetch user's profile + onboarding context ──
    const [userProfile, onboarding] = await Promise.all([
      supabase
        .from('user_profiles')
        .select('first_name, last_name, avatar_url, headline, email, phone, city, state, professional_summary')
        .eq('user_id', userId)
        .maybeSingle()
        .then(r => r.data),
      supabase
        .from('hub_onboarding')
        .select('occupation')
        .eq('user_id', userId)
        .maybeSingle()
        .then(r => r.data),
    ])

    const upName = [userProfile?.first_name, userProfile?.last_name].filter(Boolean).join(' ')
    userName = upName || 'Candidate'
    avatarUrl = userProfile?.avatar_url ?? null

    const location = userProfile?.city && userProfile?.state
      ? `${userProfile.city}, ${userProfile.state}`
      : null

    const summary = userProfile?.professional_summary ?? null

    const contact = (shareSettings.showContact || !isPublicView)
      ? {
          email: userProfile?.email ?? null,
          phone: userProfile?.phone ?? null,
        }
      : undefined

    // ── Fetch installed hub blocks ──
    const { data: hubBlocks } = await supabase
      .from('hub_blocks')
      .select('block_type')
      .eq('user_id', userId)
      .order('position', { ascending: true })

    const installedTypes = (hubBlocks ?? []).map(b => b.block_type)

    // ── Build sections from installed blocks ──
    const sections: CareerCardSection[] = []

    for (const blockType of installedTypes) {
      const def = getBlockDefinition(blockType)
      if (!def || !def.appearsOnCareerCard) continue

      const sectionData = await fetchSectionData(supabase, userId, blockType as SectionBlockType, avatarUrl)
      if (!sectionData) continue

      sections.push({
        blockType: blockType as SectionBlockType,
        label: def.label,
        icon: def.icon,
        data: sectionData,
      })
    }

    const card: ProjectedCareerCard = {
      userId,
      name: userName,
      avatarUrl,
      occupation: userProfile?.headline ?? onboarding?.occupation ?? null,
      professionalSummary: summary,
      location,
      memberSince,
      shareToken: shareTokenValue,
      sections,
      settings: shareSettings,
      contact,
      viewCount: isPublicView ? viewCount : undefined,
    }

    return NextResponse.json({ success: true, card })
  } catch (error) {
    console.error('[CAREER CARD] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── Section data fetchers ────────────────────────────────────────────────────

async function fetchSectionData(
  supabase: SupabaseClient,
  userId: string,
  blockType: SectionBlockType,
  userAvatarUrl: string | null,
): Promise<
  ResumeData | DotAppData | MvrData | CdlData | PortfolioData |
  GitHubData | ProjectsData | SkillsData | WorkHistoryData | null
> {
  switch (blockType) {
    case 'driver-resume':
    case 'developer-resume':
      return fetchResumeData(supabase, userId, blockType)
    case 'driver-dot-application':
      return fetchDotAppData(supabase, userId)
    case 'driver-mvr':
      return fetchMvrData(supabase, userId)
    case 'driver-cdl-credentials':
      return fetchCdlData(supabase, userId)
    case 'developer-portfolio':
      return fetchPortfolioData(supabase, userId)
    case 'developer-github':
      return fetchGitHubData(supabase, userId, userAvatarUrl)
    case 'developer-projects':
      return fetchProjectsData(supabase, userId)
    case 'general-skills':
      return fetchSkillsData(supabase, userId)
    case 'general-work-history':
      return fetchWorkHistoryData(supabase, userId)
    default:
      return null
  }
}

async function fetchResumeData(
  supabase: SupabaseClient,
  userId: string,
  blockType: 'driver-resume' | 'developer-resume',
): Promise<ResumeData | null> {
  const sourceRole = blockType === 'developer-resume' ? 'developer' : 'driver'
  const { data } = await supabase
    .from('resumes')
    .select('id, title, filename, ipfs_hash, verification_status, structured_data, created_at')
    .eq('user_id', userId)
    .eq('source_role', sourceRole)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return null
  return {
    id: data.id,
    title: data.title,
    filename: data.filename,
    ipfsHash: data.ipfs_hash,
    verificationStatus: data.verification_status,
    structuredData: data.structured_data,
    createdAt: data.created_at,
  }
}

async function fetchDotAppData(supabase: SupabaseClient, userId: string): Promise<DotAppData | null> {
  const { data } = await supabase
    .from('driver_applications')
    .select('id, verification_status, is_complete, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return null
  return {
    id: data.id,
    status: data.verification_status,
    isComplete: data.is_complete,
    createdAt: data.created_at,
  }
}

async function fetchMvrData(supabase: SupabaseClient, userId: string): Promise<MvrData | null> {
  // FCRA: only self-ordered MVRs are shareable on the career card.
  // mvr_orders keys the driver as driver_user_id (not user_id).
  const { data: orders } = await supabase
    .from('mvr_orders')
    .select('id, status, dl_state, created_at, completed_at')
    .eq('driver_user_id', userId)
    .is('ordered_by_company_id', null)
    .order('created_at', { ascending: false })
    .limit(8)

  if (!orders?.length) return null

  const ids = orders.map((o) => o.id)
  const { data: resultRows } = await supabase
    .from('mvr_results')
    .select('mvr_order_id, license_status, license_class, total_points, violation_count')
    .in('mvr_order_id', ids)

  const resultByOrderId = new Map(
    (resultRows ?? []).map((r) => [r.mvr_order_id as string, r]),
  )

  const terminal = (s: string) => s === 'completed' || s === 'needs_review'
  // Prefer newest completed MVR that has parsed results (so a new pending reorder doesn't hide it)
  const order =
    orders.find((o) => terminal(o.status) && resultByOrderId.has(o.id)) ?? orders[0]

  const row = resultByOrderId.get(order.id)
  return {
    orderId: order.id,
    orderStatus: order.status,
    licenseState: order.dl_state,
    orderedAt: order.created_at,
    completedAt: order.completed_at,
    results: row
      ? {
          licenseStatus: row.license_status,
          licenseClass: row.license_class,
          totalPoints: row.total_points,
          violationCount: row.violation_count,
        }
      : null,
  }
}

async function fetchCdlData(supabase: SupabaseClient, userId: string): Promise<CdlData | null> {
  const row = await getCdlData(supabase, userId)
  if (!row) return null
  return {
    cdlClass: row.cdl_class,
    cdlState: row.cdl_state,
    cdlNumber: row.cdl_number,
    cdlExpiration: row.cdl_expiration,
    endorsements: row.endorsements ?? [],
    restrictions: row.restrictions ?? [],
  }
}

async function fetchPortfolioData(supabase: SupabaseClient, userId: string): Promise<PortfolioData | null> {
  const row = await getDevPortfolio(supabase, userId)
  return { portfolioUrl: row?.portfolio_url ?? null }
}

async function fetchGitHubData(supabase: SupabaseClient, userId: string, userAvatarUrl: string | null): Promise<GitHubData | null> {
  const row = await getDevGithub(supabase, userId)
  if (!row?.username) return null

  // row.data is the JSONB column synced by /api/github/callback → syncGitHubData
  const d = (row.data ?? {}) as Record<string, unknown>

  const topLanguages = (d.topLanguages ?? []) as Array<{ language: string; count: number; percentage: number }>
  const languages: Record<string, number> = {}
  for (const lang of topLanguages) {
    languages[lang.language] = lang.percentage
  }

  const rawRepos = (d.topRepos ?? []) as Array<{
    name: string; description: string | null; stars: number; language: string | null; url: string
  }>

  return {
    username: row.username,
    avatarUrl: (d.avatarUrl as string | null) ?? userAvatarUrl,
    bio: (d.bio as string | null) ?? null,
    publicRepos: (d.publicRepos as number) ?? 0,
    followers: (d.followers as number) ?? 0,
    languages,
    topRepos: rawRepos.slice(0, 5).map((r) => ({
      name: r.name,
      description: r.description,
      stars: r.stars,
      language: r.language,
      url: r.url,
    })),
  }
}

async function fetchProjectsData(supabase: SupabaseClient, userId: string): Promise<ProjectsData | null> {
  const { data } = await supabase
    .from('developer_projects')
    .select('id, title, description, tech_stack, live_url, repo_url, is_featured')
    .eq('user_id', userId)
    .order('is_featured', { ascending: false })

  if (!data || data.length === 0) return null
  return {
    projects: data.map(p => ({
      id: p.id,
      title: p.title,
      description: p.description,
      techStack: p.tech_stack ?? [],
      liveUrl: p.live_url,
      repoUrl: p.repo_url,
      isFeatured: p.is_featured,
    })),
  }
}

async function fetchSkillsData(supabase: SupabaseClient, userId: string): Promise<SkillsData | null> {
  const entries = await getSkills(supabase, userId)
  if (entries.length === 0) return null
  return { skills: entries.map(s => ({ name: s.name, category: s.category })) }
}

async function fetchWorkHistoryData(supabase: SupabaseClient, userId: string): Promise<WorkHistoryData | null> {
  // Check both driver and developer employment block tables
  const [driverHistory, devProfile] = await Promise.all([
    getDriverEmployment(supabase, userId),
    getDevProfile(supabase, userId),
  ])

  const devHistory = (devProfile?.employment_history ?? []) as Record<string, unknown>[]

  // Prefer driver employment (structured UnifiedEmployment[]), fall back to dev profile
  const useDriverHistory = driverHistory.length > 0
  const entries = useDriverHistory
    ? driverHistory.map(e => ({
        companyName: e.companyName ?? '',
        position: e.position ?? '',
        startDate: e.startDate ?? '',
        endDate: e.endDate || null,
        isCurrent: e.isCurrent ?? false,
      }))
    : devHistory.map(e => ({
        companyName: (e.companyName as string) ?? '',
        position: (e.position as string) ?? '',
        startDate: (e.startDate as string) ?? '',
        endDate: (e.endDate as string | null) ?? null,
        isCurrent: (e.isCurrent as boolean) ?? false,
      }))

  if (entries.length === 0) return null

  const { count } = await supabase
    .from('employment_verification_requests')
    .select('id', { count: 'exact', head: true })
    .eq('driver_id', userId)
    .eq('status', 'verified')

  return { entries, verifiedCount: count ?? 0 }
}
