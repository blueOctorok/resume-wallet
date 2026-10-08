import Stripe from 'stripe'

let client: Stripe | null = null

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}

/** Server-only Stripe client. Lazy so builds and non-payment routes never need the key. */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
  client ??= new Stripe(key)
  return client
}
