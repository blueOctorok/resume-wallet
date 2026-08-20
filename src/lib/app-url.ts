import type { NextRequest } from 'next/server'

/** Retired product hosts — never put these in outbound email/SMS even if env is stale. */
const RETIRED_PUBLIC_ORIGIN = /^https?:\/\/(www\.)?(zknight\.io|stormchain\.ai)$/i

export function canonicalizePublicOrigin(url: string): string {
  const trimmed = url.replace(/\/$/, '')
  if (RETIRED_PUBLIC_ORIGIN.test(trimmed)) return 'https://provven.com'
  return trimmed
}

/**
 * Returns the app's public base URL for links (e.g. verify link in emails).
 * Use this so verification emails point to the real domain in production, not localhost.
 *
 * Order: NEXT_PUBLIC_APP_URL → VERCEL_URL → request origin → localhost fallback.
 */
export function getAppBaseUrl(request?: NextRequest): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return canonicalizePublicOrigin(process.env.NEXT_PUBLIC_APP_URL)
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  // In production, use the request's origin so the link matches where the user is
  if (request) {
    try {
      const url = new URL(request.url)
      return url.origin
    } catch {
      const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
      const proto = request.headers.get('x-forwarded-proto') || 'https'
      if (host) return `${proto === 'https' ? 'https' : 'http'}://${host}`
    }
  }
  return 'http://localhost:3000'
}

/**
 * Resolve the public webhook URL for an Accio screening (MVR/PSP) order.
 * Hard-fails in production if no real URL can be resolved — silently posting
 * webhooks to localhost means orders sit "pending" forever in prod, which was
 * a real cause of the screening pipeline outages.
 *
 * Throws when running on Vercel/prod with no resolvable host so the caller
 * surfaces a 500 instead of placing an unrecoverable order.
 */
export function getScreeningWebhookBaseUrl(request?: NextRequest): string {
  const base = getAppBaseUrl(request)
  if (
    process.env.NODE_ENV === 'production' &&
    /^http:\/\/localhost(:\d+)?$/i.test(base)
  ) {
    throw new Error(
      'Refusing to place Accio order: no public webhook URL is configured. ' +
        'Set NEXT_PUBLIC_APP_URL or rely on VERCEL_URL — never post to localhost in production.',
    )
  }
  return base
}
