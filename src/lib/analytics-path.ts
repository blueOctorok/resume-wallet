/**
 * Page path sent to Google Analytics.
 * Invite, apply, and share links carry an unguessable code. That code is a
 * credential, so the report stores the route shape only.
 */
const SECRET_PREFIXES = [
  '/apply/',
  '/ask/',
  '/onboard/',
  '/invite/',
  '/card/',
  '/dev-card/',
  '/d/',
  '/application/',
  '/verify/',
]

export function analyticsPath(pathname: string): string {
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`
  for (const prefix of SECRET_PREFIXES) {
    if (path.startsWith(prefix) && path.length > prefix.length) {
      return `${prefix}[token]`
    }
  }
  return path
}

const MEASUREMENT_ID = /^G-[A-Z0-9]+$/

/** Provven production stream. Public by design; the tag is in the browser. */
const PROVVEN_MEASUREMENT_ID = 'G-3P343MXLST'

/**
 * GA4 measurement id. The Vercel env wins when it is set. Production uses the
 * Provven stream when the env is empty. Development stays dark.
 */
export function googleAnalyticsId(): string | null {
  const fromEnv = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() ?? ''
  const id = fromEnv || (process.env.NODE_ENV === 'production' ? PROVVEN_MEASUREMENT_ID : '')
  return MEASUREMENT_ID.test(id) ? id : null
}
