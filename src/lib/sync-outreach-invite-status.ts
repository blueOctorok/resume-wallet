import type { SupabaseClient } from '@supabase/supabase-js'
import { getLatestScreeningConsentBundle } from '@/lib/screening-consent-bundle'

const SCREENING_INVITE_BLOCKS = new Set([
  'driver-screening-consent',
  'driver-mvr',
  'driver-psp',
])

/** Order statuses where Accio has returned a report (or a terminal failure). */
export function isTerminalScreeningOrderStatus(status: string | null | undefined): boolean {
  const s = String(status ?? '').toLowerCase()
  return s === 'completed' || s === 'needs_review' || s === 'failed'
}

/**
 * Reconcile outreach invite status against the actual screening pipeline state.
 *
 * Kanban semantics from Pace's perspective (locked 2026-06-01):
 *
 *   - `pending`     → invite sent, not opened.
 *   - `viewed`      → candidate opened the link (or signed in) but has NOT yet
 *                     completed consent. "Engaged, not started."
 *   - `in_progress` → consent bundle is fully filled out + signed. The
 *                     candidate's part is done; Pace's next step is to order
 *                     MVR/PSP.
 *   - `completed`   → Pace ordered MVR or PSP and a result came back. Stays on
 *                     the board (no auto-archive) so Pace can keep acting on it.
 *
 * What this function does, in order:
 *
 *   1. **Consent done → in_progress.** When the driver has a completed consent
 *      bundle for this company, move the matching `driver-screening-consent`
 *      invite from pending/viewed to `in_progress`. This also back-links
 *      orphan invites (used_by_user_id = NULL) when the candidate completed
 *      consent via a different path (Talent Search request → hub) and we can
 *      match them by `(company, lower(candidate_email))`.
 *
 *   2. **Screening returned → completed.** When ANY MVR or PSP order for this
 *      driver+company comes back terminal (completed / needs_review / failed),
 *      flip the screening invite to `completed`. Per-block invites
 *      (driver-mvr / driver-psp) complete on their own order returning; the
 *      consent invite completes on any screening returning.
 */
