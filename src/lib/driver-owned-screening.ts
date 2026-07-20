import type { SupabaseClient } from '@supabase/supabase-js'
import { isDriverOwnedScreeningOrder } from '@/lib/screening-order-ownership'
import { toMvrDataFromOrderRow, toPspDataFromOrderRow } from '@/lib/projected-career-card'
import type { MvrData, PspData } from '@/types/career-card'

/** Terminal states — a driver can re-order after these. Keep in sync with
 * REORDERABLE_STATUSES in screening-validation.ts and the partial unique
 * indexes from migration 102. */
const INACTIVE_STATUSES = new Set(['failed', 'cancelled', 'expired', 'superseded'])

/** Active = pending through completed — blocks duplicate employer pre-screen pulls. */
export function isActiveScreeningOrderStatus(status: string | null | undefined): boolean {
  const s = String(status ?? '').toLowerCase()
  return s.length > 0 && !INACTIVE_STATUSES.has(s)
}

export interface DriverOwnedScreeningFlags {
  hasActiveDriverOwnedMvr: boolean
  hasActiveDriverOwnedPsp: boolean
  driverOwnedMvrStatus: string | null
  driverOwnedPspStatus: string | null
}

/**
 * Latest driver-owned (ordered_by_company_id IS NULL) MVR/PSP for a candidate.
 * Used to suppress duplicate employer pre-screen orders and to surface results
 * to the consenting company only (not the broad employer projection).
 */
export async function getDriverOwnedScreeningFlags(
  supabase: SupabaseClient,
  driverUserId: string,
): Promise<DriverOwnedScreeningFlags> {
  const [mvrRes, pspRes] = await Promise.all([
    supabase
      .from('mvr_orders')
      .select('id, status')
      .eq('driver_user_id', driverUserId)
      .is('ordered_by_company_id', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('psp_orders')
      .select('id, status')
      .eq('driver_user_id', driverUserId)
      .is('ordered_by_company_id', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const mvrStatus = (mvrRes.data?.status as string | undefined) ?? null
  const pspStatus = (pspRes.data?.status as string | undefined) ?? null

  return {
    hasActiveDriverOwnedMvr: isActiveScreeningOrderStatus(mvrStatus),
    hasActiveDriverOwnedPsp: isActiveScreeningOrderStatus(pspStatus),
    driverOwnedMvrStatus: mvrStatus,
    driverOwnedPspStatus: pspStatus,
  }
}

export interface ScreeningKindLock {
  locked: boolean
  status: string | null
  orderedAt: string | null
  expiresAt: string | null
}

/**
 * The re-order lock per kind, matching the duplicate guard in
 * screening-validation.ts: ANY active order — driver-owned or
 * employer-owned — whose report hasn't expired locks that kind.
 * (getDriverOwnedScreeningFlags above is ownership-scoped; this is not.)
 */
export async function getScreeningOrderLocks(
  supabase: SupabaseClient,
  driverUserId: string,
): Promise<{ mvr: ScreeningKindLock; psp: ScreeningKindLock }> {
  const activeStatuses = ['pending', 'processing', 'completed', 'needs_review']

  const latestActive = (table: 'mvr_orders' | 'psp_orders') =>
    supabase
      .from(table)
      .select('id, status, ordered_at, expires_at')
      .eq('driver_user_id', driverUserId)
      .in('status', activeStatuses)
      .order('ordered_at', { ascending: false })
      .limit(1)
      .maybeSingle()

  const [mvrRes, pspRes] = await Promise.all([latestActive('mvr_orders'), latestActive('psp_orders')])

  const toLock = (row: { status: string; ordered_at: string; expires_at: string | null } | null): ScreeningKindLock => {
    // Past-expiry orders don't lock even if the nightly cron hasn't flipped them yet.
    const expired = row?.expires_at ? new Date(row.expires_at).getTime() < Date.now() : false
    if (!row || expired) return { locked: false, status: null, orderedAt: null, expiresAt: null }
    return { locked: true, status: row.status, orderedAt: row.ordered_at, expiresAt: row.expires_at }
  }

  return { mvr: toLock(mvrRes.data), psp: toLock(pspRes.data) }
}

/** Block employer pre-screen duplicate when driver already owns an active pull of this kind. */
export async function hasBlockingDriverOwnedScreening(
  supabase: SupabaseClient,
  driverUserId: string,
  kind: 'mvr' | 'psp',
): Promise<boolean> {
  const flags = await getDriverOwnedScreeningFlags(supabase, driverUserId)
  return kind === 'mvr' ? flags.hasActiveDriverOwnedMvr : flags.hasActiveDriverOwnedPsp
}

/** Full MvrData for the latest driver-owned order (consenting-company view). */
export async function fetchLatestDriverOwnedMvrData(
  supabase: SupabaseClient,
  driverUserId: string,
): Promise<MvrData | null> {
  const { data: order } = await supabase
    .from('mvr_orders')
    .select('id, status, result_outcome, dl_state, created_at, completed_at, ordered_by_company_id')
    .eq('driver_user_id', driverUserId)
    .is('ordered_by_company_id', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!order || !isDriverOwnedScreeningOrder(order)) return null

  const { data: results } = await supabase
    .from('mvr_results')
    .select('license_status, license_class, total_points, violation_count')
    .eq('mvr_order_id', order.id)
    .maybeSingle()

  return toMvrDataFromOrderRow(order, results)
}

/** Full PspData for the latest driver-owned order (consenting-company view). */
export async function fetchLatestDriverOwnedPspData(
  supabase: SupabaseClient,
  driverUserId: string,
): Promise<PspData | null> {
  const { data: order } = await supabase
    .from('psp_orders')
    .select('id, status, result_outcome, dl_state, created_at, completed_at, ordered_by_company_id')
    .eq('driver_user_id', driverUserId)
    .is('ordered_by_company_id', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!order || !isDriverOwnedScreeningOrder(order)) return null

  const { data: result } = await supabase
    .from('psp_results')
    .select('result_status')
    .eq('psp_order_id', order.id)
    .maybeSingle()

  return toPspDataFromOrderRow(order, result)
}
