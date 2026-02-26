import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { randomUUID } from 'crypto'
import { sendTeamInviteEmail } from '@/lib/send-team-invite-email'

// Roles that can manage team members
const TEAM_ADMIN_ROLES = ['owner', 'admin']

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
    const walletAddress = request.headers.get('x-wallet-address')

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 401 }
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

    // Fall back to legacy check
    let companyId = membership?.company_id
    let userRole = membership?.role

    if (!companyId) {
      const { data: legacyCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('employer_user_id', user.id)
        .single()
      
      companyId = legacyCompany?.id
      userRole = 'owner' // Legacy single-owner is always owner
    }

    if (!companyId) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
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
          name,
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

    // Process members
    const processedMembers = (members || []).map(member => {
      const memberUser = member.users as any
      return {
        id: member.id,
        userId: member.user_id,
        role: member.role,
        name: memberUser?.name || null,
        email: memberUser?.email || member.invite_email,
        walletAddress: memberUser?.wallet_address || null,
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
      canManageTeam: TEAM_ADMIN_ROLES.includes(userRole || ''),
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
    const walletAddress = request.headers.get('x-wallet-address')
    const body = await request.json()
    const { email, role, jobScope, candidateScope } = body

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 401 }
      )
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

    // Get user with name for invite email
    const { data: user } = await supabase
      .from('users')
      .select('id, name, email')
      .ilike('wallet_address', walletAddress)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get user's company membership and verify they can manage team
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
        { error: 'You do not have permission to invite team members' },
        { status: 403 }
      )
    }

    // Get company details for domain validation
    const { data: company } = await supabase
      .from('companies')
      .select('company_name, email, designated_owner_email')
      .eq('id', companyId)
      .single()

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    // Validate email domain - ALWAYS block public domains for employer team members
    const inviteDomain = email.split('@')[1]?.toLowerCase()
    
    // List of public email domains that should never be allowed for employers
    const publicDomains = [
      'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
      'icloud.com', 'mail.com', 'protonmail.com', 'zoho.com', 'yandex.com',
      'live.com', 'msn.com', 'me.com', 'inbox.com', 'gmx.com'
    ]

    // Always block public email domains
    if (publicDomains.includes(inviteDomain)) {
      return NextResponse.json(
        { 
          error: 'Personal email addresses are not allowed for team members',
          details: 'Please use a company email address (e.g., name@yourcompany.com)'
        },
        { status: 400 }
      )
    }

    // If company has a business email, require invites to match that domain
    const companyEmail = company.email || company.designated_owner_email
    if (companyEmail) {
      const companyDomain = companyEmail.split('@')[1]?.toLowerCase()
      
      // Only enforce domain match if company uses a business domain (not a public one)
      if (companyDomain && !publicDomains.includes(companyDomain)) {
        if (inviteDomain !== companyDomain) {
          return NextResponse.json(
            { 
              error: `Team members must use a company email address (@${companyDomain})`,
              details: `${company.company_name} requires team members to have a @${companyDomain} email address.`
            },
            { status: 400 }
          )
        }
      }
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

    // Send invite email (non-blocking)
    sendTeamInviteEmail({
      to: email,
      inviterName: user.name || user.email || 'Your team admin',
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
