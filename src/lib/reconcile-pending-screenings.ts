import type { SupabaseClient } from '@supabase/supabase-js'
import {
  accioXmlHasFilledFmcsa,
  accioXmlHasFilledMvr,
  pullAccioOrderResults,
  summarizeAccioSuborders,
} from '@/lib/accio-get-order-results'
import { processMvrAccioWebhookCompletion } from '@/lib/process-mvr-accio-webhook'
import { processPspAccioWebhookCompletion } from '@/lib/process-psp-accio-webhook'

const DEFAULT_STALE_MINUTES = 10

export interface ReconcileOneResult {
  orderId: string
  kind: 'mvr' | 'psp'
  accioOrderNumber: string
  previousStatus: string
  action: 'still_pending' | 'reconciled' | 'accio_error' | 'process_error' | 'skipped'
  detail: string
  newStatus?: string
}

export interface ReconcileOptions {
  /** Reconcile only this order (still must be pending + have an Accio number) */
  orderId?: string
  /** Filter by kind */
  kind?: 'mvr' | 'psp'
  /** Only reconcile orders ordered_at < now() - staleMinutes. Default 10. */
  staleMinutes?: number
}

/**
 * Ask Accio for current results and replay through the same processors as webhooks.
 * Fixes orders stuck at `pending` when Key has the report but postback never landed.
 */
export async function reconcilePendingScreeningsForCompany(
  supabase: SupabaseClient,
  companyId: string,
  options?: ReconcileOptions,
): Promise<ReconcileOneResult[]> {
  const staleMinutes = options?.staleMinutes ?? DEFAULT_STALE_MINUTES
  const staleBefore = new Date(Date.now() - staleMinutes * 60 * 1000).toISOString()
  const results: ReconcileOneResult[] = []

  const reconcileMvr = async () => {
    let query = supabase
      .from('mvr_orders')
      .select('id, status, accio_order_number, ordered_at')
      .eq('ordered_by_company_id', companyId)
      .eq('status', 'pending')
      .not('accio_order_number', 'is', null)
      .lt('ordered_at', staleBefore)

    if (options?.orderId) query = query.eq('id', options.orderId)

    const { data: orders } = await query.limit(50)
    for (const row of orders ?? []) {
      results.push(await reconcileOne(supabase, 'mvr', row))
    }
  }

  const reconcilePsp = async () => {
    let query = supabase
      .from('psp_orders')
      .select('id, status, accio_order_number, ordered_at')
      .eq('ordered_by_company_id', companyId)
      .eq('status', 'pending')
      .not('accio_order_number', 'is', null)
      .lt('ordered_at', staleBefore)

    if (options?.orderId) query = query.eq('id', options.orderId)

    const { data: orders } = await query.limit(50)
    for (const row of orders ?? []) {
      results.push(await reconcileOne(supabase, 'psp', row))
    }
  }

  if (!options?.kind || options.kind === 'mvr') await reconcileMvr()
  if (!options?.kind || options.kind === 'psp') await reconcilePsp()

  return results
}

async function reconcileOne(
  supabase: SupabaseClient,
  kind: 'mvr' | 'psp',
  row: { id: string; status: string; accio_order_number: string | null },
): Promise<ReconcileOneResult> {
  const accioOrderNumber = row.accio_order_number
  if (!accioOrderNumber) {
    return {
      orderId: row.id,
      kind,
      accioOrderNumber: '',
      previousStatus: row.status,
      action: 'skipped',
      detail: 'No Accio order number on row',
    }
  }

  const pull = await pullAccioOrderResults(accioOrderNumber)
  if (pull.ok === false) {
    console.error(`[RECONCILE] Accio pull failed ${kind} ${row.id}:`, pull.status, pull.body.slice(0, 300))
    return {
      orderId: row.id,
      kind,
      accioOrderNumber,
      previousStatus: row.status,
      action: 'accio_error',
      detail: `Accio HTTP ${pull.status}`,
    }
  }

  const suborders = summarizeAccioSuborders(pull.xml)
  const ready =
    kind === 'mvr' ? accioXmlHasFilledMvr(pull.xml) : accioXmlHasFilledFmcsa(pull.xml)

  if (!ready) {
    const summary = suborders
      .map((s) => `${s.type ?? '?'}:${s.filledStatus ?? '?'}`)
      .join(', ')
    return {
      orderId: row.id,
      kind,
      accioOrderNumber,
      previousStatus: row.status,
      action: 'still_pending',
      detail: summary || 'No filled suborder in Accio response',
    }
  }

  try {
    const outcome =
      kind === 'mvr'
        ? await processMvrAccioWebhookCompletion(supabase, pull.xml)
        : await processPspAccioWebhookCompletion(supabase, pull.xml)

    if (outcome.status >= 400) {
      return {
        orderId: row.id,
        kind,
        accioOrderNumber,
        previousStatus: row.status,
        action: 'process_error',
        detail: JSON.stringify(outcome.body).slice(0, 200),
      }
    }

    const newStatus =
      typeof outcome.body.status === 'string' ? outcome.body.status : undefined

    console.log(`[RECONCILE] ${kind} ${row.id} reconciled via pull`)

    return {
      orderId: row.id,
      kind,
      accioOrderNumber,
      previousStatus: row.status,
      action: 'reconciled',
      detail: 'Imported from Accio getOrderResults',
      newStatus,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return {
      orderId: row.id,
      kind,
      accioOrderNumber,
      previousStatus: row.status,
      action: 'process_error',
      detail: msg,
    }
  }
}
