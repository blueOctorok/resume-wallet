import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { requireAdmin, isAdminWallet } from '@/lib/admin-auth'

/**
 * GET /api/admin/users/[id]
 * Get detailed user information including all associated data
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

    // Get user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get driver profile
    const { data: profile } = await supabase
      .from('driver_profiles')
      .select('*')
      .eq('user_id', id)
      .maybeSingle()

    // Get developer profile
    const { data: devProfile } = await supabase
      .from('developer_profiles')
      .select('*')
      .eq('user_id', id)
      .maybeSingle()

    // Get developer projects
    const { data: devProjects } = await supabase
      .from('developer_projects')
      .select(
        'id, name, description, tech_stack, is_featured, is_public, role, created_at'
      )
      .eq('user_id', id)
      .order('created_at', { ascending: false })

    // Get resumes
    const { data: resumes } = await supabase
      .from('resumes')
      .select(
        'id, title, filename, verification_status, created_at, resume_type'
      )
      .eq('user_id', id)
      .order('created_at', { ascending: false })

    // Get DOT applications
    const { data: dotApps } = await supabase
      .from('driver_applications')
      .select('id, is_complete, current_step, verification_status, created_at')
      .eq('user_id', id)
      .order('created_at', { ascending: false })

    // Get MVR orders
    const { data: mvrOrders } = await supabase
      .from('mvr_orders')
      .select('id, status, dl_state, created_at')
      .eq('driver_user_id', id)
      .order('created_at', { ascending: false })

    return NextResponse.json({
      success: true,
      user,
      profile,
      devProfile,
      devProjects: devProjects || [],
      resumes: resumes || [],
      dotApps: dotApps || [],
      mvrOrders: mvrOrders || [],
    })
  } catch (error) {
    console.error('[ADMIN USER DETAIL] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/users/[id]
 * Delete a user and all associated data
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

    // Verify user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, wallet_address')
      .eq('id', id)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // GUARD: Prevent deleting admin wallets
    if (isAdminWallet(user.wallet_address)) {
      console.warn(
        `[ADMIN] Blocked attempt to delete admin wallet: ${user.wallet_address} by: ${auth.walletAddress}`
      )
      return NextResponse.json(
        {
          error:
            'Cannot delete admin accounts. Remove wallet from ADMIN_WALLETS env to revoke admin access first.',
        },
        { status: 403 }
      )
    }

    // Delete in order (respecting foreign key constraints)
    // 1. Delete MVR results
    await supabase.from('mvr_results').delete().eq('driver_user_id', id)

    // 2. Delete MVR orders
    await supabase.from('mvr_orders').delete().eq('driver_user_id', id)

    // 3. Delete resumes
    await supabase.from('resumes').delete().eq('user_id', id)

    // 4. Delete driver applications
    await supabase.from('driver_applications').delete().eq('user_id', id)

    // 5. Delete driver profile
    await supabase.from('driver_profiles').delete().eq('user_id', id)

    // 6. Delete developer projects (before dev profile due to FK)
    await supabase.from('developer_projects').delete().eq('user_id', id)

    // 7. Delete developer profile
    await supabase.from('developer_profiles').delete().eq('user_id', id)

    // 8. Delete payments
    await supabase.from('payments').delete().eq('user_id', id)

    // 9. Delete the user
    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('[ADMIN USER DELETE] Error:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete user' },
        { status: 500 }
      )
    }

    console.log(
      `[ADMIN] User deleted: ${user.wallet_address} by admin: ${auth.walletAddress}`
    )

    return NextResponse.json({
      success: true,
      message: `User ${user.wallet_address} and all associated data deleted`,
    })
  } catch (error) {
    console.error('[ADMIN USER DELETE] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
