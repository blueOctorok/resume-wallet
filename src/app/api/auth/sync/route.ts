import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { ensureUserRow } from '@/lib/user-bootstrap'
import { resolveRoleForNewUser } from '@/lib/resolve-employer-link'

/**
 * Bootstrap the public.users row for a Supabase-authenticated session (T1.11).
 *
 * Called by use-supabase-auth-sync on every fresh session, for EVERY sign-in
 * method (password, OAuth, magic link, password reset). This is the single
 * place ensureUserRow runs, guaranteeing a Supabase user has a public.users row
 * whose id === auth.users.id BEFORE the wallet-keyed client (role fetch, shells)
 * runs — which prevents a duplicate/orphan row keyed on the auth: placeholder.
 *
 * Auth is taken from the session COOKIE (createClient) — never trust a client
 * id. The privileged users upsert runs through the ADMIN client to bypass RLS.
 */
export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const admin = await getAdminSupabaseClient()
    const row = await ensureUserRow(admin, user.id, user.email)

    // Role is DERIVED, never requested. A user with no role yet is resolved from
    // the verified session email: linked to a company (admin-provisioned owner or
    // an invited teammate) means employer, everything else means candidate.
    //
    // Legacy `driver` / `developer` labels are rewritten to `candidate` — those
    // shells are frozen and must not keep anyone on a dead UI.
    let role = (row.role as string | null) ?? null
    if (role === 'driver' || role === 'developer') {
      const { error: coerceError } = await admin
        .from('users')
        .update({ role: 'candidate' })
        .eq('id', row.id)
      if (coerceError) {
        console.error('[AUTH SYNC] Failed to coerce legacy role:', coerceError)
      } else {
        console.log(`[AUTH SYNC] Coerced legacy role "${role}" → candidate for ${row.id}`)
        role = 'candidate'
      }
    } else if (!role) {
      role = await resolveRoleForNewUser(admin, row.id, user.email)
      const { error: roleError } = await admin.from('users').update({ role }).eq('id', row.id)
      if (roleError) {
        // Non-fatal: the user still gets a session, and the next sync retries.
        console.error('[AUTH SYNC] Failed to persist resolved role:', roleError)
      } else {
        console.log(`[AUTH SYNC] Resolved role "${role}" for ${row.id}`)
      }
    }

    return NextResponse.json({
      userId: row.id,
      role,
      // Migrated wallet users keep their real address; new auth-only users get auth:<id>.
      legacyWalletAddress: row.wallet_address ?? null,
    })
  } catch (err) {
    console.error('[AUTH SYNC] ensureUserRow failed:', err)
    return NextResponse.json({ error: 'Failed to bootstrap user' }, { status: 500 })
  }
}
