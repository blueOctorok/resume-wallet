'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useAuthStore } from '@/stores/auth-store'
import { authOnlyWalletPlaceholder } from '@/lib/user-bootstrap'

/**
 * Bridges a Supabase Auth session into the wallet-shaped auth store (T1.11).
 *
 * Storm's client is still wallet-keyed (every shell + fetch reads walletAddress).
 * Rather than rewrite that whole surface now, a Supabase user is given the
 * `auth:<userId>` placeholder wallet — the exact value user-bootstrap writes to
 * users.wallet_address. The wallet-keyed client keeps working unchanged, while
 * the SERVER resolves real identity from the session cookie via
 * getStormUserIdFromRequest. This is the deliberate dual-mode bridge; it is
 * removed at the T1.12 cutover when the client goes fully session-based.
 *
 * Ordering matters: /api/auth/sync (ensureUserRow) MUST complete before we set
 * the placeholder wallet, so the public.users row (id === auth.users.id) exists
 * before the wallet-keyed role fetch fires — otherwise getOrCreateUserByWallet
 * would mint a second, orphaned row.
 */
export function useSupabaseAuthSync() {
  const setSessionUserId = useAuthStore((s) => s.setSessionUserId)
  const setUser = useAuthStore((s) => s.setUser)
  const setSupabaseSessionChecked = useAuthStore((s) => s.setSupabaseSessionChecked)
  // Guards the bootstrap fetch to once per session id (avoids re-syncing on
  // every onAuthStateChange tick, e.g. token refresh).
  const syncedFor = useRef<string | null>(null)
  const resolvedWallet = useRef<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let active = true

    const onSession = async (sessionUserId: string | null, email?: string | null) => {
      if (!active) return

      if (!sessionUserId) {
        // Supabase signed out. Only clear the store if a Supabase user owns it —
        // never clobber a live Alchemy session during dual-mode.
        syncedFor.current = null
        resolvedWallet.current = null
        setSessionUserId(null)
        if (useAuthStore.getState().user?.method === 'supabase') setUser(null)
        return
      }

      setSessionUserId(sessionUserId)

      // A live Alchemy login wins; don't let a stale Supabase session override it.
      const current = useAuthStore.getState().user
      if (current && current.method !== 'supabase') return

      let walletForClient =
        resolvedWallet.current ?? authOnlyWalletPlaceholder(sessionUserId)

      // Bootstrap public.users exactly once per session, before any wallet-keyed fetch.
      if (syncedFor.current !== sessionUserId) {
        syncedFor.current = sessionUserId
        resolvedWallet.current = null
        try {
          const res = await fetch('/api/auth/sync', { method: 'POST' })
          if (res.ok) {
            const data = (await res.json()) as { walletAddress?: string | null }
            // Prefer the DB wallet so migrated Alchemy users keep working client-side
            // (role fetch, x-wallet-address headers) until T1.12 goes fully session-based.
            if (data.walletAddress) {
              resolvedWallet.current = data.walletAddress
              walletForClient = data.walletAddress
            }
          }
        } catch {
          // Non-fatal: row likely already exists; the role fetch surfaces real errors.
        }
      }

      if (!active) return
      setUser({
        address: walletForClient,
        email: email ?? undefined,
        method: 'supabase',
        userId: sessionUserId,
        isConnected: true,
      })
    }

    // Initial hydrate (covers post-OAuth/magic-link redirect landings).
    // onSession sets sessionUserId synchronously before any await, so marking
    // the check done right after means page.tsx sees the correct auth state
    // before it decides whether to redirect a "guest" to /sign-in.
    supabase.auth.getUser().then(({ data }) => {
      onSession(data.user?.id ?? null, data.user?.email)
      if (active) setSupabaseSessionChecked(true)
    })

    // Live updates (covers client-side password sign-in + sign-out).
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      onSession(session?.user?.id ?? null, session?.user?.email)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [setSessionUserId, setUser, setSupabaseSessionChecked])
}
