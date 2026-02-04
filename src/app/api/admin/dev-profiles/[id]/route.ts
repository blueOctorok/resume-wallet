import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'

/**
 * GET /api/admin/dev-profiles/[id]
 * Get detailed developer profile information
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

    const { data: profile, error } = await supabase
      .from('developer_profiles')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !profile) {
      return NextResponse.json(
        { error: 'Developer profile not found' },
        { status: 404 }
      )
    }

    // Get user info
    const { data: user } = await supabase
      .from('users')
      .select('wallet_address, email, name')
      .eq('id', profile.user_id)
      .single()

    // Get projects for this profile
    const { data: projects } = await supabase
      .from('developer_projects')
      .select(
        'id, name, description, tech_stack, is_featured, is_public, created_at'
      )
      .eq('developer_profile_id', id)
      .order('created_at', { ascending: false })

    return NextResponse.json({
      success: true,
      profile: {
        ...profile,
        walletAddress: user?.wallet_address,
      },
      projects: projects || [],
    })
  } catch (error) {
    console.error('[ADMIN DEV PROFILE DETAIL] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/dev-profiles/[id]
 * Delete a developer profile (cascades to projects)
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

    // Verify profile exists
    const { data: profile, error: findError } = await supabase
      .from('developer_profiles')
      .select('id, user_id, full_name, github_username')
      .eq('id', id)
      .single()

    if (findError || !profile) {
      return NextResponse.json(
        { error: 'Developer profile not found' },
        { status: 404 }
      )
    }

    // Delete profile (projects cascade delete via FK)
    const { error: deleteError } = await supabase
      .from('developer_profiles')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('[ADMIN DEV PROFILE DELETE] Error:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete developer profile' },
        { status: 500 }
      )
    }

    console.log(
      `[ADMIN] Developer profile deleted: ${id} (${profile.full_name || profile.github_username || 'unnamed'}) by admin: ${auth.walletAddress}`
    )

    return NextResponse.json({
      success: true,
      message: `Developer profile ${profile.full_name || profile.github_username || id} deleted`,
    })
  } catch (error) {
    console.error('[ADMIN DEV PROFILE DELETE] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
