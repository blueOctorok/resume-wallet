import { getBlockDefinition } from '@/lib/block-registry'
import {
  getCdlData,
  getDevPortfolio,
  getDevGithub,
  saveDevGithub,
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
  OnChainCredential,
} from '@/types/career-card'

/** Shown on the career card when storm-resume is installed but no resume row exists yet. */
export const EMPTY_STORM_RESUME_CARD: ResumeData = {
  id: '__storm_resume_placeholder__',
  title: '',
  filename: '',
  ipfsHash: '',
  verificationStatus: 'EMPTY',
  structuredData: null,
  createdAt: new Date(0).toISOString(),
}

/**
 * Fallback data for installed blocks that have no user data yet.
 * Without this, blocks the user just added would silently disappear from the
 * career card because `fetchSectionData` returns null → the section loop
 * skips them. The empty placeholder ensures the block still renders
 * (particularly in Construct with a "Set up" button).
 */
const EMPTY_SECTION_DATA: Record<string, unknown> = {
  'storm-resume': EMPTY_STORM_RESUME_CARD,
  'driver-resume': EMPTY_STORM_RESUME_CARD,
  'developer-resume': EMPTY_STORM_RESUME_CARD,
  'general-resume': EMPTY_STORM_RESUME_CARD,
  'driver-dot-application': { id: '', status: 'empty', isComplete: false, createdAt: '' } satisfies DotAppData,
  'driver-mvr': { orderId: '', orderStatus: 'none', licenseState: '', orderedAt: '', completedAt: null, results: null } satisfies MvrData,
  'driver-cdl-credentials': { cdlNumber: null, cdlState: null, cdlClass: null, cdlExpiration: null, endorsements: [], restrictions: [] } satisfies CdlData,
  'developer-portfolio': { portfolioUrl: null } satisfies PortfolioData,
  'developer-github': { username: null, avatarUrl: null, bio: null, publicRepos: 0, followers: 0, languages: {}, topRepos: [] } satisfies GitHubData,
  'developer-projects': { projects: [] } satisfies ProjectsData,
}

function computeCareerCardSignals(
  sections: CareerCardSection[],
  employerConfirmedEmploymentCount: number,
): {
  onChainCredentialCount: number
  careerCardScore: number
  onChainCredentials: OnChainCredential[]
} {
  const onChainCredentials: OnChainCredential[] = []
  for (const s of sections) {
    if (
      s.blockType === 'storm-resume' ||
      s.blockType === 'driver-resume' ||
      s.blockType === 'developer-resume' ||
      s.blockType === 'general-resume'
    ) {
      const d = s.data as ResumeData
      const tx = d.blockchainTxHash
      if (tx && String(d.verificationStatus || '').toUpperCase() === 'VERIFIED') {
        const def = getBlockDefinition(s.blockType)
        onChainCredentials.push({
          blockType: s.blockType,
          label: def?.label ?? 'Resume',
          txHash: tx,
          verifiedAt: d.createdAt,
        })
      }
    }
    if (s.blockType === 'driver-dot-application') {
      const d = s.data as DotAppData
      const tx = d.blockchainTxHash
      if (tx) {
        const def = getBlockDefinition('driver-dot-application')
        onChainCredentials.push({
          blockType: 'driver-dot-application',
          label: def?.label ?? 'DOT Application',
          txHash: tx,
          verifiedAt: d.updatedAt ?? d.createdAt,
        })
      }
    }
  }
  const onChain = onChainCredentials.length
  const sectionScore = Math.min(sections.length * 12, 60)
  const employerBonus = Math.min(employerConfirmedEmploymentCount * 10, 20)
  const chainBonus = Math.min(onChain * 12, 20)
  return {
    onChainCredentialCount: onChain,
    careerCardScore: Math.min(100, sectionScore + employerBonus + chainBonus),
    onChainCredentials,
  }
}
import type { SupabaseClient } from '@supabase/supabase-js'
import { applyLensOrderAndFilterPerPage, getLensOrDefault } from '@/lib/career-card-lenses'
import { readCardPage } from '@/lib/hub-block-config'

export type ProjectedCareerCardContactMode = 'self' | 'public' | 'employer'

