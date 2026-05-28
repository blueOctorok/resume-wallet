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
 * Two flows produce a "done" signal:
 *
 *   1. **Consent-only flow (current default)** — the invite targets
 *      `driver-screening-consent`; "done" = a complete `screening_consent_bundles`
 *      row exists. Whether the employer later orders MVR/PSP is independent of
 *      the invite lifecycle (those use `mvr_orders` / `psp_orders` directly).
 *
 *   2. **Per-block legacy flow** — the invite targets `driver-mvr` or
 *      `driver-psp`; "done" = the matching order(s) for that company/driver
 *      reached a terminal status (completed / needs_review / failed).
 *
 * The kanban reads `application_invites.status`. Without this sync, consent-only
 * invites stayed `in_progress` forever (no MVR/PSP order ever existed), which is
 * exactly the Sean Buckner symptom seen 2026-05-28.
 */
export async function syncOutreachInviteForDriver(
  supabase: SupabaseClient,
  companyId: string,
  driverUserId: string,
): Promise<{ updated: number; inviteIds: string[] }> {
  const [{ data: mvrOrders }, { data: pspOrders }, consentBundle] = await Promise.all([
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
  ])

  const { data: invites } = await supabase
    .from('application_invites')
    .select('id, status, target_block_type')
    .eq('company_id', companyId)
    .eq('used_by_user_id', driverUserId)
    .in('status', ['viewed', 'in_progress'])

  const inviteIds: string[] = []
  const now = new Date().toISOString()

  for (const inv of invites ?? []) {
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

    const { error } = await supabase
      .from('application_invites')
      .update({ status: 'completed', updated_at: now })
      .eq('id', inv.id)

    if (!error) inviteIds.push(inv.id as string)
  }

  if (inviteIds.length > 0) {
    console.log(
      `[OUTREACH SYNC] Marked ${inviteIds.length} invite(s) completed for driver ${driverUserId} company ${companyId}`,
    )
  }

  return { updated: inviteIds.length, inviteIds }
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
