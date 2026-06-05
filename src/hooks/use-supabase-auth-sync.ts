'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useAuthStore } from '@/stores/auth-store'

/**
 * Bridges Supabase Auth session → auth store (D3.4 session-only).
 *
 * Ordering: /api/auth/sync (ensureUserRow) runs once per session before the
 * role fetch, so public.users exists before profile/role APIs run.
 */
export function useSupabaseAuthSync() {
  const setSessionUserId = useAuthStore((s) => s.setSessionUserId)
  const setUser = useAuthStore((s) => s.setUser)
  const setSupabaseSessionChecked = useAuthStore((s) => s.setSupabaseSessionChecked)
  const syncedFor = useRef<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let active = true

    const onSession = async (sessionUserId: string | null, email?: string | null) => {
      if (!active) return

      if (!sessionUserId) {
        syncedFor.current = null
        setSessionUserId(null)
        if (useAuthStore.getState().user?.method === 'supabase') setUser(null)
        return
      }

      setSessionUserId(sessionUserId)

      if (syncedFor.current !== sessionUserId) {
        syncedFor.current = sessionUserId
        try {
          await fetch('/api/auth/sync', { method: 'POST' })
        } catch {
          // Non-fatal — row likely exists
        }
      }

      if (!active) return
      setUser({
        userId: sessionUserId,
        email: email ?? undefined,
        method: 'supabase',
        isConnected: true,
      })
    }

    supabase.auth.getUser().then(({ data }) => {
      onSession(data.user?.id ?? null, data.user?.email)
      if (active) setSupabaseSessionChecked(true)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      onSession(session?.user?.id ?? null, session?.user?.email)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [setSessionUserId, setUser, setSupabaseSessionChecked])
}
