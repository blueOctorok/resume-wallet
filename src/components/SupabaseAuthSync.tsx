'use client'

import { useSupabaseAuthSync } from '@/hooks/use-supabase-auth-sync'

/**
 * Mounts the Supabase-session → auth-store bridge once, globally (in the root
 * layout), so EVERY route has `sessionUserId`/`user` populated — not just `/`.
 *
 * Why this exists: `/admin` (and other standalone routes) render their own shell
 * without going through `page.tsx`. Before this, the sync hook only ran on `/`,
 * so opening `/admin` in a fresh tab left `sessionUserId` undefined and the admin
 * gate spun on "Waiting for sign-in…" forever. Renders nothing.
 */
export default function SupabaseAuthSync() {
  useSupabaseAuthSync()
  return null
}
