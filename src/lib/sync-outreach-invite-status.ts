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
 * Kanban semantics from Pace's perspective:
 *
 *   - `pending` / `viewed` / `in_progress` → action queue. Pace can edit the
 *     card, run MVR/PSP, send a nudge, etc.
 *   - `completed` → "everything I ordered came back." Card is locked from
 *     edits and starts the 14-day archive timer.
 *
 * This means consent-signed-but-no-orders is intentionally `in_progress`:
 * consent alone does NOT close the invite, because Pace's next step is still
 * to decide whether to run MVR/PSP. The original 2026-05-28 attempt to flip
 * consent-only to `completed` broke Pace's workflow (cards became unactionable
 * with no MVR/PSP ordered) and was reverted.
 *
 * What this function actually does:
 *
 *   1. **Linked invites** — if the driver has any MVR/PSP orders for this
 *      company AND every order is terminal (completed / needs_review /
 *      failed), flip the matching invite to `completed`. This is the
 *      original "screening pipeline done → kanban catches up" sync.
 *
 *   2. **Orphan invites** — if a `(company, candidate_email)` invite exists
 *      with `used_by_user_id = NULL` and the driver completed consent
 *      through another path (Talent Search request → hub), back-link the
 *      invite to the driver. The orphan moves to `in_progress` (not
 *      `completed`) so Pace's kanban shows it as actionable, not archived.
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

  // ── 1. Orphan back-link ────────────────────────────────────────────────
  // Pace sent an outreach invite but the candidate completed consent via a
  // different path, so the invite has used_by_user_id = NULL. We can only
  // link it if (a) we have an email for this driver and (b) the driver has
  // a completed consent bundle for this company — otherwise we'd be
  // claiming someone else's pending invite. The status becomes in_progress
  // (not completed) so Pace's kanban still shows it as actionable.
  let orphansLinked = 0
  if (driverEmail && consentBundle) {
    const { data: orphans } = await supabase
      .from('application_invites')
      .select('id')
      .eq('company_id', companyId)
      .eq('target_block_type', 'driver-screening-consent')
      .is('used_by_user_id', null)
      .ilike('candidate_email', driverEmail)
      .in('status', ['pending', 'viewed', 'in_progress'])

    for (const orphan of orphans ?? []) {
      const { error } = await supabase
        .from('application_invites')
        .update({
          used_by_user_id: driverUserId,
          status: 'in_progress',
          updated_at: now,
        })
        .eq('id', orphan.id as string)
      if (!error) orphansLinked++
    }
  }

  // ── 2. Pipeline-done → completed ───────────────────────────────────────
  // Original sync rule: only flip a per-block screening invite to completed
  // once the matching order(s) all reached a terminal status. Consent-only
  // invites (driver-screening-consent) deliberately stay open until Pace
  // either runs screenings or manually overrides the status.
  const allOrders = [...(mvrOrders ?? []), ...(pspOrders ?? [])]
  if (allOrders.length === 0) {
    return { updated: inviteIds.length, inviteIds, orphansLinked }
  }
  if (!allOrders.every((o) => isTerminalScreeningOrderStatus(o.status as string))) {
    return { updated: inviteIds.length, inviteIds, orphansLinked }
  }

  const { data: invites } = await supabase
    .from('application_invites')
    .select('id, status, target_block_type')
    .eq('company_id', companyId)
    .eq('used_by_user_id', driverUserId)
    .in('status', ['viewed', 'in_progress'])

  for (const inv of invites ?? []) {
    const block = inv.target_block_type as string | null
    if (!block || !SCREENING_INVITE_BLOCKS.has(block)) continue

    // Consent-only invites never auto-complete on the basis of MVR/PSP —
    // they only move forward via consent (handled implicitly when Pace
    // orders MVR/PSP, which creates a per-block invite or just flows
    // through the screening detail UI).
    if (block === 'driver-screening-consent') continue

    if (block === 'driver-mvr') {
      const mvrOnly = mvrOrders ?? []
      if (mvrOnly.length === 0 || !mvrOnly.every((o) => isTerminalScreeningOrderStatus(o.status as string))) continue
    }

    if (block === 'driver-psp') {
      const pspOnly = pspOrders ?? []
      if (pspOnly.length === 0 || !pspOnly.every((o) => isTerminalScreeningOrderStatus(o.status as string))) continue
    }

    const { error } = await supabase
      .from('application_invites')
      .update({ status: 'completed', updated_at: now })
      .eq('id', inv.id)

    if (!error) inviteIds.push(inv.id as string)
  }

  if (inviteIds.length > 0 || orphansLinked > 0) {
    console.log(
      `[OUTREACH SYNC] driver ${driverUserId} company ${companyId}: ${inviteIds.length} completed, ${orphansLinked} orphan-linked`,
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
