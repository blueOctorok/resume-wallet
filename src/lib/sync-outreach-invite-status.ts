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
 * Move outreach invites to `completed` when the employer-paid screening pipeline
 * is done for that candidate.
 *
 * Kanban columns read `application_invites.status`, not `mvr_orders.status`.
 * The consent-first flow only marks `in_progress` when the candidate starts;
 * nothing was flipping to `completed` when Accio delivered reports — so every
 * card stayed in "In progress" even with green file badges.
 */
export async function syncOutreachInviteForDriver(
  supabase: SupabaseClient,
  companyId: string,
  driverUserId: string,
): Promise<{ updated: number; inviteIds: string[] }> {
  const [{ data: mvrOrders }, { data: pspOrders }] = await Promise.all([
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
  ])

  const allOrders = [...(mvrOrders ?? []), ...(pspOrders ?? [])]
  if (allOrders.length === 0) {
    return { updated: 0, inviteIds: [] }
  }
  if (!allOrders.every((o) => isTerminalScreeningOrderStatus(o.status as string))) {
    return { updated: 0, inviteIds: [] }
  }

  const consentBundle = await getLatestScreeningConsentBundle(supabase, driverUserId, companyId)

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

    if (block === 'driver-screening-consent' && !consentBundle) {
      // Employer cannot order without consent, but guard anyway.
      continue
    }

    if (block === 'driver-mvr') {
      const mvrOnly = mvrOrders ?? []
      if (mvrOnly.length === 0 || !mvrOnly.every((o) => isTerminalScreeningOrderStatus(o.status as string))) {
        continue
      }
    }

    if (block === 'driver-psp') {
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
