/**
 * Invite → sign-in → hub resume.
 *
 * Google OAuth and magic-link Site URL fallbacks often drop `?next=`.
 * We stash the invite in localStorage (survives a new tab) and treat
 * `/?invite=` on the homepage as a first-class resume signal.
 */

export const INVITE_TOKEN_KEY = 'stormchain_invite_token'
export const AUTH_NEXT_KEY = 'stormchain_auth_next'
export const ONBOARD_TARGET_KEY = 'storm_onboard_target'

export function isSafeInternalPath(path: string | null): path is string {
  return Boolean(path && path.startsWith('/') && !path.startsWith('//'))
}

/** Employer invite tokens are 16-byte base64url (see /api/employer/invites). */
export function isInviteToken(token: string | null): token is string {
  return Boolean(token && /^[A-Za-z0-9_-]{8,128}$/.test(token))
}

export function stashInviteToken(token: string) {
  if (typeof window === 'undefined' || !isInviteToken(token)) return
  window.localStorage.setItem(INVITE_TOKEN_KEY, token)
}

export function peekInviteToken(): string | null {
  if (typeof window === 'undefined') return null
  const token = window.localStorage.getItem(INVITE_TOKEN_KEY)
  return isInviteToken(token) ? token : null
}

export function clearInviteToken() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(INVITE_TOKEN_KEY)
}

export function stashAuthNext(next: string) {
  if (typeof window === 'undefined' || !isSafeInternalPath(next) || next === '/') return
  window.localStorage.setItem(AUTH_NEXT_KEY, next)
}

export function peekAuthNext(): string | null {
  if (typeof window === 'undefined') return null
  const next = window.localStorage.getItem(AUTH_NEXT_KEY)
  return isSafeInternalPath(next) ? next : null
}

export function clearAuthNext() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(AUTH_NEXT_KEY)
}

export function onboardTokenFromPath(path: string): string | null {
  const match = path.match(/^\/onboard\/([A-Za-z0-9_-]+)/)
  return match && isInviteToken(match[1]) ? match[1] : null
}

/** After Google/OTP, prefer the invite over a bare `/`. */
export function resolvePostAuthPath(queryNext: string | null): string {
  const invite = peekInviteToken()
  if (invite) return `/onboard/${invite}`
  if (isSafeInternalPath(queryNext) && queryNext !== '/') return queryNext
  const stored = peekAuthNext()
  if (stored) return stored
  return '/'
}
