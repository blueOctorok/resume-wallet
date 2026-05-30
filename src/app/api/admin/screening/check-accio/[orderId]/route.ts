import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/admin-auth'
import { processPspAccioWebhookCompletion } from '@/lib/process-psp-accio-webhook'
import { processMvrAccioWebhookCompletion } from '@/lib/process-mvr-accio-webhook'
import {
  accioXmlHasFilledFmcsa,
  accioXmlHasFilledMvr,
  pullAccioOrderResults,
  summarizeAccioSuborders,
} from '@/lib/accio-get-order-results'

/**
 * Admin diagnostic: pull screening status from Accio via `getOrderResults`.
 *
 * GET  ...?kind=mvr|psp (default psp) — preview only
 * POST ...?apply=true — replay filled results through webhook processors
 */

async function fetchStormOrder(
  orderId: string,
  kind: 'mvr' | 'psp',
): Promise<{
  accioOrderNumber: string | null
  accioRemoteOrderNumber: string | null
  currentStatus: string | null
  orderedAt: string | null
}> {
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const table = kind === 'mvr' ? 'mvr_orders' : 'psp_orders'
  const { data } = await supabase
    .from(table)
    .select('accio_order_number, accio_remote_order_number, status, ordered_at')
    .eq('id', orderId)
    .maybeSingle()
  if (!data) {
    return { accioOrderNumber: null, accioRemoteOrderNumber: null, currentStatus: null, orderedAt: null }
  }
  return {
    accioOrderNumber: data.accio_order_number ?? null,
    accioRemoteOrderNumber: data.accio_remote_order_number ?? null,
    currentStatus: data.status ?? null,
    orderedAt: data.ordered_at ?? null,
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const auth = await requireAdmin(request)
  if (auth.error) return auth.error

  const { orderId } = await params
  const kind = request.nextUrl.searchParams.get('kind') === 'mvr' ? 'mvr' : 'psp'
  const { accioOrderNumber, accioRemoteOrderNumber, currentStatus, orderedAt } =
    await fetchStormOrder(orderId, kind)
  if (!accioOrderNumber && !accioRemoteOrderNumber) {
    return NextResponse.json(
      { error: `${kind.toUpperCase()} order not found or has no Accio order number` },
      { status: 404 },
    )
  }

  // Try Accio's internal ID first, fall back to our reference.
  const primary = accioRemoteOrderNumber || accioOrderNumber!
  let accio = await pullAccioOrderResults(primary)
  let usedId = primary
  if (accio.ok === false && accioRemoteOrderNumber && accioOrderNumber && primary === accioRemoteOrderNumber) {
    accio = await pullAccioOrderResults(accioOrderNumber)
    usedId = accioOrderNumber
  }

  if (accio.ok === false) {
    return NextResponse.json(
      {
        error: `Accio returned ${accio.status}`,
        body: accio.body,
        triedIds: { accioOrderNumber, accioRemoteOrderNumber, used: usedId },
      },
      { status: 502 },
    )
  }

  return NextResponse.json({
    success: true,
    kind,
    storm: { orderId, currentStatus, orderedAt, accioOrderNumber, accioRemoteOrderNumber },
    accio: {
      lookupIdUsed: usedId,
      suborders: summarizeAccioSuborders(accio.xml),
      mvrFilled: accioXmlHasFilledMvr(accio.xml),
      fmcsaFilled: accioXmlHasFilledFmcsa(accio.xml),
      responseLength: accio.xml.length,
      rawHead: accio.xml.substring(0, 4000),
    },
  })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const auth = await requireAdmin(request)
  if (auth.error) return auth.error

  const { orderId } = await params
  const kind = request.nextUrl.searchParams.get('kind') === 'mvr' ? 'mvr' : 'psp'
  const apply = request.nextUrl.searchParams.get('apply') === 'true'

  const { accioOrderNumber, accioRemoteOrderNumber, currentStatus, orderedAt } =
    await fetchStormOrder(orderId, kind)
  if (!accioOrderNumber && !accioRemoteOrderNumber) {
    return NextResponse.json(
      { error: `${kind.toUpperCase()} order not found or has no Accio order number` },
      { status: 404 },
    )
  }

  const primary = accioRemoteOrderNumber || accioOrderNumber!
  let accio = await pullAccioOrderResults(primary)
  let usedId = primary
  if (accio.ok === false && accioRemoteOrderNumber && accioOrderNumber && primary === accioRemoteOrderNumber) {
    accio = await pullAccioOrderResults(accioOrderNumber)
    usedId = accioOrderNumber
  }

  if (accio.ok === false) {
    return NextResponse.json(
      {
        error: `Accio returned ${accio.status}`,
        body: accio.body,
        triedIds: { accioOrderNumber, accioRemoteOrderNumber, used: usedId },
      },
      { status: 502 },
    )
  }

  const suborders = summarizeAccioSuborders(accio.xml)
  let replay: { replayed: boolean; detail: string } = { replayed: false, detail: 'apply=false' }

  if (apply) {
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const ready = kind === 'mvr' ? accioXmlHasFilledMvr(accio.xml) : accioXmlHasFilledFmcsa(accio.xml)
    if (!ready) {
      replay = { replayed: false, detail: 'Accio suborder not filled yet' }
    } else {
      try {
        const outcome =
          kind === 'mvr'
            ? await processMvrAccioWebhookCompletion(supabase, accio.xml)
            : await processPspAccioWebhookCompletion(supabase, accio.xml)
        replay = {
          replayed: outcome.status < 400,
          detail: `Processor responded ${outcome.status}: ${JSON.stringify(outcome.body)}`,
        }
      } catch (e) {
        replay = {
          replayed: false,
          detail: `Processor threw: ${e instanceof Error ? e.message : String(e)}`,
        }
      }
    }
  }

  return NextResponse.json({
    success: true,
    kind,
    storm: { orderId, currentStatus, orderedAt, accioOrderNumber, accioRemoteOrderNumber },
    accio: {
      lookupIdUsed: usedId,
      suborders,
      responseLength: accio.xml.length,
      rawHead: accio.xml.substring(0, 4000),
    },
    replay,
  })
}
