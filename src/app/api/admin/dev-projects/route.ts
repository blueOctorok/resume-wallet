import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'

/**
 * GET /api/admin/dev-projects
 * List all developer projects
 *
 * Query params:
 *   search - Filter by name or description (partial match)
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
    // Column is `title` not `name` — see migration 011_developer_profiles_and_projects.sql
    let query = supabase
      .from('developer_projects')
      .select(
        'id, user_id, developer_profile_id, title, description, tech_stack, live_url, repo_url, is_featured, is_public, role, created_at, updated_at',
        { count: 'exact' }
      )

    // Apply search filter
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`)
    }

    // Apply pagination and ordering
    const {
      data: projects,
      error,
      count,
    } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('[ADMIN DEV PROJECTS] Query error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch developer projects' },
        { status: 500 }
      )
    }

    // Get wallet addresses and developer names
    const userIds = [...new Set(projects?.map((p) => p.user_id) || [])]
    const profileIds = [
      ...new Set(
        projects?.map((p) => p.developer_profile_id).filter(Boolean) || []
      ),
    ]

    const { data: users } = await supabase
      .from('users')
      .select('id, wallet_address')
      .in('id', userIds)

    const { data: profiles } = await supabase
      .from('developer_profiles')
      .select('id, full_name, github_username')
      .in('id', profileIds)

    const userMap = new Map(users?.map((u) => [u.id, u.wallet_address]) || [])
    const profileMap = new Map(
      profiles?.map((p) => [
        p.id,
        { fullName: p.full_name, github: p.github_username },
      ]) || []
    )

    // Enrich projects
    const enrichedProjects = projects?.map((project) => {
      const profileData = project.developer_profile_id
        ? profileMap.get(project.developer_profile_id)
        : null
      return {
        ...project,
        walletAddress: userMap.get(project.user_id) || 'Unknown',
        ownerName: profileData?.fullName || profileData?.github || 'Unknown',
        techCount: Array.isArray(project.tech_stack)
          ? project.tech_stack.length
          : 0,
      }
    })

    return NextResponse.json({
      success: true,
      projects: enrichedProjects,
      total: count || 0,
      limit,
      offset,
    })
  } catch (error) {
    console.error('[ADMIN DEV PROJECTS] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
