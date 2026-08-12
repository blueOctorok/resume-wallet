/**
 * Server-side role resolution from a VERIFIED session email.
 *
 * Employer accounts are admin-provisioned only. A client can never ask to be an
 * employer — the server decides by looking for a pre-existing link between the
 * signed-in identity and a company. This replaces the old flow where
 * RoleSelectionModal let the user name their own role and POST /api/user/set-role
 * granted it.
 *
 * The email MUST come from `supabase.auth.getUser()`, never a request body. The
 * previous check-employer-access route trusted a typed email, which meant anyone
 * could claim to be a company's designated owner just by knowing their address.
 *
 * Every branch is idempotent, so this is safe to run on each sign-in.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { checkEmailAgainstCompanyDomains } from '@/lib/employer-domain-match'
import { isCandidateSurfaceRole } from '@/lib/employer-account-guard'

export type ResolvedRole = 'employer' | 'candidate'

/** How the user is connected to a company — useful for logging and tests. */
export type EmployerLinkKind =
  | 'existing-owner'
  | 'existing-member'
  | 'claimed-precreated-company'
  | 'accepted-pending-invite'
  | 'none'

export interface EmployerLinkResult {
  role: ResolvedRole
  kind: EmployerLinkKind
  companyId: string | null
  companyRole: string | null
}

const NONE: EmployerLinkResult = {
  role: 'candidate',
  kind: 'none',
  companyId: null,
  companyRole: null,
}

/**
 * Resolve whether this user is linked to a company, performing the claim/accept
 * side-effects when a pre-created company or pending invite is found.
 */