export async function syncOutreachInviteForDriver(
  supabase: SupabaseClient,
  companyId: string,
  driverUserId: string,
): Promise<{ updated: number; inviteIds: string[]; orphansLinked: number }> {
  const [{ data: mvrOrders }, { data: pspOrders }, consentBundle, driverEmail] = await Promise.all([
    supabase
      .from('mvr_orders')
      .select('id, status')
      .eq('ordered_by_company_id', companyId)
      .eq('driver_user_id', driverUserId),
    supabase
      .from('psp_orders')
      .select('id, status')
      .eq('ordered_by_company_id', companyId)
      .eq('driver_user_id', driverUserId),
    getLatestScreeningConsentBundle(supabase, driverUserId, companyId),
    getDriverPrimaryEmail(supabase, driverUserId),
  ])

  const inviteIds: string[] = []
  const now = new Date().toISOString()
  let orphansLinked = 0

  // ── 1. Consent complete → in_progress ──────────────────────────────────
  // The candidate has signed the full consent bundle, so the consent invite
  // is no longer "just viewed" — it advances to in_progress (the candidate's
  // part is done; Pace's next step is to order MVR/PSP).
  if (consentBundle) {
    // 1a. Back-link orphan invites: a link was sent to this email but the
    // candidate completed consent through another path, so used_by_user_id is
    // still NULL. Safe to claim now because the bundle proves it's the same
    // driver. Match on (company, lower(candidate_email)).
    if (driverEmail) {
      const { data: orphans } = await supabase
        .from('application_invites')
        .select('id')
        .eq('company_id', companyId)
        .eq('target_block_type', 'driver-screening-consent')
        .is('used_by_user_id', null)
        .ilike('candidate_email', driverEmail)
        .in('status', ['pending', 'viewed'])

      for (const orphan of orphans ?? []) {
        const { error } = await supabase
          .from('application_invites')
          .update({ used_by_user_id: driverUserId, status: 'in_progress', updated_at: now })
          .eq('id', orphan.id as string)
        if (!error) orphansLinked++
      }
    }

    // 1b. Already-linked consent invites still sitting at pending/viewed.
    const { data: linked } = await supabase
      .from('application_invites')
      .select('id')
      .eq('company_id', companyId)
      .eq('used_by_user_id', driverUserId)
      .eq('target_block_type', 'driver-screening-consent')
      .in('status', ['pending', 'viewed'])

    for (const inv of linked ?? []) {
      const { error } = await supabase
        .from('application_invites')
        .update({ status: 'in_progress', updated_at: now })
        .eq('id', inv.id as string)
      if (!error) inviteIds.push(inv.id as string)
    }
  }

  // ── 2. Screening returned → completed ──────────────────────────────────
  // As soon as ANY ordered MVR/PSP comes back terminal, the screening invite
  // is "done" for kanban purposes. Per-block invites complete on their own
  // order; the consent invite completes on any screening returning.
  const mvrTerminal = (mvrOrders ?? []).some((o) => isTerminalScreeningOrderStatus(o.status as string))
  const pspTerminal = (pspOrders ?? []).some((o) => isTerminalScreeningOrderStatus(o.status as string))

  if (mvrTerminal || pspTerminal) {
    const { data: invites } = await supabase
      .from('application_invites')
      .select('id, status, target_block_type')
      .eq('company_id', companyId)
      .eq('used_by_user_id', driverUserId)
      .in('status', ['viewed', 'in_progress'])

    for (const inv of invites ?? []) {
      const block = inv.target_block_type as string | null
      if (!block || !SCREENING_INVITE_BLOCKS.has(block)) continue

      // Per-block invites only complete when their own screening returns.
      if (block === 'driver-mvr' && !mvrTerminal) continue
      if (block === 'driver-psp' && !pspTerminal) continue
      // driver-screening-consent: any screening returning is enough.

      const { error } = await supabase
        .from('application_invites')
        .update({ status: 'completed', updated_at: now })
        .eq('id', inv.id)

      if (!error) inviteIds.push(inv.id as string)
    }
  }

  if (inviteIds.length > 0 || orphansLinked > 0) {
    console.log(
      `[OUTREACH SYNC] driver ${driverUserId} company ${companyId}: ${inviteIds.length} updated, ${orphansLinked} orphan-linked`,
    )
  }

  return { updated: inviteIds.length, inviteIds, orphansLinked }
}

/**
 * Resolve the driver's primary email for invite-matching. `users.email` is
 * often NULL for Alchemy wallet-only signups; `user_profiles.email` is the
 * authoritative copy. Returned lowercase + trimmed because invites store
 * whatever the employer typed (Pace HR types in mixed case).
 */
async function getDriverPrimaryEmail(
  supabase: SupabaseClient,
  driverUserId: string,
): Promise<string | null> {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('email')
    .eq('user_id', driverUserId)
    .maybeSingle()
  const profileEmail = (profile as { email: string | null } | null)?.email
  if (profileEmail && profileEmail.trim()) return profileEmail.trim().toLowerCase()

  const { data: user } = await supabase
    .from('users')
    .select('email')
    .eq('id', driverUserId)
    .maybeSingle()
  const userEmail = (user as { email: string | null } | null)?.email
  if (userEmail && userEmail.trim()) return userEmail.trim().toLowerCase()

  return null
}

/** Backfill all active screening invites for a company (page load / reconcile tick). */
export async function syncOutreachInvitesForCompany(
  supabase: SupabaseClient,
  companyId: string,
): Promise<{ updated: number; orphansLinked: number }> {
  const { data: invites } = await supabase
    .from('application_invites')
    .select('used_by_user_id')
    .eq('company_id', companyId)
    .in('status', ['viewed', 'in_progress'])
    .not('used_by_user_id', 'is', null)

  const userIds = Array.from(
    new Set((invites ?? []).map((i) => i.used_by_user_id as string).filter(Boolean)),
  )

  let updated = 0
  let orphansLinked = 0
  for (const uid of userIds) {
    const r = await syncOutreachInviteForDriver(supabase, companyId, uid)
    updated += r.updated
    orphansLinked += r.orphansLinked
  }

  if (updated > 0 || orphansLinked > 0) {
    console.log(
      `[OUTREACH SYNC] Company ${companyId}: ${updated} → completed, ${orphansLinked} orphan-linked`,
    )
  }

  return { updated, orphansLinked }
}
