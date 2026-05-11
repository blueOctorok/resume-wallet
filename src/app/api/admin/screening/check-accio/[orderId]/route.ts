import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin-auth'
import { processPspAccioWebhookCompletion } from '@/lib/process-psp-accio-webhook'

/**
 * Admin diagnostic: pull a screening order's status directly from Accio via
 * `getOrderResults`, instead of waiting for Accio's webhook to fire.
 *
 * Why this exists:
 *   PSP queries through FMCSA can sit in Accio's queue for 30+ minutes. If the
 *   order is genuinely "still processing", we wait. But if Accio has the result
 *   and the webhook delivery silently failed, we'd otherwise wait forever.
 *   This endpoint lets admin ask Accio "what do you actually have?" and replay
 *   the result through our normal PSP webhook path so the order, the block
 *   table, and notifications all get the same treatment as a real postback.
 *
 * Usage:
 *   GET  /api/admin/screening/check-accio/{pspOrderId}
 *     → pull current status from Accio, return summary, do NOT touch the DB
 *   POST /api/admin/screening/check-accio/{pspOrderId}?apply=true
 *     → pull from Accio AND if FMCSA suborder is filled, replay through the
 *       PSP webhook processor (updates the row + sends emails as if Accio had
 *       posted normally)
 *
 * Auth: ADMIN_WALLETS only — this calls Accio with billable creds and writes
 * to production tables. Not a public endpoint.
 */

const ACCIO_API_URL = process.env.ACCIO_API_URL || 'https://service.keybackground.com/c/p/researcherxml'

function buildGetOrderResultsXml(accioOrderNumber: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<XML>
    <login>
        <account>${process.env.ACCIO_ACCOUNT || ''}</account>
        <username>${process.env.ACCIO_USERNAME || ''}</username>
        <password>${process.env.ACCIO_PASSWORD || ''}</password>
    </login>
    <getOrderResults orderID="${accioOrderNumber}" />
</XML>`
}

interface SuborderSummary {
  type: string | null
  filledStatus: string | null
  filledCode: string | null
  heldForReview: string | null
  remoteSubOrderNumber: string | null
}

/** Pull a quick summary of every subOrder in the response so admin can eyeball it. */
function summarizeSuborders(xml: string): SuborderSummary[] {
  const re = /<subOrder([^>]*)>/gi
  const out: SuborderSummary[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) {
    const attrs = m[1]
    const a = (name: string) =>
      new RegExp(`\\b${name}=["']([^"']*)["']`, 'i').exec(attrs)?.[1] ?? null
    out.push({
      type: a('type'),
      filledStatus: a('filledStatus'),
      filledCode: a('filledCode'),
      heldForReview: a('held_for_review'),
      remoteSubOrderNumber: a('remote_number') ?? a('number'),
    })
  }
  return out
}

async function fetchAccioFromPspOrder(orderId: string): Promise<{
  accioOrderNumber: string | null
  currentStatus: string | null
  orderedAt: string | null
}> {
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data } = await supabase
    .from('psp_orders')
    .select('accio_order_number, status, ordered_at')
    .eq('id', orderId)
    .maybeSingle()
  if (!data) return { accioOrderNumber: null, currentStatus: null, orderedAt: null }
  return {
    accioOrderNumber: data.accio_order_number ?? null,
    currentStatus: data.status ?? null,
    orderedAt: data.ordered_at ?? null,
  }
}

interface AccioPullSuccess { ok: true; xml: string }
interface AccioPullFailure { ok: false; status: number; body: string }
type AccioPullResult = AccioPullSuccess | AccioPullFailure

async function pullFromAccio(accioOrderNumber: string): Promise<AccioPullResult> {
  const requestXml = buildGetOrderResultsXml(accioOrderNumber)
  try {
    const res = await fetch(ACCIO_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' },
      body: requestXml,
    })
    const xml = await res.text()
    if (!res.ok) return { ok: false, status: res.status, body: xml }
    return { ok: true, xml }
  } catch (e) {
    return {
      ok: false,
      status: 502,
      body: e instanceof Error ? e.message : String(e),
    }
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const auth = requireAdmin(request)
  if (auth.error) return auth.error

  const { orderId } = await params
  const { accioOrderNumber, currentStatus, orderedAt } = await fetchAccioFromPspOrder(orderId)
  if (!accioOrderNumber) {
    return NextResponse.json({ error: 'PSP order not found or has no Accio order number' }, { status: 404 })
  }

  const accio = await pullFromAccio(accioOrderNumber)
  if (accio.ok === false) {
    return NextResponse.json({ error: `Accio returned ${accio.status}`, body: accio.body }, { status: 502 })
  }

  return NextResponse.json({
    success: true,
    storm: { orderId, currentStatus, orderedAt, accioOrderNumber },
    accio: {
      suborders: summarizeSuborders(accio.xml),
      responseLength: accio.xml.length,
      rawHead: accio.xml.substring(0, 2000),
    },
  })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const auth = requireAdmin(request)
  if (auth.error) return auth.error

  const { orderId } = await params
  const apply = request.nextUrl.searchParams.get('apply') === 'true'

  const { accioOrderNumber, currentStatus, orderedAt } = await fetchAccioFromPspOrder(orderId)
  if (!accioOrderNumber) {
    return NextResponse.json({ error: 'PSP order not found or has no Accio order number' }, { status: 404 })
  }

  const accio = await pullFromAccio(accioOrderNumber)
  if (accio.ok === false) {
    return NextResponse.json({ error: `Accio returned ${accio.status}`, body: accio.body }, { status: 502 })
  }

  const suborders = summarizeSuborders(accio.xml)

  let replay: { replayed: boolean; detail: string } = { replayed: false, detail: 'apply=false' }
  if (apply) {
    // Reuse the production PSP webhook processor so side effects (status flip,
    // block sync, dedup'd email) match exactly what would have happened on a
    // real postback. The processor checks `previousStatus === 'pending'` so
    // calling it twice on a completed order is safe.
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    try {
      const outcome = await processPspAccioWebhookCompletion(supabase, accio.xml)
      replay = {
        replayed: true,
        detail: `Processor responded ${outcome.status}: ${JSON.stringify(outcome.body)}`,
      }
    } catch (e) {
      replay = {
        replayed: false,
        detail: `Processor threw: ${e instanceof Error ? e.message : String(e)}`,
      }
    }
  }

  return NextResponse.json({
    success: true,
    storm: { orderId, currentStatus, orderedAt, accioOrderNumber },
    accio: {
      suborders,
      responseLength: accio.xml.length,
      rawHead: accio.xml.substring(0, 2000),
    },
    replay,
  })
}
