import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'


/**
 * GET /api/developer/projects
 *
 * Fetch all projects for the authenticated developer
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()

    // Fetch projects
    const { data: projects, error: projectsError } = await supabase
      .from('developer_projects')
      .select('*')
      .eq('user_id', userId)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false })

    if (projectsError) {
      console.error('[PROJECTS GET] Error:', projectsError)
      return NextResponse.json(
        { error: 'Failed to fetch projects' },
        { status: 500 }
      )
    }

    // Map snake_case to camelCase for frontend
    const mapped = (projects || []).map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      longDescription: p.long_description,
      techStack: p.tech_stack ?? [],
      liveUrl: p.live_url,
      repoUrl: p.repo_url,
      demoVideoUrl: p.demo_video_url,
      thumbnailUrl: p.thumbnail_url,
      screenshots: p.screenshots ?? [],
      role: p.role,
      teamSize: p.team_size,
      startDate: p.start_date,
      endDate: p.end_date,
      isOngoing: p.is_ongoing,
      isFeatured: p.is_featured,
      isPublic: p.is_public,
      displayOrder: p.display_order,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }))

    return NextResponse.json({
      success: true,
      projects: mapped,
    })
  } catch (error) {
    console.error('[PROJECTS GET] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/developer/projects
 *
 * Create a new portfolio project
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const {
      title,
      description,
      longDescription,
      techStack,
      liveUrl,
      repoUrl,
      demoVideoUrl,
      thumbnailUrl,
      screenshots,
      role,
      teamSize,
      startDate,
      endDate,
      isOngoing,
      isFeatured,
      isPublic,
    } = body

    if (!title) {
      return NextResponse.json(
        { error: 'Project title is required' },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    // Get next display order
    const { data: existingProjects } = await supabase
      .from('developer_projects')
      .select('display_order')
      .eq('user_id', userId)
      .order('display_order', { ascending: false })
      .limit(1)

    const nextDisplayOrder = existingProjects?.[0]?.display_order
      ? existingProjects[0].display_order + 1
      : 0

    // Create project
    const { data: project, error: createError } = await supabase
      .from('developer_projects')
      .insert({
        user_id: userId,
        developer_profile_id: null,
        title,
        description: description || null,
        long_description: longDescription || null,
        tech_stack: techStack || [],
        live_url: liveUrl || null,
        repo_url: repoUrl || null,
        demo_video_url: demoVideoUrl || null,
        thumbnail_url: thumbnailUrl || null,
        screenshots: screenshots || [],
        role: role || 'solo',
        team_size: teamSize || null,
        start_date: startDate || null,
        end_date: endDate || null,
        is_ongoing: isOngoing || false,
        is_featured: isFeatured || false,
        is_public: isPublic !== false, // Default to true
        display_order: nextDisplayOrder,
      })
      .select()
      .single()

    if (createError) {
      console.error('[PROJECTS POST] Error:', createError)
      return NextResponse.json(
        { error: 'Failed to create project' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      project,
    })
  } catch (error) {
    console.error('[PROJECTS POST] Error:', error)
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/developer/projects
 *
 * Update an existing project
 */
export async function PUT(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    // Verify ownership
    const { data: existingProject } = await supabase
      .from('developer_projects')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (!existingProject) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      )
    }

    // Map camelCase to snake_case for DB
    const dbUpdates: Record<string, unknown> = {}
    if (updates.title !== undefined) dbUpdates.title = updates.title
    if (updates.description !== undefined)
      dbUpdates.description = updates.description
    if (updates.longDescription !== undefined)
      dbUpdates.long_description = updates.longDescription
    if (updates.techStack !== undefined)
      dbUpdates.tech_stack = updates.techStack
    if (updates.liveUrl !== undefined) dbUpdates.live_url = updates.liveUrl
    if (updates.repoUrl !== undefined) dbUpdates.repo_url = updates.repoUrl
    if (updates.demoVideoUrl !== undefined)
      dbUpdates.demo_video_url = updates.demoVideoUrl
    if (updates.thumbnailUrl !== undefined)
      dbUpdates.thumbnail_url = updates.thumbnailUrl
    if (updates.screenshots !== undefined)
      dbUpdates.screenshots = updates.screenshots
    if (updates.role !== undefined) dbUpdates.role = updates.role
    if (updates.teamSize !== undefined) dbUpdates.team_size = updates.teamSize
    if (updates.startDate !== undefined)
      dbUpdates.start_date = updates.startDate
    if (updates.endDate !== undefined) dbUpdates.end_date = updates.endDate
    if (updates.isOngoing !== undefined)
      dbUpdates.is_ongoing = updates.isOngoing
    if (updates.isFeatured !== undefined)
      dbUpdates.is_featured = updates.isFeatured
    if (updates.isPublic !== undefined) dbUpdates.is_public = updates.isPublic
    if (updates.displayOrder !== undefined)
      dbUpdates.display_order = updates.displayOrder

    // Update project
    const { data: project, error: updateError } = await supabase
      .from('developer_projects')
      .update(dbUpdates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (updateError) {
      console.error('[PROJECTS PUT] Error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update project' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      project,
    })
  } catch (error) {
    console.error('[PROJECTS PUT] Error:', error)
    return NextResponse.json(
      { error: 'Failed to update project' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/developer/projects
 *
 * Delete a project
 */
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    const url = new URL(request.url)
    const projectId = url.searchParams.get('id')

    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    // Delete project (ownership verified by user_id match)
    const { error: deleteError } = await supabase
      .from('developer_projects')
      .delete()
      .eq('id', projectId)
      .eq('user_id', userId)

    if (deleteError) {
      console.error('[PROJECTS DELETE] Error:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete project' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Project deleted',
    })
  } catch (error) {
    console.error('[PROJECTS DELETE] Error:', error)
    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 }
    )
  }
}
