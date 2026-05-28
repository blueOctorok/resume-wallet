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
 * Move outreach invites to `completed` when the candidate has finished the work
 * the invite was sent for.
 *
 * Handles two distinct symptoms seen 2026-05-28:
 *
 *   1. **Linked-but-stuck (Sean Buckner)** — invite has `used_by_user_id`
 *      set, candidate completed consent, but no MVR/PSP was ever ordered. Old
 *      sync logic required orders to flip the status. Now consent alone is
 *      enough for `driver-screening-consent` invites.
 *
 *   2. **Orphan invite (Quantez Johnson)** — invite was sent but never opened
 *      via its token, so `used_by_user_id` stayed NULL. Candidate already had a
 *      Storm account from a different path (Talent Search request) and
 *      completed consent there. The kanban still showed "Pending" forever
 *      because nothing connected the email-only invite to the user. We now
 *      match orphan invites by `(company_id, lower(candidate_email))` and
 *      back-link them to the driver on consent completion.
 *
 * Per-block done signals:
 *
 *   - `driver-screening-consent` — complete `screening_consent_bundles` row
 *   - `driver-mvr` — every MVR order for `(company, driver)` is terminal
 *   - `driver-psp` — every PSP order for `(company, driver)` is terminal
 */
export async function syncOutreachInviteForDriver(
  supabase: SupabaseClient,
  companyId: string,
  driverUserId: string,
): Promise<{ updated: number; inviteIds: string[] }> {
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
    // getLatestScreeningConsentBundle already filters to status = 'complete',
    // so a non-null result == "consent done for this (driver, company)".
    getLatestScreeningConsentBundle(supabase, driverUserId, companyId),
    getDriverPrimaryEmail(supabase, driverUserId),
  ])

  // Pull both linked and orphan invites in one query. Orphans only count when
  // we know the driver's email AND it matches the invite — otherwise we'd
  // accidentally close someone else's pending invite.
  const linkedQuery = supabase
    .from('application_invites')
    .select('id, status, target_block_type, used_by_user_id, candidate_email')
    .eq('company_id', companyId)
    .eq('used_by_user_id', driverUserId)
    .in('status', ['viewed', 'in_progress'])

  const { data: linkedInvites } = await linkedQuery

  let orphanInvites: Array<{
    id: string
    status: string
    target_block_type: string | null
    used_by_user_id: string | null
    candidate_email: string | null
  }> = []
  if (driverEmail) {
    const { data } = await supabase
      .from('application_invites')
      .select('id, status, target_block_type, used_by_user_id, candidate_email')
      .eq('company_id', companyId)
      .is('used_by_user_id', null)
      .ilike('candidate_email', driverEmail)
      .in('status', ['pending', 'viewed', 'in_progress'])
    orphanInvites = (data ?? []) as typeof orphanInvites
  }

  const allInvites = [...(linkedInvites ?? []), ...orphanInvites]

  const inviteIds: string[] = []
  const linkedOrphanIds: string[] = []
  const now = new Date().toISOString()

  for (const inv of allInvites) {
    const block = inv.target_block_type as string | null
    if (!block || !SCREENING_INVITE_BLOCKS.has(block)) continue

    // Per-block guards: only complete the invite once its own artifact is done.
    if (block === 'driver-screening-consent') {
      if (!consentBundle) continue
    } else if (block === 'driver-mvr') {
      const mvrOnly = mvrOrders ?? []
      if (mvrOnly.length === 0 || !mvrOnly.every((o) => isTerminalScreeningOrderStatus(o.status as string))) {
        continue
      }
    } else if (block === 'driver-psp') {
      const pspOnly = pspOrders ?? []
      if (pspOnly.length === 0 || !pspOnly.every((o) => isTerminalScreeningOrderStatus(o.status as string))) {
        continue
      }
    }

    const isOrphan = inv.used_by_user_id === null
    const update: Record<string, string> = { status: 'completed', updated_at: now }
    if (isOrphan) update.used_by_user_id = driverUserId

    const { error } = await supabase
      .from('application_invites')
      .update(update)
      .eq('id', inv.id)

    if (!error) {
      inviteIds.push(inv.id as string)
      if (isOrphan) linkedOrphanIds.push(inv.id as string)
    }
  }

  if (inviteIds.length > 0) {
    const orphanNote = linkedOrphanIds.length > 0 ? ` (${linkedOrphanIds.length} orphan-linked)` : ''
    console.log(
      `[OUTREACH SYNC] Marked ${inviteIds.length} invite(s) completed for driver ${driverUserId} company ${companyId}${orphanNote}`,
    )
  }

  return { updated: inviteIds.length, inviteIds }
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
): Promise<{ updated: number }> {
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
  for (const uid of userIds) {
    const r = await syncOutreachInviteForDriver(supabase, companyId, uid)
    updated += r.updated
  }

  if (updated > 0) {
    console.log(`[OUTREACH SYNC] Company ${companyId}: ${updated} invite(s) → completed`)
  }

  return { updated }
}
