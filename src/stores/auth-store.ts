import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { UserRole } from './types'

/**
 * Auth Store — Supabase session identity (Phase 1 / D3.4).
 *
 * `sessionUserId` is the Storm `users.id` (same as `auth.users.id`).
 * Legacy `users.wallet_address` remains in the DB for history only — never
 * read as client identity after D3.4.
 */

export interface SessionUser {
  userId: string
  email?: string
  method: 'supabase'
  isConnected: boolean
  [key: string]: unknown
}

interface AuthState {
  user: SessionUser | null
  /** Supabase Auth user id — primary client identity. Never persisted (rehydrates from cookie). */
  sessionUserId: string | null
  /** True once initial Supabase getUser() resolved. Never persisted. */
  supabaseSessionChecked: boolean
  userRole: UserRole
  isRoleLoading: boolean
  showRoleSelection: boolean
  isSettingRole: boolean
  companyName: string | null
  showProfileSetup: boolean
  referralCode: string | null
  isCheckingSession: boolean
  isInitialized: boolean
}

interface AuthActions {
  setUser: (user: SessionUser | null) => void
  setSessionUserId: (id: string | null) => void
  setSupabaseSessionChecked: (checked: boolean) => void
  setUserRole: (role: UserRole) => void
  setIsRoleLoading: (loading: boolean) => void
  setShowRoleSelection: (show: boolean) => void
  setIsSettingRole: (setting: boolean) => void
  setCompanyName: (name: string | null) => void
  setShowProfileSetup: (show: boolean) => void
  checkAndShowProfileSetup: (sessionUserId: string, userRole: UserRole) => Promise<void>
  setReferralCode: (code: string | null) => void
  setIsCheckingSession: (checking: boolean) => void
  setIsInitialized: (initialized: boolean) => void
  login: (user: SessionUser) => void
  logout: () => void
  setRole: (role: UserRole, companyName?: string) => void
}

const initialState: AuthState = {
  user: null,
  sessionUserId: null,
  supabaseSessionChecked: false,
  userRole: null,
  isRoleLoading: true,
  showRoleSelection: false,
  isSettingRole: false,
  companyName: null,
  showProfileSetup: false,
  referralCode: null,
  isCheckingSession: true,
  isInitialized: false,
}

let profileCheckRanForUserId: string | null = null

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      setUser: (user) =>
        set({
          user,
          sessionUserId: user?.userId ?? null,
        }),

      setSessionUserId: (id) => set({ sessionUserId: id }),

      setSupabaseSessionChecked: (checked) => set({ supabaseSessionChecked: checked }),

      setUserRole: (role) => set({ userRole: role }),
      setIsRoleLoading: (loading) => set({ isRoleLoading: loading }),
      setShowRoleSelection: (show) => set({ showRoleSelection: show }),
      setIsSettingRole: (setting) => set({ isSettingRole: setting }),
      setCompanyName: (name) => set({ companyName: name }),

      setShowProfileSetup: (show) => set({ showProfileSetup: show }),

      checkAndShowProfileSetup: async (sessionUserId, userRole) => {
        if (!sessionUserId || !userRole || userRole === 'employer') return
        if (profileCheckRanForUserId === sessionUserId) return
        profileCheckRanForUserId = sessionUserId

        try {
          const res = await fetch('/api/hub/blocks')
          if (!res.ok) {
            set({ showProfileSetup: true })
            return
          }
          const data = await res.json()
          const hasName = data.profile?.first_name
          if (!hasName) set({ showProfileSetup: true })
        } catch {
          // Non-blocking
        }
      },

      setReferralCode: (code) => set({ referralCode: code }),

      setIsCheckingSession: (checking) => set({ isCheckingSession: checking }),
      setIsInitialized: (initialized) => set({ isInitialized: initialized }),

      login: (user) => {
        set({
          user,
          sessionUserId: user.userId,
          isCheckingSession: false,
          isInitialized: true,
        })
      },

      logout: () => {
        profileCheckRanForUserId = null
        set({
          ...initialState,
          isCheckingSession: false,
          isInitialized: true,
          isRoleLoading: false,
          supabaseSessionChecked: true,
        })
      },

      setRole: (role, companyName) => {
        set({
          userRole: role,
          companyName: companyName ?? null,
          isRoleLoading: false,
          showRoleSelection: false,
          isSettingRole: false,
        })
      },
    }),
    {
      name: 'auth-store',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        userRole: state.userRole,
      }),
    }
  )
)

export const useSessionUserId = () => useAuthStore((state) => state.sessionUserId)
export const useUserRole = () => useAuthStore((state) => state.userRole)
export const useIsAuthenticated = () => useAuthStore((state) => !!state.sessionUserId)
