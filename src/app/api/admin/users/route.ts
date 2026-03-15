import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { requireAdmin, isAdminWallet } from '@/lib/admin-auth'

/**
 * GET /api/admin/users
 * List all users with optional search
 *
 * Query params:
 *   search - Filter by wallet address or email (partial match)
 *   limit - Max results (default 50)
 *   offset - Pagination offset (default 0)
 */
export async function GET(request: NextRequest) {
  const auth = requireAdmin(request)
  if (!auth.authorized) return auth.error!

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search')?.toLowerCase() || ''
  const limit = parseInt(searchParams.get('limit') || '50')
  const offset = parseInt(searchParams.get('offset') || '0')

  try {
    const supabase = await getAdminSupabaseClient()

    // Build query
    let query = supabase
      .from('users')
      .select('id, wallet_address, email, name, role, is_active, created_at', {
        count: 'exact',
      })

    // Apply search filter
    if (search) {
      query = query.or(
        `wallet_address.ilike.%${search}%,email.ilike.%${search}%,name.ilike.%${search}%`
      )
    }

    // Apply pagination and ordering
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

    // Get counts and profile data for each user
    const userIds = users?.map((u) => u.id) || []

    // Unified profile (primary source for display name/email)
    const { data: userProfiles } = await supabase
      .from('user_profiles')
      .select('user_id, first_name, last_name, email')
      .in('user_id', userIds)

    // Driver profile data (fallback + hasProfile indicator)
    const { data: driverProfiles } = await supabase
      .from('driver_profiles')
      .select('user_id, first_name, last_name, email')
      .in('user_id', userIds)

    // Developer profile data (fallback + hasDevProfile indicator)
    const { data: devProfiles } = await supabase
      .from('developer_profiles')
      .select('user_id, full_name, email, github_username')
      .in('user_id', userIds)

    // Get resume counts
    const { data: resumes } = await supabase
      .from('resumes')
      .select('user_id')
      .in('user_id', userIds)

    // Get DOT app counts (submitted applications)
    const { data: dotApps } = await supabase
      .from('driver_applications')
      .select('user_id')
      .in('user_id', userIds)

    // Get developer project counts
    const { data: devProjects } = await supabase
      .from('developer_projects')
      .select('user_id')
      .in('user_id', userIds)

    // Build lookup maps
    const userProfileMap = new Map<string, { first_name: string | null; last_name: string | null; email: string | null }>()
    userProfiles?.forEach((p) => userProfileMap.set(p.user_id, p))

    const driverProfileMap = new Map<string, { first_name: string | null; last_name: string | null; email: string | null }>()
    driverProfiles?.forEach((p) => driverProfileMap.set(p.user_id, p))

    const devProfileMap = new Map<string, { full_name: string | null; email: string | null; github_username: string | null }>()
    devProfiles?.forEach((p) => devProfileMap.set(p.user_id, p))

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
      devProjectCountMap.set(
        p.user_id,
        (devProjectCountMap.get(p.user_id) || 0) + 1
      )
    })

    // Enrich users with counts, profile data, and admin status
    const enrichedUsers = users?.map((user) => {
      const userProfile = userProfileMap.get(user.id)
      const driverProfile = driverProfileMap.get(user.id)
      const devProfile = devProfileMap.get(user.id)

      // Build display name: prefer user_profiles, then driver, then dev, then users.name
      let displayName: string | null = null
      if (userProfile?.first_name && userProfile?.last_name) {
        displayName = `${userProfile.first_name} ${userProfile.last_name}`
      } else if (userProfile?.first_name) {
        displayName = userProfile.first_name
      } else if (driverProfile?.first_name && driverProfile?.last_name) {
        displayName = `${driverProfile.first_name} ${driverProfile.last_name}`
      } else if (driverProfile?.first_name) {
        displayName = driverProfile.first_name
      } else if (devProfile?.full_name) {
        displayName = devProfile.full_name
      } else if (devProfile?.github_username) {
        displayName = `@${devProfile.github_username}`
      } else {
        displayName = user.name || null
      }

      const displayEmail =
        userProfile?.email || driverProfile?.email || devProfile?.email || user.email || null

      return {
        ...user,
        displayName,
        displayEmail,
        hasProfile: driverProfileMap.has(user.id),
        hasDevProfile: devProfileMap.has(user.id),
        resumeCount: resumeCountMap.get(user.id) || 0,
        dotAppCount: dotAppCountMap.get(user.id) || 0,
        devProjectCount: devProjectCountMap.get(user.id) || 0,
        isAdmin: isAdminWallet(user.wallet_address),
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
