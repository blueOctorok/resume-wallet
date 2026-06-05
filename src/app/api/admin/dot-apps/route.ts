import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'
import { anyFieldMatchesSearch, paginateInMemory, resolveUserIdsMatchingSearch } from '@/lib/admin-search'

/**
 * GET /api/admin/dot-apps
 * List all DOT applications
 * 
 * Query params:
 *   status - Filter by status (complete, incomplete, all)
 *   limit - Max results (default 50)
 *   offset - Pagination offset (default 0)
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.authorized) return auth.error!

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || 'all'
  const search = searchParams.get('search')?.trim() ?? ''
  const limit = parseInt(searchParams.get('limit') || '50')
  const offset = parseInt(searchParams.get('offset') || '0')
  const hasSearch = search.length > 0

  try {
    const supabase = await getAdminSupabaseClient()

    let query = supabase
      .from('driver_applications')
      .select('id, user_id, is_complete, current_step, verification_status, blockchain_tx_hash, created_at, updated_at', {
        count: hasSearch ? undefined : 'exact',
      })

    // Apply status filter
    if (status === 'complete') {
      query = query.eq('is_complete', true)
    } else if (status === 'incomplete') {
      query = query.eq('is_complete', false)
    }

    if (!hasSearch) {
      query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1)
    } else {
      query = query.order('created_at', { ascending: false })
    }

    const { data: apps, error, count } = await query

    if (error) {
      console.error('[ADMIN DOT APPS] Query error:', error)
      return NextResponse.json({ error: 'Failed to fetch applications' }, { status: 500 })
    }

    // Get user info for each app
    const userIds = [...new Set(apps?.map(a => a.user_id) || [])]
    const { data: users } = await supabase
      .from('users')
      .select('id, wallet_address, email')
      .in('id', userIds)

    const { data: userProfiles } = await supabase
      .from('user_profiles')
      .select('user_id, first_name, last_name')
      .in('user_id', userIds)

    const userMap = new Map(users?.map(u => [u.id, u]) || [])
    const profileMap = new Map(userProfiles?.map(p => [p.user_id, p]) || [])

    const matchingUserIds = hasSearch
      ? new Set(await resolveUserIdsMatchingSearch(supabase, search))
      : null

    const enrichedApps = apps?.map(app => {
      const user = userMap.get(app.user_id)
      const profile = profileMap.get(app.user_id)
      return {
        ...app,
        legacyWalletAddress: user?.wallet_address || 'Unknown',
        applicantName: [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim() || 'Unknown',
        email: user?.email,
      }
    })

    const filtered = hasSearch
      ? (enrichedApps ?? []).filter(
          (app) =>
            matchingUserIds?.has(app.user_id) ||
            anyFieldMatchesSearch(search, app.applicantName, app.email, app.sessionUserId),
        )
      : enrichedApps ?? []

    const page = hasSearch ? paginateInMemory(filtered, offset, limit) : filtered

    return NextResponse.json({
      success: true,
      dotApps: page,
      total: hasSearch ? filtered.length : (count || 0),
      limit,
      offset,
    })

  } catch (error) {
    console.error('[ADMIN DOT APPS] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
