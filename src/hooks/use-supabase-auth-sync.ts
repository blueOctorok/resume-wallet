'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useAuthStore } from '@/stores/auth-store'
import type { UserRole } from '@/stores/types'

/**
 * Bridges Supabase Auth session → auth store (D3.4 session-only).
 *
 * Ordering: /api/auth/sync (ensureUserRow + role resolve) runs once per session
 * and writes role into the store BEFORE page.tsx's profile fetch finishes —
 * so we never briefly mount a shell based on a null role.
 *
 * If Auth deleted the user (admin wipe) but the browser still has cookies,
 * getUser() fails — we signOut() so local storage/cookies clear instead of
 * leaving a half-logged-in shell that keeps asking for a name.
 */
export function useSupabaseAuthSync() {
  const setSessionUserId = useAuthStore((s) => s.setSessionUserId)
  const setUser = useAuthStore((s) => s.setUser)
  const setUserRole = useAuthStore((s) => s.setUserRole)
  const setSupabaseSessionChecked = useAuthStore((s) => s.setSupabaseSessionChecked)
  const syncedFor = useRef<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let active = true

    const clearLocalSession = async (wipeCookies: boolean) => {
      syncedFor.current = null
      setSessionUserId(null)
      setUserRole(null)
      if (useAuthStore.getState().user?.method === 'supabase') setUser(null)
      // Only wipe storage when we know Auth rejected a stale session. Calling
      // signOut on every anonymous page load is unnecessary and can re-enter
      // onAuthStateChange → onSession(null) in a loop.
      if (wipeCookies) {
        try {
          await supabase.auth.signOut({ scope: 'local' })
        } catch {
          // ignore — already signed out
        }
      }
    }

    const applyRoleFromSync = (role: unknown) => {
      const valid: UserRole =
        role === 'driver' ||
        role === 'employer' ||
        role === 'developer' ||
        role === 'candidate'
          ? role
          : null
      if (valid) setUserRole(valid)
    }

    const onSession = async (sessionUserId: string | null, email?: string | null) => {
      if (!active) return

      if (!sessionUserId) {
        await clearLocalSession(false)
        return
      }

      setSessionUserId(sessionUserId)

      if (syncedFor.current !== sessionUserId) {
        syncedFor.current = sessionUserId
        try {
          const res = await fetch('/api/auth/sync', { method: 'POST' })
          // 401 = cookie looked valid locally but Auth rejected it (deleted user)
          if (res.status === 401) {
            await clearLocalSession(true)
            return
          }
          if (res.ok) {
            const data = (await res.json()) as { role?: string | null }
            applyRoleFromSync(data.role)
          }
        } catch {
          // Non-fatal — page.tsx profile fetch is a backup
        }
      }

      if (!active) return
      if (!useAuthStore.getState().sessionUserId) return

      setUser({
        userId: sessionUserId,
        email: email ?? undefined,
        method: 'supabase',
        isConnected: true,
      })
    }

    supabase.auth.getUser().then(async ({ data, error }) => {
      if (error || !data.user) {
        // Stale cookies after admin deleted auth.users — wipe local session
        const { data: sessionData } = await supabase.auth.getSession()
        await clearLocalSession(Boolean(sessionData.session))
      } else {
        await onSession(data.user.id, data.user.email)
      }
      if (active) setSupabaseSessionChecked(true)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      void onSession(session?.user?.id ?? null, session?.user?.email)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [setSessionUserId, setUser, setUserRole, setSupabaseSessionChecked])
}
