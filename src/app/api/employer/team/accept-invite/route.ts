import { NextRequest, NextResponse } from 'next/server'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { addOwnerToCompanyWallet } from '@/lib/company-wallet-server'

/**
 * POST /api/employer/team/accept-invite
 * 
 * Accepts a team invitation using the invite token.
 * Links the authenticated user to the pending membership.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    const body = await request.json()
    const { inviteToken, displayName } = body

    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    if (!inviteToken) {
      return NextResponse.json(
        { error: 'Invite token is required' },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    const { data: user } = await supabase
      .from('users')
      .select('id, email, wallet_address')
      .eq('id', userId)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Find the pending invite
    const { data: invite } = await supabase
      .from('company_members')
      .select(`
        id,
        company_id,
        role,
        invite_email,
        invite_expires_at,
        accepted_at,
        companies (
          company_name
        )
      `)
      .eq('invite_token', inviteToken)
      .is('accepted_at', null)
      .maybeSingle()

    if (!invite) {
      return NextResponse.json(
        { error: 'Invalid or expired invitation' },
        { status: 404 }
      )
    }

    // Check if invite has expired
    if (new Date(invite.invite_expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'This invitation has expired' },
        { status: 410 }
      )
    }

    // Check if this user already has significant activity (existing user, not a fresh invite signup)
    // Check multiple tables to determine if this is an established account
    const [memberships, dotApps, resumes, profiles] = await Promise.all([
      supabase.from('company_members').select('id', { count: 'exact' }).eq('user_id', user.id).neq('id', invite.id),
      supabase.from('driver_applications').select('id', { count: 'exact' }).eq('user_id', user.id),
      supabase.from('resumes').select('id', { count: 'exact' }).eq('user_id', user.id),
      supabase.from('user_profiles').select('id', { count: 'exact' }).eq('user_id', user.id),
    ])
    
    const totalActivity = (memberships.count || 0) + (dotApps.count || 0) + (resumes.count || 0) + (profiles.count || 0)
    const isExistingActiveUser = totalActivity > 0
    
    console.log('[ACCEPT INVITE] User activity check:', { userId: user.id, totalActivity, isExistingActiveUser })

    // Verify email matches (case-insensitive)
    if (user.email && user.email.toLowerCase() !== invite.invite_email?.toLowerCase()) {
      return NextResponse.json(
        { error: 'This invitation was sent to a different email address. Please log in with the invited email.' },
        { status: 403 }
      )
    }

    // If existing active user has no email, they shouldn't accept someone else's invite
    // This prevents accidentally linking the wrong email to an established account
    if (!user.email && invite.invite_email && isExistingActiveUser) {
      console.warn('[ACCEPT INVITE] Blocking: existing user tried to accept invite for different email', {
        userId: user.id,
        inviteEmail: invite.invite_email,
      })
      return NextResponse.json(
        { error: 'You are already registered. This invite was sent to a different person. Please sign in with the invited email address.' },
        { status: 403 }
      )
    }

    // Only stamp email for truly new users (no existing activity)
    if (!user.email && invite.invite_email && !isExistingActiveUser) {
      await supabase
        .from('users')
        .update({ email: invite.invite_email.toLowerCase() })
        .eq('id', user.id)
    }

    // Check if user already has a DIFFERENT accepted membership
    // (exclude this invite, and only count fully accepted ones)
    const { data: existingMembership } = await supabase
      .from('company_members')
      .select('id, company_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .not('accepted_at', 'is', null) // Only accepted memberships, not pending invites
      .neq('id', invite.id) // Exclude this invite (in case user_id was already set)
      .maybeSingle()

    if (existingMembership) {
      return NextResponse.json(
        { error: 'You are already a member of a company. Leave your current company first.' },
        { status: 409 }
      )
    }

    // Accept the invite - link user to membership
    const { error: updateError } = await supabase
      .from('company_members')
      .update({
        user_id: user.id,
        accepted_at: new Date().toISOString(),
        is_active: true,
      })
      .eq('id', invite.id)

    if (updateError) {
      console.error('[TEAM] Error accepting invite:', updateError)
      return NextResponse.json(
        { error: 'Failed to accept invitation' },
        { status: 500 }
      )
    }

    // Update user role to employer and set name if provided
    const userUpdate: Record<string, unknown> = { role: 'employer' }
    if (displayName?.trim()) {
      userUpdate.name = displayName.trim()
    }
    await supabase
      .from('users')
      .update(userUpdate)
      .eq('id', user.id)

    const { data: coRow } = await supabase
      .from('companies')
      .select('wallet_address')
      .eq('id', invite.company_id)
      .maybeSingle()

    if (coRow?.wallet_address && user.wallet_address) {
      try {
        await addOwnerToCompanyWallet({
          companyId: invite.company_id,
          companyWalletAddress: coRow.wallet_address,
          newOwnerSmartAccountAddress: user.wallet_address,
        })
      } catch (chainErr) {
        console.error('[ACCEPT INVITE] addOwnerToCompanyWallet failed:', chainErr)
      }
    }

    const company = invite.companies as any

    return NextResponse.json({
      success: true,
      message: 'Invitation accepted successfully',
      company: {
        id: invite.company_id,
        name: company?.company_name,
      },
      role: invite.role,
    })

  } catch (error) {
    console.error('[TEAM] Error accepting invite:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/employer/team/accept-invite?token=xxx
 * 
 * Gets information about an invitation without accepting it.
 * Can be used to show invite details before accepting.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const inviteToken = searchParams.get('token')

    if (!inviteToken) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    // Find the invite
    const { data: invite } = await supabase
      .from('company_members')
      .select(`
        id,
        role,
        invite_email,
        invite_expires_at,
        accepted_at,
        companies (
          company_name,
          logo_url,
          verified
        )
      `)
      .eq('invite_token', inviteToken)
      .maybeSingle()

    if (!invite) {
      return NextResponse.json(
        { error: 'Invalid invitation' },
        { status: 404 }
      )
    }

    // Check if already accepted
    if (invite.accepted_at) {
      return NextResponse.json(
        { error: 'This invitation has already been accepted' },
        { status: 410 }
      )
    }

    // Check if expired
    const isExpired = new Date(invite.invite_expires_at) < new Date()

    const company = invite.companies as any

    return NextResponse.json({
      success: true,
      invite: {
        role: invite.role,
        email: invite.invite_email,
        expiresAt: invite.invite_expires_at,
        isExpired,
        company: {
          name: company?.company_name,
          logoUrl: company?.logo_url,
          verified: company?.verified,
        },
      },
    })

  } catch (error) {
    console.error('[TEAM] Error fetching invite:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
