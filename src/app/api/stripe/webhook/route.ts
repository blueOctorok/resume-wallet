import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { settleScreeningCheckout } from '@/lib/screening-stripe-payment'

/**
 * POST /api/stripe/webhook — Stripe → Provven.
 *
 * Signature is verified against the raw body, so this route must read `text()`
 * (never `json()`) and is excluded from the session middleware. Only Checkout
 * completion matters today; everything else is acknowledged and ignored.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  const signature = request.headers.get('stripe-signature')
  if (!secret || !signature) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(await request.text(), signature, secret)
  } catch (error) {
    console.error('[STRIPE WEBHOOK] signature check failed:', error)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (
    event.type === 'checkout.session.completed' ||
    event.type === 'checkout.session.async_payment_succeeded'
  ) {
    const settled = await settleScreeningCheckout(await getAdminSupabaseClient(), event.data.object)
    console.log(`[STRIPE WEBHOOK] ${event.type} ${event.data.object.id} settled=${settled}`)
  }

  return NextResponse.json({ received: true })
}
