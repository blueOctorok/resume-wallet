import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Hardened webhook → screening order matcher.
 *
 * Why this exists:
 *   The previous matching logic in `process-psp-accio-webhook.ts` and
 *   `/api/mvr/webhook` had a "state-only" last-resort fallback (Strategy 4)
 *   that matched the most recent pending order in a state. When Accio
 *   replayed a stale `unfilled` webhook from an old test-account order, that
 *   fallback grabbed a brand-new legitimate order in OH and stamped it with
 *   the stale `unfilled` status — the new order was DOA before the user
 *   could even check on it. (See PSP order `fc7936ec` in the audit log.)
 *
 * Matching philosophy now:
 *   - Always prefer the MOST SPECIFIC identifier (suborder > order > remote).
 *   - DL+state is permitted only as a recovery path when remote IDs were
 *     never persisted (placeOrder succeeded but the response never saved),
 *     and only inside a 24h window with strict DL EQUALITY — no "state
 *     only" wild-card matches ever.
 *   - If 0 rows match, caller returns 404 (Accio will retry). If >1 rows
 *     match in the recovery path we treat it as ambiguous and refuse to
 *     match — better a stuck order than a corrupted one.
 *   - Returns `matchedBy` for logging so we can see in production which
 *     path is actually used and tighten further if needed.
 */

export type MatchedBy =
  | 'remote_suborder_number'
  | 'storm_suborder_number'
  | 'remote_order_number'
  | 'storm_order_number'
  | 'dl_state_recent'

export interface WebhookMatchInput {
  /** Our internal order number (echoed back by Accio in `referenceNumber`) */
  ourOrderNumber?: string | null
  /** Accio's `orderID` */
  remoteOrderNumber?: string | null
  /** Our suborder number (rarely populated outside bundles) */
  ourSubOrderNumber?: string | null
  /** Accio's `suborderID` */
  remoteSubOrderNumber?: string | null
  dlNumber?: string | null
  dlState?: string | null
}

export interface MatchedOrder<T> {
  row: T
  matchedBy: MatchedBy
  /** Human-readable note about anything quirky (DL recovery, etc.) — log it. */
  warning?: string
}

/**
 * Try each match strategy in order. Returns the first hit.
 *
 * `tableName` is `mvr_orders` or `psp_orders`. The shape of the row is
 * generic so callers can assert their own type.
 */
