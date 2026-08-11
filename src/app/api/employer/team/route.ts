import { NextRequest, NextResponse } from 'next/server'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { randomUUID } from 'crypto'
import { sendTeamInviteEmail } from '@/lib/send-team-invite-email'
import { checkEmailAgainstCompanyDomains } from '@/lib/employer-domain-match'
import { getEmployerCompanyAccess } from '@/lib/employer-company-access'
import { can, capabilityDeniedMessage } from '@/lib/employer-permissions'

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
      .single()

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const access = await getEmployerCompanyAccess(supabase, userId)
    if (!access) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const companyId = access.companyId

    if (!can(access.companyRole, 'manageTeam')) {
      return NextResponse.json(
        { error: capabilityDeniedMessage('manageTeam') },
        { status: 403 }
      )
    }

    // Get company details for domain validation
    const { data: company } = await supabase
      .from('companies')
      .select('company_name, email, designated_owner_email, allowed_email_domains')
      .eq('id', companyId)
      .single()

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    // The company's declared domain policy is the boundary. This used to be a
    // local 15-entry public-domain list plus a derivation from companies.email,
    // which silently skipped enforcement whenever the company's contact address
    // was itself a consumer inbox.
    const domainCheck = checkEmailAgainstCompanyDomains({
      allowedDomains: company.allowed_email_domains,
      email,
      companyName: company.company_name,
      legacyCompanyEmail: company.email || company.designated_owner_email,
    })

    if (!domainCheck.allowed) {
      return NextResponse.json(
        { error: domainCheck.error, details: domainCheck.details },
        { status: 400 }
      )
    }

    // Check if user with this email already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, email, wallet_address')
      .ilike('email', email)
      .maybeSingle()

    // Check if this user/email is already a member of THIS company
    if (existingUser) {
      const { data: existingMember } = await supabase
        .from('company_members')
        .select('id, is_active, accepted_at')
        .eq('company_id', companyId)
        .eq('user_id', existingUser.id)
        .eq('is_active', true)
        .maybeSingle()

      if (existingMember) {
        // If there's a stale record (user was deleted but record lingered), clean it up
        if (!existingMember.accepted_at) {
          console.log('[TEAM] Found stale membership record, deleting:', existingMember.id)
          await supabase
            .from('company_members')
            .delete()
            .eq('id', existingMember.id)
        } else {
          console.log('[TEAM] User already a member:', { email, memberId: existingMember.id })
          return NextResponse.json(
            { error: 'This user is already a team member' },
            { status: 409 }
          )
        }
      }
    }

    // Check if there's already a pending invite for this email
    // Must be active and not expired
    const { data: pendingInvite } = await supabase
      .from('company_members')
      .select('id, invite_expires_at')
      .eq('company_id', companyId)
      .eq('invite_email', email.toLowerCase())
      .eq('is_active', true)
      .is('accepted_at', null)
      .maybeSingle()

    if (pendingInvite) {
      // Check if invite has expired - if so, delete it and allow re-invite
      const expiresAt = pendingInvite.invite_expires_at ? new Date(pendingInvite.invite_expires_at) : null
      if (expiresAt && expiresAt < new Date()) {
        // Delete expired invite
        await supabase
          .from('company_members')
          .delete()
          .eq('id', pendingInvite.id)
        console.log('[TEAM] Deleted expired invite for:', email)
      } else {
        return NextResponse.json(
          { error: 'There is already a pending invite for this email' },
          { status: 409 }
        )
      }
    }

    // Generate invite token (must be UUID format for DB column)
    const inviteToken = randomUUID()

    // Create the membership record
    const { data: newMember, error: insertError } = await supabase
      .from('company_members')
      .insert({
        company_id: companyId,
        user_id: existingUser?.id || null, // Will be null for new users
        role,
        job_scope: jobScope || null,
        candidate_scope: candidateScope || null,
        invited_by: user.id,
        invite_email: email.toLowerCase(),
        invite_token: inviteToken,
        invite_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
        is_active: true,
      })
      .select()
      .single()

    if (insertError) {
      console.error('[TEAM] Error creating invite:', insertError)
      return NextResponse.json(
        { error: 'Failed to create invite' },
        { status: 500 }
      )
    }

    // Build invite URL (company already fetched above for domain validation)
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invite/${inviteToken}`
    const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    // Resolve inviter name from user_profiles
    const { data: inviterProfile } = await supabase
      .from('user_profiles')
      .select('first_name, last_name')
      .eq('user_id', user.id)
      .maybeSingle()

    const inviterName = [inviterProfile?.first_name, inviterProfile?.last_name].filter(Boolean).join(' ').trim() || user.email || 'Your team admin'

    // Send invite email (non-blocking)
    sendTeamInviteEmail({
      to: email,
      inviterName,
      companyName: company?.company_name || 'Your company',
      role,
      inviteToken,
      expiresAt: inviteExpiresAt,
    }).then(result => {
      if (result.ok) {
        console.log(`[TEAM] Invite email sent to ${email}`)
      } else {
        console.warn(`[TEAM] Failed to send invite email to ${email}:`, result.error)
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Invitation sent successfully',
      member: {
        id: newMember.id,
        email,
        role,
        isPending: true,
      },
      inviteUrl, // Still return for testing/manual sharing
    })

  } catch (error) {
    console.error('[TEAM] Error inviting member:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
