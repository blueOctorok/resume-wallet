import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { requireAdmin, isAdminEmail } from '@/lib/admin-auth'

/**
 * Maps a block_type string (e.g. "driver-mvr") to its category prefix.
 * Block types follow the convention: `{category}-{name}`.
 */
function blockCategory(blockType: string): 'drivers' | 'developers' | 'general' | 'unknown' {
  if (blockType.startsWith('driver-')) return 'drivers'
  if (blockType.startsWith('developer-')) return 'developers'
  if (blockType.startsWith('general-')) return 'general'
  return 'unknown'
}

/**
 * GET /api/admin/users
 * List all users with optional search and block-category filtering.
 *
 * Query params:
 *   search      - Filter by wallet address, email, or display name (partial match)
 *   blockFilter - Filter by block category: "drivers", "developers", "general", "none"
 *   limit       - Max results (default 50)
 *   offset      - Pagination offset (default 0)
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.authorized) return auth.error!

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search')?.toLowerCase() || ''
  const blockFilter = searchParams.get('blockFilter') || ''
  const limit = parseInt(searchParams.get('limit') || '50')
  const offset = parseInt(searchParams.get('offset') || '0')

  try {
    const supabase = await getAdminSupabaseClient()

    // When blockFilter is set we need to resolve qualifying user IDs first,
    // because Supabase doesn't support cross-table filtering in .select().
    let blockFilteredIds: string[] | null = null

    if (blockFilter === 'none') {
      // Users with ZERO hub_blocks rows
      const { data: allUsers } = await supabase
        .from('users')
        .select('id')
        .neq('role', 'employer')
      const allIds = allUsers?.map(u => u.id) || []

      if (allIds.length > 0) {
        const { data: withBlocks } = await supabase
          .from('hub_blocks')
          .select('user_id')
          .in('user_id', allIds)
        const withBlockSet = new Set(withBlocks?.map(b => b.user_id) || [])
        blockFilteredIds = allIds.filter(id => !withBlockSet.has(id))
      } else {
        blockFilteredIds = []
      }
    } else if (['drivers', 'developers', 'general'].includes(blockFilter)) {
      const prefix = blockFilter === 'drivers' ? 'driver-'
        : blockFilter === 'developers' ? 'developer-'
        : 'general-'
      const { data: matching } = await supabase
        .from('hub_blocks')
        .select('user_id, block_type')
        .like('block_type', `${prefix}%`)
      blockFilteredIds = [...new Set(matching?.map(b => b.user_id) || [])]
    }

    // Build main users query
    let query = supabase
      .from('users')
      .select('id, wallet_address, email, role, is_active, created_at', {
        count: 'exact',
      })

    if (search) {
      query = query.or(
        `wallet_address.ilike.%${search}%,email.ilike.%${search}%`
      )
    }

    if (blockFilteredIds !== null) {
      if (blockFilteredIds.length === 0) {
        return NextResponse.json({ success: true, users: [], total: 0, limit, offset })
      }
      query = query.in('id', blockFilteredIds)
    }

    const {
      data: users,
      error,
      count,
    } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('[ADMIN USERS] Query error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch users' },
        { status: 500 }
      )
    }

    const userIds = users?.map((u) => u.id) || []

    // Parallel enrichment queries — block tables
    const [
      { data: userProfiles },
      { data: devGithubRows },
      { data: resumes },
      { data: dotApps },
      { data: devProjects },
      { data: hubBlocks },
    ] = await Promise.all([
      supabase.from('user_profiles').select('user_id, first_name, last_name, email').in('user_id', userIds),
      supabase.from('block_dev_github').select('user_id, username').in('user_id', userIds),
      supabase.from('resumes').select('user_id').in('user_id', userIds),
      supabase.from('driver_applications').select('user_id').in('user_id', userIds),
      supabase.from('developer_projects').select('user_id').in('user_id', userIds),
      supabase.from('hub_blocks').select('user_id, block_type').in('user_id', userIds),
    ])

    // Build lookup maps
    const userProfileMap = new Map<string, { first_name: string | null; last_name: string | null; email: string | null }>()
    userProfiles?.forEach((p) => userProfileMap.set(p.user_id, p))

    const devGithubMap = new Map<string, string | null>()
    devGithubRows?.forEach((g) => devGithubMap.set(g.user_id, g.username))

    const resumeCountMap = new Map<string, number>()
    resumes?.forEach((r) => {
      resumeCountMap.set(r.user_id, (resumeCountMap.get(r.user_id) || 0) + 1)
    })

    const dotAppCountMap = new Map<string, number>()
    dotApps?.forEach((a) => {
      dotAppCountMap.set(a.user_id, (dotAppCountMap.get(a.user_id) || 0) + 1)
    })

    const devProjectCountMap = new Map<string, number>()
    devProjects?.forEach((p) => {
      devProjectCountMap.set(p.user_id, (devProjectCountMap.get(p.user_id) || 0) + 1)
    })

    const blocksMap = new Map<string, string[]>()
    hubBlocks?.forEach((b) => {
      const list = blocksMap.get(b.user_id) || []
      list.push(b.block_type)
      blocksMap.set(b.user_id, list)
    })

    const enrichedUsers = users?.map((user) => {
      const userProfile = userProfileMap.get(user.id)
      const githubUsername = devGithubMap.get(user.id)

      let displayName: string | null = [userProfile?.first_name, userProfile?.last_name].filter(Boolean).join(' ') || null
      if (!displayName && githubUsername) {
        displayName = `@${githubUsername}`
      }

      const displayEmail = userProfile?.email || user.email || null
      const installedBlocks = blocksMap.get(user.id) || []

      // Derive block categories for quick badge rendering
      const blockCategories = [...new Set(installedBlocks.map(blockCategory))].filter(c => c !== 'unknown')

      // hasProfile / hasDevProfile now derived from installed block types
      const hasDriverBlocks = installedBlocks.some(b => b.startsWith('driver-'))
      const hasDevBlocks = installedBlocks.some(b => b.startsWith('developer-'))

      return {
        ...user,
        displayName,
        displayEmail,
        hasProfile: hasDriverBlocks,
        hasDevProfile: hasDevBlocks,
        resumeCount: resumeCountMap.get(user.id) || 0,
        dotAppCount: dotAppCountMap.get(user.id) || 0,
        devProjectCount: devProjectCountMap.get(user.id) || 0,
        isAdmin: isAdminEmail(displayEmail),
        installedBlocks,
        blockCategories,
      }
    })

    return NextResponse.json({
      success: true,
      users: enrichedUsers,
      total: count || 0,
      limit,
      offset,
    })
  } catch (error) {
    console.error('[ADMIN USERS] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
