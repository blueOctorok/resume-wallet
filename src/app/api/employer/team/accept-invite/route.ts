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

    // Get user
    const { data: user } = await supabase
      .from('users')
      .select('id, email')
      .ilike('wallet_address', walletAddress)
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

    // Verify email matches (case-insensitive)
    if (user.email?.toLowerCase() !== invite.invite_email?.toLowerCase()) {
      return NextResponse.json(
        { error: 'This invitation was sent to a different email address. Please log in with the invited email.' },
        { status: 403 }
      )
    }

    // Check if user already has a membership in any company
    const { data: existingMembership } = await supabase
      .from('company_members')
      .select('id, company_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
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
