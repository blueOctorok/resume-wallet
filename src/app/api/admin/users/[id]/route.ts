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

    // Get unified profile (primary source for name/email)
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', id)
      .maybeSingle()

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
      userProfile,
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

    // GUARD: Warn (but allow) deleting admin wallets — useful for dev/test reset
    if (isAdminWallet(user.wallet_address)) {
      const forceDelete = request.headers.get('x-force-admin-delete') === 'true'
      if (!forceDelete) {
        console.warn(
          `[ADMIN] Attempted to delete admin wallet: ${user.wallet_address} — requires x-force-admin-delete header`
        )
        return NextResponse.json(
          {
            error:
              'This is an admin wallet. To confirm deletion, please try again with the force option.',
            isAdminWallet: true,
          },
          { status: 403 }
        )
      }
      console.warn(`[ADMIN] Force-deleting admin wallet: ${user.wallet_address} by: ${auth.walletAddress}`)
    }

    // Delete in order (respecting foreign key constraints)
    // 1. Company memberships (user is a team member)
    await supabase.from('company_members').delete().eq('user_id', id)

    // 2. Delete MVR results and orders
    await supabase.from('mvr_results').delete().eq('driver_user_id', id)
    await supabase.from('mvr_orders').delete().eq('driver_user_id', id)

    // 3. Delete resumes and driver applications
    await supabase.from('resumes').delete().eq('user_id', id)
    await supabase.from('driver_applications').delete().eq('user_id', id)

    // 4. Delete profiles
    await supabase.from('driver_profiles').delete().eq('user_id', id)
    await supabase.from('user_profiles').delete().eq('user_id', id)
    await supabase.from('developer_projects').delete().eq('user_id', id)
    await supabase.from('developer_profiles').delete().eq('user_id', id)

    // 5. Delete payments and candidate requests
    await supabase.from('payments').delete().eq('user_id', id)
    await supabase.from('candidate_requests').delete().eq('requested_by_user_id', id)

    // 6. Delete employer-created data rows where this user was the creator
    //    (employer_candidate_data.created_by is NOT NULL, so we must delete instead of null)
    await supabase.from('employer_candidate_data').delete().eq('created_by', id)

    // 7. NULL OUT non-cascade FK references that would block the users row delete.
    //    These columns reference users(id) with no ON DELETE action (default = RESTRICT),
    //    meaning Postgres refuses to delete the user row if any row still points to it.
    //    We null them out so the final delete can proceed cleanly.
    await supabase.from('companies').update({ approved_by: null }).eq('approved_by', id)
    await supabase.from('companies').update({ suspended_by: null }).eq('suspended_by', id)
    await supabase.from('company_status_history').update({ changed_by: null }).eq('changed_by', id)
    await supabase.from('applications').update({ recruited_by_user_id: null }).eq('recruited_by_user_id', id)
    await supabase.from('mvr_orders').update({ ordered_by_user_id: null }).eq('ordered_by_user_id', id)
    await supabase.from('employer_candidate_data').update({ updated_by: null }).eq('updated_by', id)
    await supabase.from('company_members').update({ invited_by: null }).eq('invited_by', id)

    // 8. Delete the user
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
