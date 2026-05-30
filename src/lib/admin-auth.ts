/**
 * Admin Authentication Helper
 *
 * Email-based admin access control (T1.8-admin, post-Supabase-auth cutover).
 * Only emails listed in the ADMIN_EMAILS env variable can access admin features.
 *
 * Identity comes from the Supabase Auth session cookie — NOT a request header —
 * so admin works for every login (email/Google/magic-link) regardless of whether
 * the account ever had a wallet. The legacy ADMIN_WALLETS / x-wallet-address gate
 * was removed at the cutover: new email signups never carry a real wallet, so a
 * wallet-keyed allowlist could never admit a freshly-created admin.
 */

import { NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/utils/supabase/server'

/**
 * Check if an email is in the admin whitelist.
 * Used both to gate the requester (requireAdmin) and to flag user rows in the
 * admin console (e.g. "this row is an admin" badge).
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false

  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0)

  if (adminEmails.length === 0) {
    console.warn('[ADMIN AUTH] No ADMIN_EMAILS configured in environment')
    return false
  }

  return adminEmails.includes(email.toLowerCase())
}

export interface AdminAuthResult {
  authorized: boolean
  /** Storm users.id of the caller (= auth.users.id by the T1.3 convention). */
  userId: string | null
  /** Authenticated email of the caller (used for audit logging). */
  email: string | null
  error?: NextResponse
}

/**
 * API route helper — verifies admin access from the Supabase session cookie.
 * Returns an error response (401/403) when the caller is not an authorized admin.
 *
 * The optional `_request` arg is accepted but ignored: identity is resolved from
 * the cookie-backed server client, not the request. It is kept so the ~33 existing
 * `requireAdmin(request)` callers only need to add `await` — no signature edits.
 */
export async function requireAdmin(_request?: unknown): Promise<AdminAuthResult> {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase.auth.getUser()
  const user = error ? null : data?.user ?? null

  if (!user) {
    return {
      authorized: false,
      userId: null,
      email: null,
      error: NextResponse.json(
        { error: 'Authentication required. Please sign in.' },
        { status: 401 }
      ),
    }
  }

  const email = user.email ?? null

  if (!isAdminEmail(email)) {
    console.warn(`[ADMIN AUTH] Unauthorized admin attempt from: ${email ?? user.id}`)
    return {
      authorized: false,
      userId: user.id,
      email,
      error: NextResponse.json(
        { error: 'Admin access required. Your account is not authorized.' },
        { status: 403 }
      ),
    }
  }

  return { authorized: true, userId: user.id, email }
}
