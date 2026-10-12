import { NextRequest, NextResponse } from 'next/server'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { createClient as createServerSupabase } from '@/utils/supabase/server'
import { ensureUserRow } from '@/lib/user-bootstrap'
import {
  CANDIDATE_CANNOT_BECOME_EMPLOYER,
  isCandidateSurfaceRole,
} from '@/lib/employer-account-guard'

/**
 * POST /api/employer/team/accept-invite
 *
 * Accepts a team invitation using the invite token.
 *
 * Two things accept invites, and both are legitimate:
 *   1. /api/auth/sync → resolveEmployerLink, silently, the moment a new user's
 *      session is created, keyed on the verified email.
 *   2. This route, when the invitee presses Accept on /invite/[token].
 *
 * The invite email sends people to the page, the page sends them to sign-in,
 * and sign-in triggers (1). So by the time (2) runs the row is usually already
 * accepted — by the same person. That must read as success, not "invalid".
 */
export async function POST(request: NextRequest) {
  try {
    // Read the session directly (not getStormUserIdFromRequest) because the
    // verified email is needed too, for bootstrapping the users row below.
    const { data: authData } = await (await createServerSupabase()).auth.getUser()
    const authUser = authData.user
    const body = await request.json()
    const { inviteToken, displayName } = body

    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    if (!inviteToken) {
      return NextResponse.json(
        { error: 'Invite token is required' },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    // /api/auth/sync normally creates the users row, but it runs from a client
    // hook and can land after this request. Bootstrapping here removes that race.
    const user = await ensureUserRow(supabase, authUser.id, authUser.email)

    if (isCandidateSurfaceRole(user.role)) {
      return NextResponse.json(
        {
          error: CANDIDATE_CANNOT_BECOME_EMPLOYER,
          details: 'Sign in with a different email that is not already a candidate account.',
          code: 'CANDIDATE_EMAIL_IN_USE',
        },
        { status: 403 }
      )
    }

    const { data: invite } = await supabase
      .from('company_members')
      .select(`
        id,
        company_id,
        user_id,
        role,
        invite_email,
        invite_expires_at,
        accepted_at,
        companies (
          company_name
        )
      `)
      .eq('invite_token', inviteToken)
      .maybeSingle()

    if (!invite) {
      return NextResponse.json(
        { error: 'This invitation link is not valid. Ask your team admin to send a new one.' },
        { status: 404 }
      )
    }

    const company = invite.companies as { company_name?: string } | null

    // Already accepted. Same person → finish what sync started (name) and say yes.
    if (invite.accepted_at) {
      if (invite.user_id !== user.id) {
        return NextResponse.json(
          { error: 'This invitation has already been used by a different account.' },
          { status: 409 }
        )
      }
      await finalizeUser(supabase, user.id, displayName)
      return NextResponse.json({
        success: true,
        alreadyAccepted: true,
        message: 'You are already on this team',
        company: { id: invite.company_id, name: company?.company_name },
        role: invite.role,
      })
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

    await finalizeUser(supabase, user.id, displayName)

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

/** Role flip + optional display name. Safe to run on an already-employer row. */
async function finalizeUser(
  supabase: Awaited<ReturnType<typeof getAdminSupabaseClient>>,
  userId: string,
  displayName: unknown
) {
  const userUpdate: Record<string, unknown> = { role: 'employer' }
  if (typeof displayName === 'string' && displayName.trim()) {
    userUpdate.name = displayName.trim()
  }
  await supabase.from('users').update(userUpdate).eq('id', userId)
}

/**
 * GET /api/employer/team/accept-invite?token=xxx
 *
 * Invitation details for the /invite/[token] page. Session-aware: an invite
 * that sync already accepted for the current user still renders as theirs.
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

    const { data: invite } = await supabase
      .from('company_members')
      .select(`
        id,
        user_id,
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
        { error: 'This invitation link is not valid. Ask your team admin to send a new one.' },
        { status: 404 }
      )
    }

    const sessionUserId = await getStormUserIdFromRequest(request)
    const acceptedByYou = Boolean(invite.accepted_at && sessionUserId && invite.user_id === sessionUserId)

    if (invite.accepted_at && !acceptedByYou) {
      return NextResponse.json(
        { error: 'This invitation has already been used.' },
        { status: 410 }
      )
    }

    // An accepted invite does not expire out from under its owner.
    const isExpired = !acceptedByYou && new Date(invite.invite_expires_at) < new Date()

    const company = invite.companies as {
      company_name?: string
      logo_url?: string | null
      verified?: boolean
    } | null

    return NextResponse.json({
      success: true,
      invite: {
        role: invite.role,
        email: invite.invite_email,
        expiresAt: invite.invite_expires_at,
        isExpired,
        acceptedByYou,
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
