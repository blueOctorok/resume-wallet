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

    // Use block_dev_profile as primary listing table
    let query = supabase
      .from('block_dev_profile')
      .select('id, user_id, bio, available_for_work, created_at, updated_at', { count: 'exact' })

    if (search) {
      query = query.ilike('bio', `%${search}%`)
    }

    const { data: profiles, error, count } = await query
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('[ADMIN DEV PROFILES] Query error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch developer profiles' },
        { status: 500 }
      )
    }

    const userIds = [...new Set(profiles?.map((p) => p.user_id) || [])]

    // Enrich with github, skills, user info, wallet, and project counts
    const [
      { data: users },
      { data: userProfiles },
      { data: githubRows },
      { data: skillRows },
      { data: projects },
    ] = await Promise.all([
      supabase.from('users').select('id, wallet_address').in('id', userIds),
      supabase.from('user_profiles').select('user_id, first_name, last_name, email').in('user_id', userIds),
      supabase.from('block_dev_github').select('user_id, username').in('user_id', userIds),
      supabase.from('block_skills').select('user_id, entries').in('user_id', userIds),
      supabase.from('developer_projects').select('user_id').in('user_id', userIds),
    ])

    const userMap = new Map(users?.map(u => [u.id, u.wallet_address]) || [])
    const upMap = new Map((userProfiles || []).map(p => [p.user_id, p]))
    const githubMap = new Map((githubRows || []).map(g => [g.user_id, g.username]))
    const skillsMap = new Map((skillRows || []).map(s => [s.user_id, s.entries]))

    const projectCountMap = new Map<string, number>()
    projects?.forEach(p => {
      projectCountMap.set(p.user_id, (projectCountMap.get(p.user_id) || 0) + 1)
    })

    const enrichedProfiles = profiles?.map((profile) => {
      const up = upMap.get(profile.user_id)
      const fullName = [up?.first_name, up?.last_name].filter(Boolean).join(' ')
      const skills = skillsMap.get(profile.user_id) || []
      return {
        ...profile,
        headline: profile.bio,
        github_username: githubMap.get(profile.user_id) ?? null,
        skills,
        first_name: up?.first_name ?? null,
        last_name: up?.last_name ?? null,
        email: up?.email ?? null,
        full_name: fullName || null,
        walletAddress: userMap.get(profile.user_id) || 'Unknown',
        projectCount: projectCountMap.get(profile.user_id) || 0,
        skillCount: Array.isArray(skills) ? skills.length : 0,
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
    console.error('[ADMIN DEV PROFILES] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
