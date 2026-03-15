import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'

/**
 * GET /api/admin/resumes
 * List all resumes
 * 
 * Query params:
 *   search - Filter by title or filename (partial match)
 *   type - Filter by resume_type (uploaded, built, all)
 *   limit - Max results (default 50)
 *   offset - Pagination offset (default 0)
 */
export async function GET(request: NextRequest) {
  const auth = requireAdmin(request)
  if (!auth.authorized) return auth.error!

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search')?.toLowerCase() || ''
  const type = searchParams.get('type') || 'all'
  const limit = parseInt(searchParams.get('limit') || '50')
  const offset = parseInt(searchParams.get('offset') || '0')

  try {
    const supabase = await getAdminSupabaseClient()

    // Build query
    let query = supabase
      .from('resumes')
      .select('id, user_id, title, filename, verification_status, resume_type, file_size, ipfs_hash, blockchain_tx_hash, created_at', { count: 'exact' })

    // Apply search filter
    if (search) {
      query = query.or(`title.ilike.%${search}%,filename.ilike.%${search}%`)
    }

    // Apply type filter
    if (type !== 'all') {
      query = query.eq('resume_type', type)
    }

    // Apply pagination and ordering
    const { data: resumes, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('[ADMIN RESUMES] Query error:', error)
      return NextResponse.json({ error: 'Failed to fetch resumes' }, { status: 500 })
    }

    // Get user info for each resume
    const userIds = [...new Set(resumes?.map(r => r.user_id) || [])]
    const { data: users } = await supabase
      .from('users')
      .select('id, wallet_address, email, name')
      .in('id', userIds)

    // Get profile names from user_profiles (unified), falling back to driver_profiles
    const { data: userProfiles } = await supabase
      .from('user_profiles')
      .select('user_id, first_name, last_name')
      .in('user_id', userIds)

    const { data: driverProfiles } = await supabase
      .from('driver_profiles')
      .select('user_id, first_name, last_name')
      .in('user_id', userIds)

    // Build lookup maps
    const userMap = new Map(users?.map(u => [u.id, u]) || [])
    const userProfileMap = new Map(userProfiles?.map(p => [p.user_id, p]) || [])
    const driverProfileMap = new Map(driverProfiles?.map(p => [p.user_id, p]) || [])

    // Enrich resumes — prefer user_profiles for name, fall back to driver_profiles
    const enrichedResumes = resumes?.map(resume => {
      const user = userMap.get(resume.user_id)
      const up = userProfileMap.get(resume.user_id)
      const dp = driverProfileMap.get(resume.user_id)
      const profile = up?.first_name ? up : dp

      return {
        ...resume,
        walletAddress: user?.wallet_address || 'Unknown',
        ownerName: profile?.first_name && profile?.last_name
          ? `${profile.first_name} ${profile.last_name}`
          : user?.name || 'Unknown',
        email: user?.email,
      }
    })

    return NextResponse.json({
      success: true,
      resumes: enrichedResumes,
      total: count || 0,
      limit,
      offset,
    })

  } catch (error) {
    console.error('[ADMIN RESUMES] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
