import type { NextRequest } from 'next/server'

/**
 * Returns the app's public base URL for links (e.g. verify link in emails).
 * Use this so verification emails point to the real domain in production, not localhost.
 *
 * Order: NEXT_PUBLIC_APP_URL → VERCEL_URL → request origin → localhost fallback.
 */
export function getAppBaseUrl(request?: NextRequest): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
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
