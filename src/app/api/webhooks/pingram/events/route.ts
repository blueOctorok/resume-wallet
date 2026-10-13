import { NextRequest, NextResponse } from 'next/server'
import { verify, WebhookSignatureError, WebhookTimestampError } from 'pingram/webhooks'
import type { WebhookEvent } from 'pingram'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { processEvrDeliveryEvent } from '@/lib/evr-outreach'

const EVR_EVENTS = new Set(['EMAIL_DELIVERED', 'EMAIL_OPEN', 'EMAIL_CLICK', 'EMAIL_FAILED'])

/**
 * POST /api/webhooks/pingram/events
 *
 * Pingram delivery events (delivered / open / click / failed). Matched to an
 * EV attempt by trackingId so the driver sees what happened to each send and
 * a bounce pauses the cadence instead of burning the remaining attempts.
 *
 * Auth: Pingram signs webhooks (X-Pingram-* headers). We verify when the
 * signature is present and otherwise fall back to the shared URL secret the
 * inbound route already uses, so both can be configured the same way.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.PINGRAM_WEBHOOK_SECRET?.trim() || process.env.INTERNAL_API_SECRET?.trim()
  if (!secret) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 503 })
  }

  const raw = await request.text()
  const signature = request.headers.get('X-Pingram-Signature')
  let event: WebhookEvent

  try {
    if (signature) {
      event = verify({
        payload: raw,
        headers: {
          id: request.headers.get('X-Pingram-Id') ?? '',
          signature,
          timestamp: request.headers.get('X-Pingram-Timestamp') ?? '',
        },
        secret,
      })
    } else {
      const provided =
        request.nextUrl.searchParams.get('secret') ??
        request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
      if (provided !== secret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      event = JSON.parse(raw) as WebhookEvent
    }
  } catch (err) {
    if (err instanceof WebhookSignatureError || err instanceof WebhookTimestampError) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Non-EV traffic (invites, alerts) also flows through here — acknowledge and move on.
  if (!EVR_EVENTS.has(event.eventType)) {
    return NextResponse.json({ success: true, ignored: true })
  }

  try {
    const supabase = await getAdminSupabaseClient()
    const result = await processEvrDeliveryEvent(supabase, event)
    return NextResponse.json({ success: true, matched: result.matched })
  } catch (error) {
    console.error('[PINGRAM EVENTS] unexpected:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
