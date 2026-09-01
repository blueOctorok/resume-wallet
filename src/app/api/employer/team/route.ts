import { NextRequest, NextResponse } from 'next/server'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getEmployerCompanyAccess } from '@/lib/employer-company-access'
import { can, capabilityDeniedMessage } from '@/lib/employer-permissions'
import { createCompanyMemberInvite } from '@/lib/create-company-member-invite'
import { teamInviteUrl } from '@/lib/app-url'

// All valid roles for company members
const VALID_ROLES = ['owner', 'admin', 'hr_manager', 'hiring_manager', 'recruiter', 'interviewer', 'viewer']

/**
 * GET /api/employer/team
 * 
 * Lists all team members for the user's company.
 * Requires owner or admin role.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()

    const access = await getEmployerCompanyAccess(supabase, userId)
    if (!access) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const companyId = access.companyId
    const userRole = access.companyRole

    // The docblock has always said owner/admin; nothing enforced it, so every
    // member — down to a viewer — could enumerate the company roster with emails.
    if (!can(userRole, 'manageTeam')) {
      return NextResponse.json({ error: capabilityDeniedMessage('manageTeam') }, { status: 403 })
    }

    // Get all team members (use user_id FK so PostgREST knows which users relation we want)
    const { data: members, error: membersError } = await supabase
      .from('company_members')
      .select(`
        id,
        user_id,
        role,
        job_scope,
        candidate_scope,
        invited_by,
        invite_email,
        invite_token,
        invited_at,
        accepted_at,
        is_active,
        created_at,
        users!company_members_user_id_fkey (
          id,
          email,
          wallet_address
        )
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    if (membersError) {
      console.error('[TEAM] Error fetching members:', membersError)
      return NextResponse.json(
        { error: 'Failed to fetch team members' },
        { status: 500 }
      )
    }

    // Batch-fetch names from user_profiles for all members with a user_id
    const memberUserIds = (members || [])
      .map(m => m.user_id)
      .filter((id): id is string => !!id)

    const { data: profiles } = memberUserIds.length > 0
      ? await supabase
          .from('user_profiles')
          .select('user_id, first_name, last_name')
          .in('user_id', memberUserIds)
      : { data: [] }

    const profileNameMap = new Map(
      (profiles || []).map(p => [
        p.user_id,
        [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || null,
      ])
    )

    // Process members
    const processedMembers = (members || []).map(member => {
      const memberUser = member.users as any
      return {
        id: member.id,
        userId: member.user_id,
        role: member.role,
        name: (member.user_id ? profileNameMap.get(member.user_id) : null) ?? null,
        email: memberUser?.email || member.invite_email,
        legacyWalletAddress: memberUser?.wallet_address || null,
        isActive: member.is_active,
        isPending: !member.accepted_at,
        invitedAt: member.invited_at,
        acceptedAt: member.accepted_at,
        inviteUrl: !member.accepted_at && member.invite_token
          ? teamInviteUrl(member.invite_token)
          : null,
        jobScope: member.job_scope,
        candidateScope: member.candidate_scope,
      }
    })

    // Count by role
    const roleBreakdown = VALID_ROLES.reduce((acc, role) => {
      acc[role] = processedMembers.filter(m => m.role === role && m.isActive).length
      return acc
    }, {} as Record<string, number>)

    return NextResponse.json({
      success: true,
      members: processedMembers,
      currentUserRole: userRole,
      canManageTeam: can(userRole, 'manageTeam'),
      stats: {
        total: processedMembers.filter(m => m.isActive).length,
        pending: processedMembers.filter(m => m.isPending).length,
        roleBreakdown,
      }
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
 * POST /api/employer/team
 * 
 * Invites a new team member to the company.
 * Requires owner or admin role.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    const body = await request.json()
    const { email, role, jobScope, candidateScope } = body

    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    if (!email || !role) {
      return NextResponse.json(
        { error: 'Email and role are required' },
        { status: 400 }
      )
    }

    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` },
        { status: 400 }
      )
    }

    // Can't invite another owner
    if (role === 'owner') {
      return NextResponse.json(
        { error: 'Cannot invite another owner. Transfer ownership instead.' },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    const { data: user } = await supabase
      .from('users')
      .select('id, email')
      .eq('id', userId)
      .maybeSingle()

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // This login is not on a company_members row and does not own a company.
    // Common when Central Admin is open on an admin-only account, or a leftover
    // employer role with no Pace membership.
    const access = await getEmployerCompanyAccess(supabase, userId)
    if (!access) {
      return NextResponse.json(
        {
          error:
            'This login is not linked to a company. Sign in as a Pace owner/admin, or invite from Central Admin → Companies.',
        },
        { status: 404 },
      )
    }

    if (!can(access.companyRole, 'manageTeam')) {
      return NextResponse.json(
        { error: capabilityDeniedMessage('manageTeam') },
        { status: 403 }
      )
    }

    const result = await createCompanyMemberInvite(supabase, {
      companyId: access.companyId,
      email,
      role,
      invitedByUserId: user.id,
      inviterFallbackName: user.email,
      jobScope,
      candidateScope,
    })

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, details: result.details },
        { status: result.status },
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Invitation sent successfully',
      member: {
        id: result.memberId,
        email: result.email,
        role: result.role,
        isPending: true,
      },
      inviteUrl: result.inviteUrl,
    })

  } catch (error) {
    console.error('[TEAM] Error inviting member:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
