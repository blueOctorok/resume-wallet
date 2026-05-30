import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { ensureUserRow } from '@/lib/user-bootstrap'

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
    return NextResponse.json({ userId: row.id, role: row.role ?? null })
  } catch (err) {
    console.error('[AUTH SYNC] ensureUserRow failed:', err)
    return NextResponse.json({ error: 'Failed to bootstrap user' }, { status: 500 })
  }
}