export async function resolveEmployerLink(
  supabase: SupabaseClient,
  userId: string,
  verifiedEmail: string | null | undefined
): Promise<EmployerLinkResult> {
  // ── 1. Already owns a company ──────────────────────────────────────────────
  const { data: ownedCompany } = await supabase
    .from('companies')
    .select('id')
    .eq('employer_user_id', userId)
    .maybeSingle()

  if (ownedCompany) {
    return { role: 'employer', kind: 'existing-owner', companyId: ownedCompany.id, companyRole: 'owner' }
  }

  // ── 2. Already an active member ────────────────────────────────────────────
  const { data: activeMembership } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', userId)
    .eq('is_active', true)
    .not('accepted_at', 'is', null)
    .maybeSingle()

  if (activeMembership) {
    return {
      role: 'employer',
      kind: 'existing-member',
      companyId: activeMembership.company_id,
      companyRole: activeMembership.role,
    }
  }

  // Everything below is keyed on the verified email.
  const email = verifiedEmail?.trim().toLowerCase()
  if (!email) return NONE

  // A candidate login must never claim a company or accept a team invite.
  // Admin create also blocks designating an existing candidate email as owner;
  // this is the runtime backstop if a company row was linked another way.
  const { data: selfRow } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  if (isCandidateSurfaceRole(selfRow?.role)) {
    console.warn(
      `[RESOLVE EMPLOYER LINK] Refusing employer claim/invite for candidate account ${userId} (${email})`
    )
    return NONE
  }

  // ── 3. Pre-created company awaiting its designated owner ───────────────────
  // This is the admin provisioning path: /api/admin/companies creates the company
  // with designated_owner_email set and employer_user_id null, and the owner
  // claims it the first time they sign in.
  const { data: preCreated } = await supabase
    .from('companies')
    .select('id, company_name')
    .ilike('designated_owner_email', email)
    .is('employer_user_id', null)
    .maybeSingle()

  if (preCreated) {
    // The `is null` guard makes the claim race-safe: if two sessions land at once,
    // only the first update matches and the second falls through to step 4.
    const { data: claimed, error: claimError } = await supabase
      .from('companies')
      .update({ employer_user_id: userId })
      .eq('id', preCreated.id)
      .is('employer_user_id', null)
      .select('id')
      .maybeSingle()

    if (!claimError && claimed) {
      // Reuse an existing invite row for this owner if one is present, so we never
      // create a duplicate membership.
      const { data: existingRow } = await supabase
        .from('company_members')
        .select('id')
        .eq('company_id', preCreated.id)
        .or(`user_id.eq.${userId},invite_email.ilike.${email}`)
        .maybeSingle()

      if (existingRow) {
        await supabase
          .from('company_members')
          .update({
            user_id: userId,
            role: 'owner',
            accepted_at: new Date().toISOString(),
            is_active: true,
          })
          .eq('id', existingRow.id)
      } else {
        await supabase.from('company_members').insert({
          company_id: preCreated.id,
          user_id: userId,
          role: 'owner',
          invite_email: email,
          accepted_at: new Date().toISOString(),
          is_active: true,
        })
      }

      console.log(
        `[RESOLVE EMPLOYER LINK] ${userId} claimed pre-created company "${preCreated.company_name}"`
      )
      return {
        role: 'employer',
        kind: 'claimed-precreated-company',
        companyId: preCreated.id,
        companyRole: 'owner',
      }
    }
  }

  // ── 4. Pending team invite ─────────────────────────────────────────────────
  // Match on accepted_at only. POST /api/employer/team sets user_id when the
  // invitee already has an account, so the old `.is('user_id', null)` filter
  // silently skipped invites for existing users — exactly the case that left
  // Jason Peterson approved but with no membership.
  const { data: pendingInvites } = await supabase
    .from('company_members')
    .select('id, company_id, role, invite_expires_at')
    .ilike('invite_email', email)
    .is('accepted_at', null)
    .eq('is_active', true)
    .order('invited_at', { ascending: false })
    .limit(1)

  const pendingInvite = pendingInvites?.[0]

  if (pendingInvite) {
    const isExpired =
      !!pendingInvite.invite_expires_at && new Date(pendingInvite.invite_expires_at) < new Date()

    if (isExpired) {
      console.log(`[RESOLVE EMPLOYER LINK] Invite for ${email} expired — staying candidate`)
      return NONE
    }

    // Re-check the domain policy at acceptance, not just at invite time, so
    // tightening a company's allowed domains also invalidates invites already
    // in flight.
    const { data: inviteCompany } = await supabase
      .from('companies')
      .select('company_name, email, designated_owner_email, allowed_email_domains')
      .eq('id', pendingInvite.company_id)
      .maybeSingle()

    if (inviteCompany) {
      const domainCheck = checkEmailAgainstCompanyDomains({
        allowedDomains: inviteCompany.allowed_email_domains,
        email,
        companyName: inviteCompany.company_name,
        legacyCompanyEmail: inviteCompany.email || inviteCompany.designated_owner_email,
      })
      if (!domainCheck.allowed) {
        console.warn(
          `[RESOLVE EMPLOYER LINK] Invite for ${email} to "${inviteCompany.company_name}" no longer satisfies the domain policy — staying candidate`
        )
        return NONE
      }
    }

    const { error: acceptError } = await supabase
      .from('company_members')
      .update({
        user_id: userId,
        accepted_at: new Date().toISOString(),
        is_active: true,
      })
      .eq('id', pendingInvite.id)
      .is('accepted_at', null)

    if (!acceptError) {
      console.log(
        `[RESOLVE EMPLOYER LINK] ${userId} accepted invite to company ${pendingInvite.company_id} as ${pendingInvite.role}`
      )
      return {
        role: 'employer',
        kind: 'accepted-pending-invite',
        companyId: pendingInvite.company_id,
        companyRole: pendingInvite.role,
      }
    }
  }

  return NONE
}

/**
 * Role for a user who doesn't have one yet. Called from /api/auth/sync on first
 * sign-in. Defaults to 'candidate' — the only way to be an employer is to have
 * been provisioned by a Provven admin or invited by a company owner.
 */
export async function resolveRoleForNewUser(
  supabase: SupabaseClient,
  userId: string,
  verifiedEmail: string | null | undefined
): Promise<ResolvedRole> {
  const link = await resolveEmployerLink(supabase, userId, verifiedEmail)
  return link.role
}
