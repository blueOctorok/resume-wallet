import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'

/**
 * GET /api/admin/dev-profiles
 * List all developer profiles
 *
 * Query params:
 *   search - Filter by name, email, or GitHub username (partial match)
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
      .from('developer_profiles')
      .select(
        'id, user_id, email, full_name, headline, github_username, skills, available_for_work, created_at, updated_at',
        { count: 'exact' }
      )

    // Apply search filter
    if (search) {
      query = query.or(
        `full_name.ilike.%${search}%,email.ilike.%${search}%,github_username.ilike.%${search}%,headline.ilike.%${search}%`
      )
    }

    // Apply pagination and ordering
    const {
      data: profiles,
      error,
      count,
    } = await query
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('[ADMIN DEV PROFILES] Query error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch developer profiles' },
        { status: 500 }
      )
    }

    // Get wallet addresses for each profile
    const userIds = [...new Set(profiles?.map((p) => p.user_id) || [])]
    const { data: users } = await supabase
      .from('users')
      .select('id, wallet_address')
      .in('id', userIds)

    const userMap = new Map(users?.map((u) => [u.id, u.wallet_address]) || [])

    // Get project counts for each profile
    const profileIds = profiles?.map((p) => p.id) || []
    const { data: projects } = await supabase
      .from('developer_projects')
      .select('developer_profile_id')
      .in('developer_profile_id', profileIds)

    const projectCountMap = new Map<string, number>()
    projects?.forEach((p) => {
      projectCountMap.set(
        p.developer_profile_id,
        (projectCountMap.get(p.developer_profile_id) || 0) + 1
      )
    })

    // Enrich profiles
    const enrichedProfiles = profiles?.map((profile) => ({
      ...profile,
      walletAddress: userMap.get(profile.user_id) || 'Unknown',
      projectCount: projectCountMap.get(profile.id) || 0,
      // Parse skills count (skills is JSONB array)
      skillCount: Array.isArray(profile.skills) ? profile.skills.length : 0,
    }))

    return NextResponse.json({
      success: true,
      profiles: enrichedProfiles,
      total: count || 0,
      limit,
      offset,
    })
  } catch (error) {
    console.error('[ADMIN DEV PROFILES] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