export interface BuildProjectedCareerCardInput {
  memberSince: string
  shareToken: string | null
  shareSettings: { showContact: boolean; allowConnect: boolean }
  contactMode: ProjectedCareerCardContactMode
  /** Public share page only — shown on the card header */
  viewCount?: number
  /**
   * Optional lens to project through. Self + public views resolve this to the
   * user's default "Full profile" when omitted. Employer view ignores lenses
   * entirely so recruiters see the neutral projection, not a candidate-framed
   * subset.
   */
  lensId?: string | null
}

/**
 * Single builder for the hub-projected career card (installed blocks × registry).
 * Used by GET /api/career-card and GET /api/employer/talent/[userId].
 */
export async function buildProjectedCareerCard(
  supabase: SupabaseClient,
  userId: string,
  meta: BuildProjectedCareerCardInput,
): Promise<ProjectedCareerCard> {
  const [userProfile, onboarding] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('first_name, last_name, avatar_url, headline, email, phone, city, state, professional_summary')
      .eq('user_id', userId)
      .maybeSingle()
      .then((r) => r.data),
    supabase
      .from('hub_onboarding')
      .select('occupation')
      .eq('user_id', userId)
      .maybeSingle()
      .then((r) => r.data),
  ])

  const upName = [userProfile?.first_name, userProfile?.last_name].filter(Boolean).join(' ')
  const userName = upName || 'Candidate'
  const avatarUrl = userProfile?.avatar_url ?? null

  const location =
    userProfile?.city && userProfile?.state
      ? `${userProfile.city}, ${userProfile.state}`
      : null

  const profileSummary = userProfile?.professional_summary ?? null

  // Resolve the lens up-front so section filtering can happen in one place
  // downstream. Employer view bypasses lens framing (see note on BuildProjectedCareerCardInput).
  const lensRow =
    meta.contactMode === 'employer'
      ? null
      : await getLensOrDefault(supabase, userId, meta.lensId ?? null)

  const summary =
    lensRow?.custom_summary && lensRow.custom_summary.trim().length > 0
      ? lensRow.custom_summary
      : profileSummary

  const includeContact =
    meta.contactMode === 'self' ||
    meta.contactMode === 'employer' ||
    (meta.contactMode === 'public' && meta.shareSettings.showContact)

  const contact = includeContact
    ? {
        email: userProfile?.email ?? null,
        phone: userProfile?.phone ?? null,
      }
    : undefined

  const { data: hubBlocks } = await supabase
    .from('hub_blocks')
    .select('id, block_type, config')
    .eq('user_id', userId)
    .order('position', { ascending: true })

  type HubRow = { id: string; block_type: string; config: Record<string, unknown> | null }
  const hubRows = (hubBlocks ?? []) as HubRow[]
  const installedTypes = hubRows.map((b) => b.block_type)
  const hasStormResume = installedTypes.includes('storm-resume')
  const legacyResumeBlockTypes = new Set(['driver-resume', 'developer-resume', 'general-resume'])

  const { data: evrRows } = await supabase
    .from('employment_verification_requests')
    .select(
      'previous_employer_name, claimed_position, claimed_start_date, claimed_end_date, verified_at, created_at',
    )
    .eq('driver_id', userId)
    .in('status', ['VERIFIED', 'PARTIALLY_VERIFIED'])
    .order('verified_at', { ascending: false })

  const employerConfirmations = (evrRows ?? []).map((row) => ({
    companyName: String(row.previous_employer_name ?? 'Employer'),
    position: String(row.claimed_position ?? '—'),
    startDate: String(row.claimed_start_date ?? ''),
    endDate: row.claimed_end_date != null ? String(row.claimed_end_date) : null,
    verifiedAt: String(row.verified_at ?? row.created_at ?? ''),
  }))

  const employerConfirmed = employerConfirmations.length

  const sections: CareerCardSection[] = []

  for (const row of hubRows) {
    const blockType = row.block_type
    if (hasStormResume && legacyResumeBlockTypes.has(blockType)) continue
    const def = getBlockDefinition(blockType)
    if (!def || !def.appearsOnCareerCard) continue

    let sectionData = await fetchSectionData(supabase, userId, blockType as SectionBlockType, avatarUrl)
    let needsSetup = false
    if (!sectionData) {
      const fallback = EMPTY_SECTION_DATA[blockType]
      if (!fallback) continue
      sectionData = fallback as typeof sectionData
      needsSetup = true
    }

    let cardPage = readCardPage(row.config ?? undefined)
    if (blockType === 'storm-resume') {
      cardPage = 1
    }

    sections.push({
      blockType: blockType as SectionBlockType,
      label: def.label,
      icon: def.icon,
      data: sectionData,
      hubBlockId: row.id,
      cardPage,
      needsSetup,
    })
  }

  const stormIdx = sections.findIndex((s) => s.blockType === 'storm-resume')
  if (stormIdx > 0) {
    const [storm] = sections.splice(stormIdx, 1)
    sections.unshift(storm)
  }

  // Apply the lens ordering + filter before computing signals so score reflects
  // what's actually visible on the card. Employer view uses the raw sections.
  // Per-page lens so `cardPage` boundaries stay stable under emphasis reorder.
  const projectedSections = lensRow
    ? applyLensOrderAndFilterPerPage(sections, lensRow)
    : sections

  const signals = computeCareerCardSignals(projectedSections, employerConfirmed)

  return {
    userId,
    name: userName,
    avatarUrl,
    occupation: userProfile?.headline ?? onboarding?.occupation ?? null,
    professionalSummary: summary,
    location,
    memberSince: meta.memberSince,
    shareToken: meta.shareToken,
    sections: projectedSections,
    settings: meta.shareSettings,
    contact,
    viewCount: meta.contactMode === 'public' ? meta.viewCount : undefined,
    employerConfirmedEmploymentCount: employerConfirmed,
    employerConfirmations,
    onChainCredentialCount: signals.onChainCredentialCount,
    onChainCredentials: signals.onChainCredentials,
    careerCardScore: signals.careerCardScore,
    activeLens: lensRow
      ? { id: lensRow.id, name: lensRow.name, isDefault: lensRow.is_default }
      : undefined,
  }
}

