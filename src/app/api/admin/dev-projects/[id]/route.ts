import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'

/**
 * GET /api/admin/dev-projects/[id]
 * Get detailed developer project information
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAdmin(request)
  if (!auth.authorized) return auth.error!

  const { id } = await params

  try {
    const supabase = await getAdminSupabaseClient()

    const { data: project, error } = await supabase
      .from('developer_projects')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !project) {
      return NextResponse.json(
        { error: 'Developer project not found' },
        { status: 404 }
      )
    }

    // Get user info
    const { data: user } = await supabase
      .from('users')
      .select('wallet_address, email')
      .eq('id', project.user_id)
      .single()

    // Get developer profile info if linked
    let profileInfo = null
    if (project.developer_profile_id) {
      const { data: profile } = await supabase
        .from('developer_profiles')
        .select('id, full_name, github_username, headline')
        .eq('id', project.developer_profile_id)
        .single()
      profileInfo = profile
    }

    return NextResponse.json({
      success: true,
      project: {
        ...project,
        walletAddress: user?.wallet_address,
      },
      profile: profileInfo,
    })
  } catch (error) {
    console.error('[ADMIN DEV PROJECT DETAIL] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/dev-projects/[id]
 * Delete a developer project
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAdmin(request)
  if (!auth.authorized) return auth.error!

  const { id } = await params

  try {
    const supabase = await getAdminSupabaseClient()

    // Verify project exists
    const { data: project, error: findError } = await supabase
      .from('developer_projects')
      .select('id, user_id, name')
      .eq('id', id)
      .single()

    if (findError || !project) {
      return NextResponse.json(
        { error: 'Developer project not found' },
        { status: 404 }
      )
    }

    // Delete project
    const { error: deleteError } = await supabase
      .from('developer_projects')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('[ADMIN DEV PROJECT DELETE] Error:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete developer project' },
        { status: 500 }
      )
    }

    console.log(
      `[ADMIN] Developer project deleted: ${id} (${project.name}) by admin: ${auth.walletAddress}`
    )

    return NextResponse.json({
      success: true,
      message: `Developer project "${project.name}" deleted`,
    })
  } catch (error) {
    console.error('[ADMIN DEV PROJECT DELETE] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
