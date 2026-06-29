import type { SupabaseClient } from '@supabase/supabase-js'
import { isDriverOwnedScreeningOrder } from '@/lib/screening-order-ownership'
import { toMvrDataFromOrderRow, toPspDataFromOrderRow } from '@/lib/projected-career-card'
import type { MvrData, PspData } from '@/types/career-card'

/** Terminal failure states — a driver can re-order after these. */
const INACTIVE_STATUSES = new Set(['failed', 'cancelled', 'expired'])

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
