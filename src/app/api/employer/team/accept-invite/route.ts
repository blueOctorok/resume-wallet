import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

/**
 * POST /api/employer/team/accept-invite
 * 
 * Accepts a team invitation using the invite token.
 * Links the authenticated user to the pending membership.
 */
export async function POST(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    const body = await request.json()
    const { inviteToken } = body

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 401 }
      )
    }

    if (!inviteToken) {
      return NextResponse.json(
        { error: 'Invite token is required' },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    // Get or create user — new invitees may have a wallet from Alchemy but no users row yet
    let { data: user } = await supabase
      .from('users')
      .select('id, email')
      .ilike('wallet_address', walletAddress)
      .maybeSingle()

    if (!user) {
      // First time on platform via invite link — create their record
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          wallet_address: walletAddress.toLowerCase(),
          role: 'employer',
        })
        .select('id, email')
        .single()

      if (createError || !newUser) {
        console.error('[ACCEPT INVITE] Failed to create user:', createError)
        return NextResponse.json({ error: 'Failed to create user account' }, { status: 500 })
      }

      user = newUser
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

    // Verify email matches (case-insensitive).
    // If the user has no email stored yet (first sign-in via invite link), we trust the token
    // as proof they own the inbox — then save their email so future checks work.
    if (user.email && user.email.toLowerCase() !== invite.invite_email?.toLowerCase()) {
      return NextResponse.json(
        { error: 'This invitation was sent to a different email address. Please log in with the invited email.' },
        { status: 403 }
      )
    }

    // If user has no email yet, stamp it from the invite (token = proof of inbox ownership)
    if (!user.email && invite.invite_email) {
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

    // Update user role to employer if not already
    await supabase
      .from('users')
      .update({ role: 'employer' })
      .eq('id', user.id)
      .neq('role', 'employer')

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
