/**
 * Session resolver (Phase 1 — Supabase-only as of the T1.12c cutover).
 *
 * Returns the Storm `users.id` for the authenticated caller from the Supabase
 * Auth session cookie. By the T1.3 convention `auth.users.id` IS `users.id`,
 * so a resolved cookie returns `user.id` directly with NO database lookup.
 *
 * The legacy `x-wallet-address` fallback was REMOVED at the T1.12 cutover:
 * every login is now Supabase, and same-origin fetches carry the session
 * cookie (the middleware refreshes it). Routes that still read
 * `x-wallet-address` directly — `requireAdmin`, `/api/driver/public/[token]` —
 * are independent of this helper and unaffected.
 *
 * The `request` argument is retained (now ignored) so the ~30 existing callers
 * keep compiling without an edit; it can be dropped in a later cleanup.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient as createServerSupabase } from '@/utils/supabase/server'

/**
 * Minimal request shape — works for both `Request` (Web) and `NextRequest`.
 * Kept for the public helper's signature; no header is read anymore.
 */
export interface AuthSessionRequest {
  headers: { get(name: string): string | null }
}

/**
 * Internal core, exported for testing. Takes the session client as an arg so
 * unit tests can pass a mock without `vi.mock`-ing module imports.
 */
export async function resolveStormUserId(options: {
  supabaseSession: SupabaseClient
}): Promise<string | null> {
  try {
    const { data, error } = await options.supabaseSession.auth.getUser()
    if (!error && data?.user?.id) {
      return data.user.id
    }
  } catch {
    // Cookie/network problem — treat as unauthenticated.
  }

  return null
}

/**
 * Public helper used by API routes. Constructs the server Supabase client and
 * delegates to `resolveStormUserId`.
 */
export async function getStormUserIdFromRequest(
  _request?: AuthSessionRequest
): Promise<string | null> {
  const supabaseSession = await createServerSupabase()
  return resolveStormUserId({ supabaseSession })
}
