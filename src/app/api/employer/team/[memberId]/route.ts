import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

// Roles that can manage team members
const TEAM_ADMIN_ROLES = ['owner', 'admin']

// All valid roles for company members
const VALID_ROLES = ['owner', 'admin', 'hr_manager', 'hiring_manager', 'recruiter', 'interviewer', 'viewer']

/**
 * PATCH /api/employer/team/[memberId]
 * 
 * Updates a team member's role or scope.
 * Requires owner or admin role.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    const { memberId } = await params
    const body = await request.json()
    const { role, jobScope, candidateScope, isActive, displayName } = body

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 401 }
      )
    }

    if (!memberId) {
      return NextResponse.json(
        { error: 'Member ID is required' },
        { status: 400 }
      )
    }

    if (role && !VALID_ROLES.includes(role)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    // Get user
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .ilike('wallet_address', walletAddress)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get user's company membership
    const { data: membership } = await supabase
      .from('company_members')
      .select('company_id, role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    let companyId = membership?.company_id
    let userRole = membership?.role

    if (!companyId) {
      const { data: legacyCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('employer_user_id', user.id)
        .single()
      
      companyId = legacyCompany?.id
      userRole = 'owner'
    }

    if (!companyId) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    // Check if user can manage team
    if (!TEAM_ADMIN_ROLES.includes(userRole || '')) {
      return NextResponse.json(
        { error: 'You do not have permission to manage team members' },
        { status: 403 }
      )
    }

    // Get the target member
    const { data: targetMember } = await supabase
      .from('company_members')
      .select('id, company_id, role, user_id')
      .eq('id', memberId)
      .single()

    if (!targetMember) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    // Verify member belongs to same company
    if (targetMember.company_id !== companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Can't modify owner unless you ARE the owner
    if (targetMember.role === 'owner' && userRole !== 'owner') {
      return NextResponse.json(
        { error: 'Only the owner can modify their own profile' },
        { status: 403 }
      )
    }

    // Can't demote yourself if you're the only owner (only check when role is explicitly being changed)
    if (role !== undefined && targetMember.user_id === user.id && targetMember.role === 'owner' && role !== 'owner') {
      const { count } = await supabase
        .from('company_members')
        .select('id', { count: 'exact' })
        .eq('company_id', companyId)
        .eq('role', 'owner')
        .eq('is_active', true)

      if ((count || 0) <= 1) {
        return NextResponse.json(
          { error: 'Cannot demote the only owner. Transfer ownership first.' },
          { status: 400 }
        )
      }
    }

    // Handle display name update (updates user record, not company_members)
    if (displayName !== undefined && targetMember.user_id) {
      const { error: nameError } = await supabase
        .from('users')
        .update({ name: displayName.trim() })
        .eq('id', targetMember.user_id)

      if (nameError) {
        console.error('[TEAM] Error updating display name:', nameError)
        return NextResponse.json(
          { error: 'Failed to update display name' },
          { status: 500 }
        )
      }

      // If only updating display name, return early
      if (role === undefined && jobScope === undefined && candidateScope === undefined && isActive === undefined) {
        return NextResponse.json({
          success: true,
          message: 'Display name updated successfully',
        })
      }
    }

    // Build update data for company_members table
    const updateData: Record<string, unknown> = {}
    if (role !== undefined) updateData.role = role
    if (jobScope !== undefined) updateData.job_scope = jobScope
    if (candidateScope !== undefined) updateData.candidate_scope = candidateScope
    if (isActive !== undefined) updateData.is_active = isActive

    if (Object.keys(updateData).length === 0 && displayName === undefined) {
      return NextResponse.json(
        { error: 'No update data provided' },
        { status: 400 }
      )
    }

    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from('company_members')
        .update(updateData)
        .eq('id', memberId)

      if (updateError) {
        console.error('[TEAM] Error updating member:', updateError)
        return NextResponse.json(
          { error: 'Failed to update member' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Team member updated successfully',
    })

  } catch (error) {
    console.error('[TEAM] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/employer/team/[memberId]
 * 
 * Removes a team member from the company.
 * Requires owner or admin role.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    const { memberId } = await params

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 401 }
      )
    }

    if (!memberId) {
      return NextResponse.json(
        { error: 'Member ID is required' },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    // Get user
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .ilike('wallet_address', walletAddress)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get user's company membership
    const { data: membership } = await supabase
      .from('company_members')
      .select('company_id, role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    let companyId = membership?.company_id
    let userRole = membership?.role

    if (!companyId) {
      const { data: legacyCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('employer_user_id', user.id)
        .single()
      
      companyId = legacyCompany?.id
      userRole = 'owner'
    }

    if (!companyId) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    // Check if user can manage team
    if (!TEAM_ADMIN_ROLES.includes(userRole || '')) {
      return NextResponse.json(
        { error: 'You do not have permission to remove team members' },
        { status: 403 }
      )
    }

    // Get the target member
    const { data: targetMember } = await supabase
      .from('company_members')
      .select('id, company_id, role, user_id')
      .eq('id', memberId)
      .single()

    if (!targetMember) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    // Verify member belongs to same company
    if (targetMember.company_id !== companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Can't remove an owner unless you're an owner
    if (targetMember.role === 'owner' && userRole !== 'owner') {
      return NextResponse.json(
        { error: 'Only the owner can remove another owner' },
        { status: 403 }
      )
    }

    // Can't remove yourself if you're the only owner
    if (targetMember.user_id === user.id && targetMember.role === 'owner') {
      const { count } = await supabase
        .from('company_members')
        .select('id', { count: 'exact' })
        .eq('company_id', companyId)
        .eq('role', 'owner')
        .eq('is_active', true)

      if ((count || 0) <= 1) {
        return NextResponse.json(
          { error: 'Cannot remove the only owner. Transfer ownership first.' },
          { status: 400 }
        )
      }
    }

    // Delete the member
    const { error: deleteError } = await supabase
      .from('company_members')
      .delete()
      .eq('id', memberId)

    if (deleteError) {
      console.error('[TEAM] Error removing member:', deleteError)
      return NextResponse.json(
        { error: 'Failed to remove member' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Team member removed successfully',
    })

  } catch (error) {
    console.error('[TEAM] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
