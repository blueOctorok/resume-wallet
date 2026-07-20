import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Reserve-then-place for Accio screening orders.
 *
 * Why: the old flow called Accio FIRST and inserted the order row after. That
 * meant (a) N concurrent requests all passed the app-level duplicate check and
 * produced N real Accio charges, and (b) an insert failure left us charged
 * with no record. Migration 102 added partial unique indexes
 * (`uniq_active_driver_owned_mvr` / `uniq_active_driver_owned_psp`) — at most
 * one active driver-owned order per driver per kind. Inserting the `pending`
 * row BEFORE calling Accio makes that index an atomic reservation: the race
 * has exactly one winner, and losers get a friendly 409 without costing money.
 *
 * Employer-owned orders (ordered_by_company_id set) are outside the index on
 * purpose — companies pay for their own pulls and have separate guards.
 */

export type ScreeningKind = 'mvr' | 'psp'

const TABLES: Record<ScreeningKind, 'mvr_orders' | 'psp_orders'> = {
  mvr: 'mvr_orders',
  psp: 'psp_orders',
}

/** Postgres unique-constraint violation. */
const UNIQUE_VIOLATION = '23505'

export function duplicateOrderMessage(kind: ScreeningKind): string {
  const label = kind === 'mvr' ? 'MVR' : 'PSP'
  return `A ${label} order is already on file for this driver. Reports are valid for 30 days — check My Files for its status instead of ordering again.`
}

export interface ScreeningReservationInput {
  kind: ScreeningKind
  driverUserId: string
  orderNumber: string
  orderXml: string
  dlNumber: string
  dlState: string
  expiresAtIso: string
  orderedByCompanyId?: string | null
  orderedByUserId?: string | null
  orderedByEmployer?: boolean | null
  paymentId?: string | null
  paymentTxHash?: string | null
  /** MVR only */
  mvrSearchType?: string
}

export type ReserveScreeningOrderResult =
  | { ok: true; orderId: string }
  | { ok: false; reason: 'duplicate'; message: string }
  | { ok: false; reason: 'error'; message: string }

/**
 * Insert the `pending` order row before any Accio call. A 23505 on the
 * driver-owned unique index means another active order already holds the slot.
 */
export async function reserveScreeningOrder(
  supabase: SupabaseClient,
  input: ScreeningReservationInput,
): Promise<ReserveScreeningOrderResult> {
  const row: Record<string, unknown> = {
    driver_user_id: input.driverUserId,
    accio_order_number: input.orderNumber,
    dl_number: input.dlNumber,
    dl_state: input.dlState,
    status: 'pending',
    order_xml: input.orderXml,
    expires_at: input.expiresAtIso,
    ordered_by_company_id: input.orderedByCompanyId ?? null,
    ordered_by_user_id: input.orderedByUserId ?? null,
    ordered_by_employer: input.orderedByEmployer ?? Boolean(input.orderedByCompanyId),
    payment_id: input.paymentId ?? null,
    payment_tx_hash: input.paymentTxHash ?? null,
  }
  if (input.kind === 'mvr') {
    row.order_type = 'MVR'
    row.mvr_search_type = input.mvrSearchType ?? 'standard'
  }

  const { data, error } = await supabase.from(TABLES[input.kind]).insert(row).select('id').single()

  if (error || !data) {
    if (error?.code === UNIQUE_VIOLATION) {
      console.warn(
        `[SCREENING GUARD] Blocked concurrent duplicate ${input.kind} order for driver ${input.driverUserId}`,
      )
      return { ok: false, reason: 'duplicate', message: duplicateOrderMessage(input.kind) }
    }
    console.error(`[SCREENING GUARD] ${input.kind} reservation insert failed:`, error)
    return { ok: false, reason: 'error', message: error?.message ?? 'Failed to store order' }
  }

  return { ok: true, orderId: data.id as string }
}

/**
 * Attach Accio's IDs after a successful placeOrder. Status stays `pending`
 * (webhooks/reconcile move it forward). A failure here is logged but not
 * fatal — the reservation row already carries our reference number, which
 * webhook matching and reconcile can resolve.
 */
export async function finalizeScreeningOrderReservation(
  supabase: SupabaseClient,
  kind: ScreeningKind,
  orderId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.from(TABLES[kind]).update(patch).eq('id', orderId)
  if (error) {
    console.error(`[SCREENING GUARD] ${kind} reservation finalize failed for ${orderId}:`, error)
  }
}

/**
 * Accio rejected the order (or the call never went through) — mark the
 * reservation `failed` so the unique-index slot frees immediately and the
 * driver can retry.
 */
export async function releaseScreeningOrderReservation(
  supabase: SupabaseClient,
  kind: ScreeningKind,
  orderId: string,
): Promise<void> {
  const { error } = await supabase
    .from(TABLES[kind])
    .update({ status: 'failed', completed_at: new Date().toISOString() })
    .eq('id', orderId)
  if (error) {
    // Worst case the slot stays held by a dead pending row until reconcile
    // voids it — log loudly so we notice.
    console.error(`[SCREENING GUARD] ${kind} reservation release failed for ${orderId}:`, error)
  }
}
