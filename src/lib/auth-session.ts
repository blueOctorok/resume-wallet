/**
 * Dual-mode session resolver for Phase 1 migration (T1.4).
 *
 * Returns the Storm `users.id` for the authenticated caller, in this order:
 *
 *   1. **Supabase Auth session** (cookie) — by T1.3 convention, `auth.users.id`
 *      IS `users.id`. So if the cookie resolves, we return `user.id` directly
 *      with NO database lookup. This is the Phase 1 target path.
 *   2. **`x-wallet-address` header** — legacy Alchemy wallet path. Looked up
 *      against `users.wallet_address`. Used by every API route today; will be
 *      deleted after T1.12 cutover.
 *   3. **null** if neither resolves.
 *
 * API routes call this in T1.5–T1.8. The single helper means each route
 * migration is a one-line replace: drop the `x-wallet-address` block, add
 * `const userId = await getStormUserIdFromRequest(request)`. After T1.12 we
 * delete the wallet branch here and this becomes Supabase-only — every
 * migrated route already calls the helper, so no per-route follow-up edit.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient as createServerSupabase } from '@/utils/supabase/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getUserByWallet } from '@/lib/user-by-wallet'

/**
 * Minimal request shape we need — works for both `Request` (Web) and
 * `NextRequest`. We only read one header, so we don't pull in the full
 * NextRequest type and force callers into a specific runtime.
 */
export interface AuthSessionRequest {
  headers: { get(name: string): string | null }
}

/**
 * Internal core, exported for testing. Takes both clients as args so unit
 * tests can pass mocks without `vi.mock`-ing module imports.
 */
export async function resolveStormUserId(
  request: AuthSessionRequest,
  options: {
    supabaseSession: SupabaseClient
    supabaseAdmin: SupabaseClient
  }
): Promise<string | null> {
  // 1. Supabase Auth session (preferred, post-cutover this is the only path).
  try {
    const { data, error } = await options.supabaseSession.auth.getUser()
    if (!error && data?.user?.id) {
      return data.user.id
    }
  } catch {
    // Cookie/network problem — silently fall through to wallet path.
    // Don't log here: it would fire on every legacy wallet-only request and
    // drown the prod logs. The middleware hotfix already logs real failures.
  }

  // 2. Legacy wallet header (Alchemy path). Goes away at T1.12.
  const walletAddress = request.headers.get('x-wallet-address')
  if (walletAddress) {
    const user = await getUserByWallet(options.supabaseAdmin, walletAddress)
    return user?.id ?? null
  }

  return null
}

/**
 * Public helper used by API routes. Constructs the two Supabase clients and
 * delegates to `resolveStormUserId`.
 */
export async function getStormUserIdFromRequest(
  request: AuthSessionRequest
): Promise<string | null> {
  const supabaseSession = await createServerSupabase()
  const supabaseAdmin = await getAdminSupabaseClient()
  return resolveStormUserId(request, { supabaseSession, supabaseAdmin })
}