export async function matchScreeningOrder<T extends { id: string; status: string; ordered_at: string; accio_remote_order_number?: string | null }>(
  supabase: SupabaseClient,
  tableName: 'mvr_orders' | 'psp_orders',
  input: WebhookMatchInput,
): Promise<MatchedOrder<T> | null> {
  const dlNumber = input.dlNumber?.trim().toUpperCase() || null
  const dlState = input.dlState?.trim().toUpperCase() || null

  // 1. Accio's suborder number — the most specific identifier we ever see.
  //    Only populated for bundle (PSP+MVR) orders. Direct DB match.
  if (input.remoteSubOrderNumber) {
    const { data } = await supabase
      .from(tableName)
      .select('*')
      .eq('accio_remote_suborder_number', input.remoteSubOrderNumber)
      .maybeSingle()
    if (data) return { row: data as T, matchedBy: 'remote_suborder_number' }
  }

  // 2. Storm-side suborder number (rare — only set on bundle orders before
  //    Accio echoes its own IDs back). Still uniquely identifying because we
  //    generated it.
  if (input.ourSubOrderNumber) {
    const { data } = await supabase
      .from(tableName)
      .select('*')
      .eq('accio_suborder_number', input.ourSubOrderNumber)
      .maybeSingle()
    if (data) return { row: data as T, matchedBy: 'storm_suborder_number' }
  }

  // 3. Accio's order number — set during placeOrder for the vast majority of
  //    orders. This is the path almost every healthy order takes.
  if (input.remoteOrderNumber) {
    const { data } = await supabase
      .from(tableName)
      .select('*')
      .eq('accio_remote_order_number', input.remoteOrderNumber)
      .maybeSingle()
    if (data) return { row: data as T, matchedBy: 'remote_order_number' }
  }

  // 4. Our generated order number — usually echoed back by Accio as the
  //    `referenceNumber`. Works for the rare case where Accio's remoteID
  //    wasn't captured during placement (network hiccup, etc.).
  if (input.ourOrderNumber) {
    const { data } = await supabase
      .from(tableName)
      .select('*')
      .eq('accio_order_number', input.ourOrderNumber)
      .maybeSingle()
    if (data) return { row: data as T, matchedBy: 'storm_order_number' }
  }

  // 5. Recovery path: DL number + state, scoped to PENDING orders placed in
  //    the last 24h that DON'T already have an Accio remote number. The
  //    recency + null-remote constraint together prevent the wrongful-match
  //    bug — if a remote ID is already set on a row, only paths 1–4 may
  //    touch it, period.
  //
  //    Ambiguity rule: if more than one row matches, refuse to pick. Better
  //    to leave an order pending (and surface it to admin) than to corrupt
  //    a different driver's order.
  if (dlNumber && dlState) {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data } = await supabase
      .from(tableName)
      .select('*')
      .eq('status', 'pending')
      .eq('dl_number', dlNumber)
      .eq('dl_state', dlState)
      .is('accio_remote_order_number', null)
      .gte('ordered_at', since24h)
      .order('ordered_at', { ascending: false })
      .limit(2)

    if (data && data.length === 1) {
      return {
        row: data[0] as T,
        matchedBy: 'dl_state_recent',
        warning: 'Matched by DL+state recovery path (no remote ID was set on order). Verify order placement logic.',
      }
    }
    if (data && data.length > 1) {
      console.warn(
        `[WEBHOOK MATCH] Ambiguous DL+state match for ${tableName} (${data.length} candidates) — refusing to match.`,
        { dlNumber, dlState, candidates: data.map((r) => r.id) },
      )
    }
  }

  return null
}

/**
 * Build the "do not overwrite" patch for accio_remote_* fields based on how
 * we matched. Use this when constructing the order UPDATE so that strict
 * paths (1–4) leave existing IDs alone (they already match by definition),
 * and the DL+state recovery path is the ONLY thing that may write the IDs
 * for the first time.
 *
 * Why this matters: in the wrongful-matching bug, the old code blindly wrote
 * `accio_remote_order_number = parsed.remoteOrderNumber` on every webhook,
 * even when the order already had a different remote number from
 * placeOrder. That overwrite is what made the corruption permanent and
 * impossible to recover from without manual intervention.
 */
export function buildRemoteIdPatch(
  matched: MatchedOrder<{ accio_remote_order_number?: string | null; accio_remote_suborder_number?: string | null }>,
  webhookRemoteOrderNumber: string | null | undefined,
  webhookRemoteSubOrderNumber: string | null | undefined,
): { accio_remote_order_number?: string; accio_remote_suborder_number?: string } {
  if (matched.matchedBy === 'dl_state_recent') {
    // Recovery path: this is exactly when we expect remote IDs to be NULL on
    // the row, so populating them now is safe and necessary for future
    // postbacks to match by Strategy 1/3 instead of falling back here again.
    const patch: ReturnType<typeof buildRemoteIdPatch> = {}
    if (webhookRemoteOrderNumber) patch.accio_remote_order_number = webhookRemoteOrderNumber
    if (webhookRemoteSubOrderNumber) patch.accio_remote_suborder_number = webhookRemoteSubOrderNumber
    return patch
  }
  // Strategies 1-4: the row already has matching IDs (or matched by a
  // different identifier we trust). Don't touch the remote IDs — overwriting
  // them is what caused the wrongful-matching corruption.
  return {}
}
