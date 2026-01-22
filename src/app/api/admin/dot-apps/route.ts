import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'

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
  const auth = requireAdmin(request)
  if (!auth.authorized) return auth.error!

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || 'all'
  const limit = parseInt(searchParams.get('limit') || '50')
  const offset = parseInt(searchParams.get('offset') || '0')

  try {
    const supabase = await getAdminSupabaseClient()

    // Build query
    let query = supabase
      .from('driver_applications')
      .select('id, user_id, is_complete, current_step, verification_status, blockchain_tx_hash, created_at, updated_at', { count: 'exact' })

    // Apply status filter
    if (status === 'complete') {
      query = query.eq('is_complete', true)
    } else if (status === 'incomplete') {
      query = query.eq('is_complete', false)
    }

    // Apply pagination and ordering
    const { data: apps, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('[ADMIN DOT APPS] Query error:', error)
      return NextResponse.json({ error: 'Failed to fetch applications' }, { status: 500 })
    }

    // Get user info for each app
    const userIds = [...new Set(apps?.map(a => a.user_id) || [])]
    const { data: users } = await supabase
      .from('users')
      .select('id, wallet_address, email, name')
      .in('id', userIds)

    // Get profile names
    const { data: profiles } = await supabase
      .from('driver_profiles')
      .select('user_id, first_name, last_name')
      .in('user_id', userIds)

    // Build lookup maps
    const userMap = new Map(users?.map(u => [u.id, u]) || [])
    const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || [])

    // Enrich apps with user info
    const enrichedApps = apps?.map(app => {
      const user = userMap.get(app.user_id)
      const profile = profileMap.get(app.user_id)
      return {
        ...app,
        walletAddress: user?.wallet_address || 'Unknown',
        applicantName: profile?.first_name && profile?.last_name 
          ? `${profile.first_name} ${profile.last_name}`
          : user?.name || 'Unknown',
        email: user?.email,
      }
    })

    return NextResponse.json({
      success: true,
      dotApps: enrichedApps,
      total: count || 0,
      limit,
      offset,
    })

  } catch (error) {
    console.error('[ADMIN DOT APPS] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
