import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  accioXmlHasFilledFmcsa,
  accioXmlHasFilledMvr,
  pullAccioOrderResults,
  summarizeAccioSuborders,
} from '@/lib/accio-get-order-results'
import { processMvrAccioWebhookCompletion } from '@/lib/process-mvr-accio-webhook'
import { processPspAccioWebhookCompletion } from '@/lib/process-psp-accio-webhook'

/**
 * GET /api/cron/reconcile-screenings
 *
 * Vercel cron — runs every 5 minutes. Pulls Accio `getOrderResults` for any
 * pending MVR or PSP order older than 10 minutes and imports completed
 * results through the same processors webhooks use.
 *
 * Why this exists:
 *   Accio webhooks are best-effort. We saw 22+ stuck MVR orders over 7 days
 *   where Accio had the result but the postback never reached our handler.
 *   This cron is the safety net so reports never sit forever, regardless of
 *   whether any employer or candidate is online to trigger a manual refresh.
 *
 * Auth: requires `?secret=$CRON_SECRET` (Vercel cron passes the secret header,
 * but we accept either to make manual testing easier).
 */

const STALE_MINUTES = 10
const MAX_PER_RUN = 100 // cap Accio calls per cron tick

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const providedSecret =
    request.nextUrl.searchParams.get('secret') ??
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    null

  if (secret && providedSecret !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const staleBefore = new Date(Date.now() - STALE_MINUTES * 60 * 1000).toISOString()

  const [{ data: mvrOrders }, { data: pspOrders }] = await Promise.all([
    supabase
      .from('mvr_orders')
      .select('id, status, accio_order_number, accio_remote_order_number, ordered_at')
      .eq('status', 'pending')
      .lt('ordered_at', staleBefore)
      .order('ordered_at', { ascending: true })
      .limit(MAX_PER_RUN),
    supabase
      .from('psp_orders')
      .select('id, status, accio_order_number, accio_remote_order_number, ordered_at')
      .eq('status', 'pending')
      .lt('ordered_at', staleBefore)
      .order('ordered_at', { ascending: true })
      .limit(MAX_PER_RUN),
  ])

  const summary = {
    mvr: { checked: 0, reconciled: 0, stillPending: 0, errors: 0 },
    psp: { checked: 0, reconciled: 0, stillPending: 0, errors: 0 },
  }

  for (const row of mvrOrders ?? []) {
    summary.mvr.checked++
    const r = await reconcileOne(supabase, 'mvr', row)
    bumpSummary(summary.mvr, r.action)
  }

  for (const row of pspOrders ?? []) {
    summary.psp.checked++
    const r = await reconcileOne(supabase, 'psp', row)
    bumpSummary(summary.psp, r.action)
  }

  console.log('[RECONCILE CRON]', JSON.stringify(summary))

  return NextResponse.json({ success: true, ...summary })
}

function bumpSummary(
  s: { reconciled: number; stillPending: number; errors: number },
  action: string,
) {
  if (action === 'reconciled') s.reconciled++
  else if (action === 'still_pending') s.stillPending++
  else s.errors++
}

async function reconcileOne(
  supabase: SupabaseClient,
  kind: 'mvr' | 'psp',
  row: {
    id: string
    status: string
    accio_order_number: string | null
    accio_remote_order_number: string | null
  },
): Promise<{ action: string }> {
  // Prefer Accio's internal orderID; fall back to our reference number.
  const primary = row.accio_remote_order_number || row.accio_order_number
  if (!primary) return { action: 'errors' }

  let pull = await pullAccioOrderResults(primary)
  let usedId = primary
  if (
    pull.ok === false &&
    row.accio_remote_order_number &&
    row.accio_order_number &&
    primary === row.accio_remote_order_number
  ) {
    console.warn(
      `[RECONCILE CRON] ${kind} ${row.id} remote ID ${primary} bounced, retrying with reference ${row.accio_order_number}`,
    )
    pull = await pullAccioOrderResults(row.accio_order_number)
    usedId = row.accio_order_number
  }

  if (pull.ok === false) {
    console.error(
      `[RECONCILE CRON] Accio pull failed ${kind} ${row.id} (id=${usedId}, status=${pull.status}):`,
      pull.body.slice(0, 500),
    )
    return { action: 'errors' }
  }

  const ready =
    kind === 'mvr' ? accioXmlHasFilledMvr(pull.xml) : accioXmlHasFilledFmcsa(pull.xml)
  if (!ready) {
    const sum = summarizeAccioSuborders(pull.xml)
      .map((s) => `${s.type ?? '?'}:${s.filledStatus ?? '?'}`)
      .join(', ')
    console.log(`[RECONCILE CRON] ${kind} ${row.id} (id=${usedId}) still pending: ${sum || 'no suborders'}`)
    return { action: 'still_pending' }
  }

  try {
    const outcome =
      kind === 'mvr'
        ? await processMvrAccioWebhookCompletion(supabase, pull.xml)
        : await processPspAccioWebhookCompletion(supabase, pull.xml)
    if (outcome.status >= 400) {
      console.error(
        `[RECONCILE CRON] ${kind} ${row.id} process error:`,
        outcome.body,
      )
      return { action: 'errors' }
    }
    console.log(`[RECONCILE CRON] ${kind} ${row.id} reconciled via id=${usedId}`)
    return { action: 'reconciled' }
  } catch (e) {
    console.error(
      `[RECONCILE CRON] ${kind} ${row.id} threw:`,
      e instanceof Error ? e.message : String(e),
    )
    return { action: 'errors' }
  }
}