async function fetchSectionData(
  supabase: SupabaseClient,
  userId: string,
  blockType: SectionBlockType,
  userAvatarUrl: string | null,
): Promise<
  ResumeData | DotAppData | MvrData | CdlData | PortfolioData | GitHubData | ProjectsData | null
> {
  switch (blockType) {
    case 'storm-resume':
      return fetchLatestResumeForUser(supabase, userId)
    case 'driver-resume':
    case 'developer-resume':
    case 'general-resume':
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
    default:
      return null
  }
}

/** Latest resume row for any source_role — used by STORM Resume block on the career card */
async function fetchLatestResumeForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<ResumeData | null> {
  const { data } = await supabase
    .from('resumes')
    .select('id, title, filename, ipfs_hash, verification_status, blockchain_tx_hash, structured_data, created_at')
    .eq('user_id', userId)
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
    blockchainTxHash: data.blockchain_tx_hash,
    structuredData: data.structured_data,
    createdAt: data.created_at,
  }
}

async function fetchResumeData(
  supabase: SupabaseClient,
  userId: string,
  blockType: 'driver-resume' | 'developer-resume' | 'general-resume',
): Promise<ResumeData | null> {
  const sourceRole =
    blockType === 'developer-resume' ? 'developer' : blockType === 'general-resume' ? 'general' : 'driver'
  const { data } = await supabase
    .from('resumes')
    .select('id, title, filename, ipfs_hash, verification_status, blockchain_tx_hash, structured_data, created_at')
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
    blockchainTxHash: data.blockchain_tx_hash,
    structuredData: data.structured_data,
    createdAt: data.created_at,
  }
}

async function fetchDotAppData(supabase: SupabaseClient, userId: string): Promise<DotAppData | null> {
  const { data } = await supabase
    .from('driver_applications')
    .select('id, verification_status, is_complete, created_at, updated_at, blockchain_tx_hash')
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
    updatedAt: data.updated_at,
    blockchainTxHash: data.blockchain_tx_hash,
  }
}

