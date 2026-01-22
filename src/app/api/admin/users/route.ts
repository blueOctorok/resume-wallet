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
      .select('id, wallet_address, email, name, role, is_active, created_at', { count: 'exact' })

    // Apply search filter
    if (search) {
      query = query.or(`wallet_address.ilike.%${search}%,email.ilike.%${search}%,name.ilike.%${search}%`)
    }

    // Apply pagination and ordering
    const { data: users, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('[ADMIN USERS] Query error:', error)
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
    }

    // Get counts for each user (profiles, resumes, dot apps)
    const userIds = users?.map(u => u.id) || []
    
    // Get profile counts
    const { data: profiles } = await supabase
      .from('driver_profiles')
      .select('user_id')
      .in('user_id', userIds)

    // Get resume counts
    const { data: resumes } = await supabase
      .from('resumes')
      .select('user_id')
      .in('user_id', userIds)

    // Get DOT app counts
    const { data: dotApps } = await supabase
      .from('driver_applications')
      .select('user_id')
      .in('user_id', userIds)

    // Build count maps
    const profileMap = new Map<string, boolean>()
    profiles?.forEach(p => profileMap.set(p.user_id, true))

    const resumeCountMap = new Map<string, number>()
    resumes?.forEach(r => {
      resumeCountMap.set(r.user_id, (resumeCountMap.get(r.user_id) || 0) + 1)
    })

    const dotAppCountMap = new Map<string, number>()
    dotApps?.forEach(a => {
      dotAppCountMap.set(a.user_id, (dotAppCountMap.get(a.user_id) || 0) + 1)
    })

    // Enrich users with counts and admin status
    const enrichedUsers = users?.map(user => ({
      ...user,
      hasProfile: profileMap.has(user.id),
      resumeCount: resumeCountMap.get(user.id) || 0,
      dotAppCount: dotAppCountMap.get(user.id) || 0,
      isAdmin: isAdminWallet(user.wallet_address), // Flag admin wallets
    }))

    return NextResponse.json({
      success: true,
      users: enrichedUsers,
      total: count || 0,
      limit,
      offset,
    })

  } catch (error) {
    console.error('[ADMIN USERS] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
