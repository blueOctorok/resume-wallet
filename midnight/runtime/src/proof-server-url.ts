/**
 * Node's undici `fetch` rejects URLs with embedded credentials
 * ("Request cannot be constructed from a URL that includes credentials"),
 * which the wallet SDK surfaces as a generic "Transport error".
 *
 * Preferred .env shape (password not in the URL):
 *   MIDNIGHT_PROOF_SERVER_URL=https://provven-midnight-proof.fly.dev
 *   MIDNIGHT_PROOF_SERVER_USER=prove
 *   MIDNIGHT_PROOF_SERVER_PASSWORD=…
 *
 * Legacy `https://user:pass@host` still works — userinfo is stripped and turned
 * into an Authorization header before any Midnight client runs.
 */

export type ProofServerEndpoint = {
  /** https://host — no userinfo */
  url: string
  /** `Basic …` when a password was present, else null (local open Docker) */
  authorization: string | null
}

export type ProofServerAuthInput = {
  url: string
  /** Defaults to `prove` when a password is set */
  user?: string | null
  password?: string | null
}

export function resolveProofServerEndpoint(input: ProofServerAuthInput): ProofServerEndpoint {
  const trimmed = input.url.trim() || 'http://127.0.0.1:6300'
  const parsed = new URL(trimmed)

  const urlUser = decodeURIComponent(parsed.username)
  const urlPass = decodeURIComponent(parsed.password)
  // Explicit env wins over URL-embedded creds (preferred production shape).
  const password = (input.password?.trim() || urlPass || '')
  const user = (input.user?.trim() || urlUser || 'prove')

  const authorization = password
    ? `Basic ${Buffer.from(`${user}:${password}`, 'utf8').toString('base64')}`
    : null

  parsed.username = ''
  parsed.password = ''
  // URL.toString() keeps a trailing slash for origin-only URLs — strip it.
  const url = parsed.toString().replace(/\/$/, '')

  return { url, authorization }
}

/** @deprecated Prefer resolveProofServerEndpoint — kept for call-site clarity in older notes. */
export function parseProofServerUrl(raw: string): ProofServerEndpoint {
  return resolveProofServerEndpoint({ url: raw })
}

/** Add Authorization for our proof-server origin; strip any leftover userinfo. */
export function installProofServerAuthFetch(endpoint: ProofServerEndpoint): void {
  if (!endpoint.authorization) return

  const origin = new URL(endpoint.url).origin
  const auth = endpoint.authorization
  const originalFetch = globalThis.fetch.bind(globalThis)

  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const href =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url

    let target: string
    try {
      target = new URL(href).origin
    } catch {
      return originalFetch(input as RequestInfo, init)
    }

    if (target !== origin) {
      return originalFetch(input as RequestInfo, init)
    }

    // Never pass userinfo into undici — rebuild a clean URL / Request.
    const cleanHref = (() => {
      const u = new URL(href)
      u.username = ''
      u.password = ''
      return u.href
    })()

    const headers = new Headers(init?.headers)
    if (!headers.has('Authorization')) {
      headers.set('Authorization', auth)
    }

    if (typeof input === 'string' || input instanceof URL) {
      return originalFetch(cleanHref, { ...init, headers })
    }

    // Request instance — rebuild without credentialed URL
    const rebuilt = new Request(cleanHref, input)
    headers.forEach((value, key) => {
      if (!rebuilt.headers.has(key)) rebuilt.headers.set(key, value)
    })
    if (!rebuilt.headers.has('Authorization')) {
      rebuilt.headers.set('Authorization', auth)
    }
    return originalFetch(rebuilt, init)
  }) as typeof fetch
}