async function fetchMvrData(supabase: SupabaseClient, userId: string): Promise<MvrData | null> {
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

  const resultByOrderId = new Map((resultRows ?? []).map((r) => [r.mvr_order_id as string, r]))

  const terminal = (s: string) => s === 'completed' || s === 'needs_review'
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

async function fetchGitHubData(
  supabase: SupabaseClient,
  userId: string,
  userAvatarUrl: string | null,
): Promise<GitHubData | null> {
  let row = await getDevGithub(supabase, userId)
  if (!row?.username) return null

  if (!row.data && row.access_token) {
    try {
      const synced = await syncGitHubToDb(supabase, userId, row.access_token, row.username)
      if (synced) row = (await getDevGithub(supabase, userId)) ?? row
    } catch (e) {
      console.error('[PROJECTED CAREER CARD] GitHub self-heal sync failed:', e)
    }
  }

  const d = (row.data ?? {}) as Record<string, unknown>

  const topLanguages = (d.topLanguages ?? []) as Array<{ language: string; count: number; percentage: number }>
  const languages: Record<string, number> = {}
  for (const lang of topLanguages) {
    languages[lang.language] = lang.percentage
  }

  const rawRepos = (d.topRepos ?? []) as Array<{
    name: string
    description: string | null
    stars: number
    language: string | null
    url: string
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

async function syncGitHubToDb(
  supabase: SupabaseClient,
  userId: string,
  accessToken: string,
  username: string,
): Promise<boolean> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'Storm-GitHubSync',
    Authorization: `Bearer ${accessToken}`,
  }

  const [userRes, reposRes] = await Promise.all([
    fetch('https://api.github.com/user', { headers }),
    fetch('https://api.github.com/user/repos?per_page=100&sort=updated', { headers }),
  ])

  const userData = await userRes.json()
  const reposData = await reposRes.json()
  const repos = Array.isArray(reposData) ? reposData : []

  if (userData?.message) {
    console.error('[GITHUB SELF-HEAL] API error:', userData.message)
    return false
  }

  const totalStars = repos.reduce(
    (sum: number, r: Record<string, unknown>) => sum + ((r.stargazers_count as number) || 0),
    0,
  )
  const totalForks = repos.reduce(
    (sum: number, r: Record<string, unknown>) => sum + ((r.forks_count as number) || 0),
    0,
  )
  const privateRepos = repos.filter((r: Record<string, unknown>) => r.private).length

  const langCount: Record<string, number> = {}
  repos.forEach((r: Record<string, unknown>) => {
    const lang = r.language as string | null
    if (lang) langCount[lang] = (langCount[lang] || 0) + 1
  })
  const totalLangs = Object.values(langCount).reduce((a, b) => a + b, 0)
  const topLanguages = Object.entries(langCount)
    .map(([language, count]) => ({
      language,
      count,
      percentage: totalLangs > 0 ? Math.round((count / totalLangs) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  const topRepos = repos
    .filter((r: Record<string, unknown>) => !r.fork)
    .sort(
      (a: Record<string, unknown>, b: Record<string, unknown>) =>
        ((b.stargazers_count as number) || 0) - ((a.stargazers_count as number) || 0),
    )
    .slice(0, 5)
    .map((r: Record<string, unknown>) => ({
      name: r.name as string,
      description: (r.description as string | null) ?? null,
      stars: (r.stargazers_count as number) || 0,
      language: (r.language as string | null) ?? null,
      url: (r.html_url as string) || `https://github.com/${username}/${r.name}`,
      isPrivate: !!r.private,
    }))

  await saveDevGithub(supabase, userId, {
    data: {
      totalRepos: repos.length,
      publicRepos: repos.length - privateRepos,
      privateRepos,
      totalStars,
      totalForks,
      followers: userData.followers || 0,
      following: userData.following || 0,
      avatarUrl: userData.avatar_url || null,
      bio: userData.bio || null,
      topLanguages,
      topRepos,
      syncedAt: new Date().toISOString(),
    },
  })

  console.log(`[GITHUB SELF-HEAL] Synced ${repos.length} repos for user ${userId}`)
  return true
}

async function fetchProjectsData(supabase: SupabaseClient, userId: string): Promise<ProjectsData | null> {
  const { data } = await supabase
    .from('developer_projects')
    .select('id, title, description, tech_stack, live_url, repo_url, is_featured')
    .eq('user_id', userId)
    .order('is_featured', { ascending: false })

  if (!data || data.length === 0) return null
  return {
    projects: data.map((p) => ({
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

/** Map DB row + optional results to the MvrData shape used on the projected card. */
export function toMvrDataFromOrderRow(order: {
  id: string
  status: string
  dl_state: string
  created_at: string
  completed_at: string | null
}, results: {
  license_status: string
  license_class: string
  total_points: number
  violation_count: number
} | null): MvrData {
  return {
    orderId: order.id,
    orderStatus: order.status,
    licenseState: order.dl_state,
    orderedAt: order.created_at,
    completedAt: order.completed_at,
    results: results
      ? {
          licenseStatus: results.license_status,
          licenseClass: results.license_class,
          totalPoints: results.total_points,
          violationCount: results.violation_count,
        }
      : null,
  }
}
