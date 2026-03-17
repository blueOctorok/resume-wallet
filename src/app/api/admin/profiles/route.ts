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

    // Read from block_driver_cdl (block table)
    let query = supabase
      .from('block_driver_cdl')
      .select('id, user_id, cdl_number, cdl_state, created_at, updated_at', { count: 'exact' })

    if (search) {
      query = query.or(`cdl_number.ilike.%${search}%`)
    }

    const { data: profiles, error, count } = await query
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('[ADMIN PROFILES] Query error:', error)
      return NextResponse.json({ error: 'Failed to fetch profiles' }, { status: 500 })
    }

    const userIds = [...new Set(profiles?.map(p => p.user_id) || [])]

    const [{ data: users }, { data: userProfiles }] = await Promise.all([
      supabase.from('users').select('id, wallet_address').in('id', userIds),
      supabase.from('user_profiles').select('user_id, first_name, last_name, email, phone').in('user_id', userIds),
    ])

    const userMap = new Map(users?.map(u => [u.id, u.wallet_address]) || [])
    const upMap = new Map((userProfiles || []).map(p => [p.user_id, p]))

    const enrichedProfiles = profiles?.map(profile => {
      const up = upMap.get(profile.user_id)
      return {
        ...profile,
        last_updated_from: null,
        first_name: up?.first_name ?? null,
        last_name: up?.last_name ?? null,
        email: up?.email ?? null,
        phone: up?.phone ?? null,
        walletAddress: userMap.get(profile.user_id) || 'Unknown',
        fullName: [up?.first_name, up?.last_name].filter(Boolean).join(' ') || 'Unnamed',
      }
    })

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
