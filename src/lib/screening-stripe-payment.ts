import type { SupabaseClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'
import { getStripe } from './stripe'
import { isActiveScreeningOrderStatus } from './driver-owned-screening'

/**
 * Stripe Checkout for driver-initiated MVR orders (DEC-2026-10-001).
 *
 * Who pays:
 *   - Driver opens the MVR block on their own hub → they pay here first.
 *   - Company (Pace) requests the screening → company is billed per pull by the
 *     vendor; the order uses a $0 waived row (resolve-waived-screening-payment.ts).
 *
 * PSP is employer-ordered only, so it is deliberately not a paid kind here.
 *
 * Pay first, then fill the form. The order form never carries the SSN across the
 * Checkout redirect — instead a paid session becomes a *credit*: one COMPLETED
 * Stripe payment row that no order has used yet. The order route spends it.
 */

/** Screening kinds a driver can buy for themselves. Add here if that ever widens. */
export type PaidScreeningKind = 'mvr'

const PAYMENT_TYPE: Record<PaidScreeningKind, string> = { mvr: 'MVR_ORDER' }
const ORDER_TABLE: Record<PaidScreeningKind, string> = { mvr: 'mvr_orders' }
const PRICE_ENV: Record<PaidScreeningKind, string> = { mvr: 'STRIPE_PRICE_MVR' }

/** Checkout sessions expire after 24h, so an older PENDING row can never settle. */
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000

export interface ScreeningPrice {
  amountCents: number
  currency: string
}

export interface ScreeningCredit {
  paymentId: string
  amountCents: number | null
  currency: string | null
}

type StripePaymentRow = {
  id: string
  status: string
  stripe_session_id: string | null
  amount_cents: number | null
  currency: string | null
  created_at: string
}

export function parsePaidScreeningKind(value: string | null | undefined): PaidScreeningKind | null {
  return value === 'mvr' ? value : null
}

function priceIdFor(kind: PaidScreeningKind): string {
  const id = process.env[PRICE_ENV[kind]]
  if (!id) throw new Error(`${PRICE_ENV[kind]} is not set`)
  return id
}

export function isScreeningCheckoutConfigured(kind: PaidScreeningKind): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env[PRICE_ENV[kind]])
}

/** Price lives in the Stripe dashboard, not in code — read it so the UI shows the real number. */
export async function getScreeningPrice(kind: PaidScreeningKind): Promise<ScreeningPrice> {
  const price = await getStripe().prices.retrieve(priceIdFor(kind))
  return { amountCents: price.unit_amount ?? 0, currency: price.currency }
}

export interface CreateScreeningCheckoutInput {
  userId: string
  email: string | null
  kind: PaidScreeningKind
  appBaseUrl: string
}

/**
 * Insert a PENDING payment row, then open a Checkout session that points back at it.
 * Row-first so the webhook and the return-page settle always have something to update.
 */
export async function createScreeningCheckout(
  supabase: SupabaseClient,
  { userId, email, kind, appBaseUrl }: CreateScreeningCheckoutInput,
): Promise<string> {
  const { data: payment, error: insertErr } = await supabase
    .from('payments')
    .insert({
      type: PAYMENT_TYPE[kind],
      status: 'PENDING',
      user_id: userId,
      provider: 'stripe',
    })
    .select('id')
    .single()
  if (insertErr || !payment) {
    throw new Error(`Failed to create payment row: ${insertErr?.message ?? 'no row'}`)
  }

  // Back to the same block either way — the form re-checks for credit on mount.
  const returnUrl = `${appBaseUrl}/?onboard=${kind}`
  const session = await getStripe().checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price: priceIdFor(kind), quantity: 1 }],
    customer_email: email ?? undefined,
    client_reference_id: payment.id,
    metadata: { paymentId: payment.id, userId, kind },
    success_url: returnUrl,
    cancel_url: returnUrl,
  })
  if (!session.url) throw new Error('Stripe returned a Checkout session without a URL')

  await supabase
    .from('payments')
    .update({
      stripe_session_id: session.id,
      amount_cents: session.amount_total,
      currency: session.currency,
    })
    .eq('id', payment.id)

  return session.url
}

/**
 * Mark the payment COMPLETED once Stripe says the session is paid.
 * Idempotent — the webhook and the credit lookup can both call it.
 */
export async function settleScreeningCheckout(
  supabase: SupabaseClient,
  session: Stripe.Checkout.Session,
): Promise<boolean> {
  if (session.payment_status !== 'paid') return false
  const paymentId = session.metadata?.paymentId ?? session.client_reference_id
  if (!paymentId) return false

  const intentId =
    typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null

  const { error } = await supabase
    .from('payments')
    .update({
      status: 'COMPLETED',
      stripe_session_id: session.id,
      stripe_payment_intent_id: intentId,
      amount_cents: session.amount_total,
      currency: session.currency,
    })
    .eq('id', paymentId)
    .eq('provider', 'stripe')
  if (error) {
    console.error('[STRIPE] settle failed for payment', paymentId, error)
    return false
  }
  return true
}

/** Payment ids already spent by an order that is still alive. Failed/cancelled orders release the credit. */
async function consumedPaymentIds(
  supabase: SupabaseClient,
  kind: PaidScreeningKind,
  paymentIds: string[],
): Promise<Set<string>> {
  const { data } = await supabase
    .from(ORDER_TABLE[kind])
    .select('payment_id, status')
    .in('payment_id', paymentIds)
  const consumed = new Set<string>()
  for (const row of data ?? []) {
    if (row.payment_id && isActiveScreeningOrderStatus(row.status)) consumed.add(row.payment_id)
  }
  return consumed
}

/**
 * The driver's paid-but-unused Stripe payment for this kind, if any.
 *
 * PENDING rows younger than 24h are checked against Stripe directly, so a slow
 * or missing webhook (local dev) never blocks a driver who just paid.
 */
export async function findDriverScreeningCredit(
  supabase: SupabaseClient,
  userId: string,
  kind: PaidScreeningKind,
): Promise<ScreeningCredit | null> {
  const { data: rows } = await supabase
    .from('payments')
    .select('id, status, stripe_session_id, amount_cents, currency, created_at')
    .eq('user_id', userId)
    .eq('provider', 'stripe')
    .eq('type', PAYMENT_TYPE[kind])
    .in('status', ['PENDING', 'COMPLETED'])
    .order('created_at', { ascending: false })
    .limit(10)
    .returns<StripePaymentRow[]>()
  if (!rows?.length) return null

  const consumed = await consumedPaymentIds(supabase, kind, rows.map((r) => r.id))
  const cutoff = Date.now() - SESSION_MAX_AGE_MS

  for (const row of rows) {
    if (consumed.has(row.id)) continue
    const credit = { paymentId: row.id, amountCents: row.amount_cents, currency: row.currency }

    if (row.status === 'COMPLETED') return credit
    if (!row.stripe_session_id || new Date(row.created_at).getTime() < cutoff) continue

    const session = await getStripe().checkout.sessions.retrieve(row.stripe_session_id)
    if (await settleScreeningCheckout(supabase, session)) {
      return { ...credit, amountCents: session.amount_total, currency: session.currency }
    }
  }
  return null
}
