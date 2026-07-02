import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { requireAdmin, isAdminEmail } from '@/lib/admin-auth'
import {
  getCdlData, getDriverEmployment, getMvrData, getSkills, getEducation,
  getDevGithub, getDevPortfolio, getDevProfile,
} from '@/lib/block-data'

/**
 * GET /api/admin/users/[id]
 * Get detailed user information including all associated data
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request)
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

    // Parallel reads from block tables
    const [
      userProfile,
      cdl, employment, mvr, skills, education,
      devGithub, devPortfolio, devProfileData,
      devProjects, resumes, dotApps, mvrOrders,
    ] = await Promise.all([
      supabase.from('user_profiles').select('*').eq('user_id', id).maybeSingle().then(r => r.data),
      getCdlData(supabase, id),
      getDriverEmployment(supabase, id),
      getMvrData(supabase, id),
      getSkills(supabase, id),
      getEducation(supabase, id),
      getDevGithub(supabase, id),
      getDevPortfolio(supabase, id),
      getDevProfile(supabase, id),
      supabase.from('developer_projects')
        .select('id, name, description, tech_stack, is_featured, is_public, role, created_at')
        .eq('user_id', id).order('created_at', { ascending: false }).then(r => r.data),
      supabase.from('resumes')
        .select('id, title, filename, verification_status, created_at, resume_type')
        .eq('user_id', id).order('created_at', { ascending: false }).then(r => r.data),
      supabase.from('driver_applications')
        .select('id, is_complete, current_step, verification_status, created_at')
        .eq('user_id', id).order('created_at', { ascending: false }).then(r => r.data),
      supabase.from('mvr_orders')
        .select('id, status, dl_state, created_at')
        .eq('driver_user_id', id).order('created_at', { ascending: false }).then(r => r.data),
    ])

    // Compose driver profile from block data (same shape the frontend expects)
    const hasDriverData = cdl || employment.length > 0 || mvr
    const profile = hasDriverData ? {
      user_id: id,
      cdl_number: cdl?.cdl_number ?? null,
      cdl_state: cdl?.cdl_state ?? null,
      cdl_class: cdl?.cdl_class ?? null,
      cdl_expiration: cdl?.cdl_expiration ?? null,
      endorsements: cdl?.endorsements ?? [],
      restrictions: cdl?.restrictions ?? [],
      employment_history: employment,
      skills,
      education,
      mvr,
      created_at: cdl?.created_at ?? null,
      updated_at: cdl?.updated_at ?? null,
    } : null

    // Compose developer profile from block data
    const hasDevData = devGithub || devPortfolio || devProfileData
    const devProfile = hasDevData ? {
      user_id: id,
      github_username: devGithub?.username ?? null,
      portfolio_url: devPortfolio?.portfolio_url ?? null,
      linkedin_url: devPortfolio?.linkedin_url ?? null,
      bio: devProfileData?.bio ?? null,
      available_for_work: devProfileData?.available_for_work ?? false,
      years_experience: devProfileData?.years_experience ?? null,
      job_types: devProfileData?.job_types ?? [],
      work_styles: devProfileData?.work_styles ?? [],
      created_at: devProfileData?.created_at ?? devGithub?.created_at ?? null,
      updated_at: devProfileData?.updated_at ?? devGithub?.updated_at ?? null,
    } : null

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
  const auth = await requireAdmin(request)
  if (!auth.authorized) return auth.error!

  const { id } = await params

  try {
    const supabase = await getAdminSupabaseClient()

    // Verify user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, wallet_address, email')
      .eq('id', id)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Admin access is env-based (ADMIN_EMAILS), not DB-based — deleting
    // the user row doesn't affect admin capabilities. Just log it.
    if (isAdminEmail(user.email)) {
      console.warn(`[ADMIN] Deleting admin user: ${user.email} by: ${auth.email}`)
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

    // 4. Delete profiles and projects (block_* tables cascade via users FK)
    await supabase.from('user_profiles').delete().eq('user_id', id)
    await supabase.from('developer_projects').delete().eq('user_id', id)

    // 5. Payments — storm_distributions.payment_id → payments(id) (FK, no ON DELETE in 044)
    const { data: userPaymentRows, error: paymentsSelectError } = await supabase
      .from('payments')
      .select('id')
      .eq('user_id', id)

    if (paymentsSelectError) {
      console.error('[ADMIN USER DELETE] payments select:', paymentsSelectError)
      return NextResponse.json(
        {
          error: 'Failed to prepare user deletion',
          details: paymentsSelectError.message,
          code: paymentsSelectError.code,
        },
        { status: 500 }
      )
    }

    const paymentIds = (userPaymentRows ?? []).map((r) => r.id).filter(Boolean)
    if (paymentIds.length > 0) {
      const { error: stormDistError } = await supabase
        .from('storm_distributions')
        .delete()
        .in('payment_id', paymentIds)

      if (stormDistError) {
        console.error('[ADMIN USER DELETE] storm_distributions delete:', stormDistError)
        return NextResponse.json(
          {
            error: 'Failed to clear ZKnight distribution rows for this user',
            details: stormDistError.message,
            code: stormDistError.code,
          },
          { status: 500 }
        )
      }
    }

    await supabase.from('payments').delete().eq('user_id', id)

    // 5b. Candidate requests (employer-initiated)
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
    // Admin who approved/rejected employer access requests — common when wiping an admin test account
    await supabase.from('employer_access_requests').update({ reviewed_by: null }).eq('reviewed_by', id)

    // 8. Delete the user
    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('[ADMIN USER DELETE] Error:', deleteError)
      return NextResponse.json(
        {
          error: 'Failed to delete user',
          details: deleteError.message,
          code: deleteError.code,
          hint: deleteError.hint ?? undefined,
        },
        { status: 500 }
      )
    }

    console.log(
      `[ADMIN] User deleted: ${user.wallet_address} by admin: ${auth.email}`
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
