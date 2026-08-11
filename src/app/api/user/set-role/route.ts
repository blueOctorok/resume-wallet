import { NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { isUserEmployerLinked } from '@/lib/employer-account-guard'

/**
 * Set the caller's role. Candidate only.
 *
 * A client can no longer ask to be an employer. Employer accounts are
 * admin-provisioned: /api/admin/companies pre-creates the company and
 * resolveEmployerLink (in /api/auth/sync) grants the role from the VERIFIED
 * session email on first sign-in.
 *
 * This route previously accepted role='employer' and did the company assignment
 * itself. Two defects made that dangerous:
 *   1. users.role was written BEFORE the authorization check and never rolled
 *      back, so a request rejected with 403 still left a permanent employer role.
 *   2. Combined with talent/[userId]/dot-app gating on users.role === 'employer',
 *      that yielded a read on any driver's SSN/DOB from a request that visibly
 *      failed.
 * Removing the branch removes the primitive rather than patching the ordering.
 */
export async function POST(request: Request) {
  try {
    const { role, referralCode } = await request.json()
    const sessionUserId = await getStormUserIdFromRequest(request)

    if (role !== 'candidate') {
      return NextResponse.json(
        {
          error: 'Invalid role',
          details:
            'Only "candidate" can be set here. Employer access is provisioned by Provven and granted automatically on sign-in.',
        },
        { status: 400 }
      )
    }

    if (!sessionUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()

    const { data: userToUpdate, error: userFetchError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', sessionUserId)
      .single()

    if (userFetchError || !userToUpdate) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const currentRole = userToUpdate.role ?? null

    // Guard against an employer self-downgrading. resolveEmployerLink only fills
    // in a role when there isn't one, so a downgrade would not repair itself on
    // the next sign-in and would need admin intervention.
    const employerLinked = await isUserEmployerLinked(supabase, userToUpdate.id)
    if (employerLinked) {
      console.log(`[SET ROLE] Rejected candidate role for employer-linked user ${userToUpdate.id}`)
      return NextResponse.json(
        {
          error: 'Employer accounts cannot use the candidate hub',
          details:
            'This account is tied to a company. Use a different account if you need a separate candidate profile.',
          code: 'EMPLOYER_NO_CANDIDATE',
        },
        { status: 403 }
      )
    }

    if (currentRole !== 'candidate') {
      const { error: updateError } = await supabase
        .from('users')
        .update({ role: 'candidate' })
        .eq('id', userToUpdate.id)

      if (updateError) {
        console.error('[SET ROLE] Error updating user role:', updateError)
        return NextResponse.json(
          { error: 'Failed to update role', details: updateError.message },
          { status: 500 }
        )
      }
      console.log(`[SET ROLE] User ${userToUpdate.id} set to candidate (was "${currentRole}")`)
    }

    // Link referral if a code was provided (new user arrived via ?ref=CODE)
    if (referralCode && typeof referralCode === 'string') {
      try {
        const { data: referralRow } = await supabase
          .from('referrals')
          .select('id, referrer_id, referred_user_id')
          .eq('referral_code', referralCode)
          .is('referred_user_id', null)
          .maybeSingle()

        if (referralRow && referralRow.referrer_id !== userToUpdate.id) {
          await supabase
            .from('referrals')
            .update({
              referred_user_id: userToUpdate.id,
              status: 'signed_up',
            })
            .eq('id', referralRow.id)

          console.log(`[SET ROLE] Linked referral ${referralCode} to user ${userToUpdate.id}`)
        }
      } catch (refErr) {
        // Non-blocking — referral linking failure shouldn't break onboarding
        console.error('[SET ROLE] Referral linking error:', refErr)
      }
    }

    return NextResponse.json({
      success: true,
      role: 'candidate',
      message: 'Role set to candidate successfully',
    })
  } catch (error) {
    console.error('[SET ROLE] Internal error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
