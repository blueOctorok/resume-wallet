import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Remove the Supabase Auth user (and revoke their sessions/refresh tokens).
 *
 * Deleting only `public.users` left `auth.users` + browser cookies intact.
 * On the next visit, getUser() still succeeded and ensureUserRow quietly
 * recreated the app row — so a "deleted" tester came back asking for a name.
 *
 * Call this AFTER the public.users row is gone (or when you are sure you
 * want the identity gone). Auth delete is best-effort: a missing auth row
 * (already wiped) is success, not a hard failure.
 */
export async function deleteAuthUser(
  supabase: SupabaseClient,
  authUserId: string
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.auth.admin.deleteUser(authUserId)

  if (!error) return { ok: true }

  // Already gone — treat as done. Message text varies by GoTrue version.
  const msg = error.message?.toLowerCase() ?? ''
  if (
    error.status === 404 ||
    msg.includes('not found') ||
    msg.includes('user not found')
  ) {
    return { ok: true }
  }

  console.error(`[DELETE AUTH USER] Failed for ${authUserId}:`, error.message)
  return { ok: false, error: error.message }
}
