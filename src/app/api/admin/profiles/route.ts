import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'

/**
 * GET /api/admin/profiles
 * List all driver profiles
 * 
 * Query params:
 *   search - Filter by name or email (partial match)
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
      .from('driver_profiles')
      .select('id, user_id, first_name, last_name, email, phone, cdl_number, cdl_state, last_updated_from, created_at, updated_at', { count: 'exact' })

    // Apply search filter
    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,cdl_number.ilike.%${search}%`)
    }

    // Apply pagination and ordering
    const { data: profiles, error, count } = await query
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('[ADMIN PROFILES] Query error:', error)
      return NextResponse.json({ error: 'Failed to fetch profiles' }, { status: 500 })
    }

    // Get wallet addresses for each profile
    const userIds = [...new Set(profiles?.map(p => p.user_id) || [])]
    const { data: users } = await supabase
      .from('users')
      .select('id, wallet_address')
      .in('id', userIds)

    const userMap = new Map(users?.map(u => [u.id, u.wallet_address]) || [])

    // Enrich profiles
    const enrichedProfiles = profiles?.map(profile => ({
      ...profile,
      walletAddress: userMap.get(profile.user_id) || 'Unknown',
      fullName: profile.first_name && profile.last_name 
        ? `${profile.first_name} ${profile.last_name}`
        : 'Unnamed',
    }))

    return NextResponse.json({
      success: true,
      profiles: enrichedProfiles,
      total: count || 0,
      limit,
      offset,
    })

  } catch (error) {
    console.error('[ADMIN PROFILES] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
