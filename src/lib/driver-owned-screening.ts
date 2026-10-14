import type { SupabaseClient } from '@supabase/supabase-js'
import { isDriverOwnedScreeningOrder } from '@/lib/screening-order-ownership'
import { toMvrDataFromOrderRow, toPspDataFromOrderRow } from '@/lib/projected-career-card'
import type { MvrData, PspData } from '@/types/career-card'

/**
 * Statuses that never block a new pull, whatever `expires_at` says.
 * Keep in sync with REORDERABLE_STATUSES in screening-validation.ts.
 * The partial unique index (migration 122) only covers in-flight rows
 * (`pending` / `processing`); it is not this list.
 */
const INACTIVE_STATUSES = new Set(['failed', 'cancelled', 'expired', 'superseded'])

/**
 * Still blocking a fresh pull: a non-terminal status whose report has not
 * passed `expires_at`. Omit `expiresAt` when the caller has no date — a
 * finished report with no expiry still counts as on file.
 *
 * A past `expires_at` releases the block even while status stays
 * `completed`. Status is the lifecycle; the date is the 30-day window
 * (DEC-2026-10-002). Do not pass `expiresAt` from a payment-credit check:
 * a finished report consumed that credit whether or not it has since aged out.
 */
export function isActiveScreeningOrder(order: {
  status: string | null | undefined
  expiresAt?: string | null
}): boolean {
  const s = String(order.status ?? '').toLowerCase()
  if (s.length === 0 || INACTIVE_STATUSES.has(s)) return false
  if (!order.expiresAt) return true
  const expires = Date.parse(order.expiresAt)
  if (Number.isNaN(expires)) return true
  return expires >= Date.now()
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
      .select('id, status, expires_at')
      .eq('driver_user_id', driverUserId)
      .is('ordered_by_company_id', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('psp_orders')
      .select('id, status, expires_at')
      .eq('driver_user_id', driverUserId)
      .is('ordered_by_company_id', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const mvrStatus = (mvrRes.data?.status as string | undefined) ?? null
  const pspStatus = (pspRes.data?.status as string | undefined) ?? null

  return {
    hasActiveDriverOwnedMvr: isActiveScreeningOrder({
      status: mvrStatus,
      expiresAt: (mvrRes.data?.expires_at as string | null | undefined) ?? null,
    }),
    hasActiveDriverOwnedPsp: isActiveScreeningOrder({
      status: pspStatus,
      expiresAt: (pspRes.data?.expires_at as string | null | undefined) ?? null,
    }),
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
 * employer-owned — whose report hasn't passed expires_at locks that kind.
 * Status stays `completed` after the window; the date is what releases it.
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
    // Past expires_at does not lock. The cron no longer rewrites a finished
    // report's status, so this date check is the release, not a race with it.
    const expired = row?.expires_at ? new Date(row.expires_at).getTime() < Date.now() : false
    if (!row || expired) return { locked: false, status: null, orderedAt: null, expiresAt: null }
    return { locked: true, status: row.status, orderedAt: row.ordered_at, expiresAt: row.expires_at }
  }

  return { mvr: toLock(mvrRes.data), psp: toLock(pspRes.data) }
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
    .select('license_status, license_class, total_points, violation_count, accident_count')
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
