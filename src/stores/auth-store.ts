import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { UserRole } from './types'

/**
 * Auth Store - Manages user authentication and role state
 * 
 * This store handles:
 * - User session data (from Alchemy)
 * - Wallet address (normalized to lowercase)
 * - User role (driver, developer, employer)
 * - Company name (for employers)
 */

interface AlchemyUser {
  address: string
  email?: string
  type?: string
  [key: string]: unknown
}

interface AuthState {
  // User data
  user: AlchemyUser | null
  walletAddress: string | null

  // Supabase Auth session user id (T1.10). Populated live from the Supabase
  // session by use-supabase-auth-sync; null for Alchemy-only sessions. Never
  // persisted — it rehydrates from the Supabase session cookie on load.
  sessionUserId: string | null
  
  // Role state
  userRole: UserRole
  isRoleLoading: boolean
  showRoleSelection: boolean
  isSettingRole: boolean
  companyName: string | null
  
  // Profile setup — shown once for first-time users who have no name set
  showProfileSetup: boolean

  // Referral — captured from ?ref=CODE on first visit, consumed on role selection
  referralCode: string | null

  // Session state
  isCheckingSession: boolean
  isInitialized: boolean
}

interface AuthActions {
  // User actions
  setUser: (user: AlchemyUser | null) => void
  setWalletAddress: (address: string | null) => void
  setSessionUserId: (id: string | null) => void
  
  // Role actions
  setUserRole: (role: UserRole) => void
  setIsRoleLoading: (loading: boolean) => void
  setShowRoleSelection: (show: boolean) => void
  setIsSettingRole: (setting: boolean) => void
  setCompanyName: (name: string | null) => void
  
  // Profile setup actions
  setShowProfileSetup: (show: boolean) => void
  /**
   * Checks whether the user has a name set in their profile.
   * Shows the profile setup modal if not. Safe to call multiple times —
   * uses an internal flag to only run once per session per wallet.
   */
  checkAndShowProfileSetup: (walletAddress: string, userRole: UserRole) => Promise<void>

  // Referral actions
  setReferralCode: (code: string | null) => void

  // Session actions
  setIsCheckingSession: (checking: boolean) => void
  setIsInitialized: (initialized: boolean) => void
  
  // Compound actions
  login: (user: AlchemyUser) => void
  logout: () => void
  setRole: (role: UserRole, companyName?: string) => void
}

const initialState: AuthState = {
  user: null,
  walletAddress: null,
  sessionUserId: null,
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

// Prevents the profile check from running more than once per session per wallet
let profileCheckRanForWallet: string | null = null

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      // User actions
      setUser: (user) => set({ 
        user,
        // Normalize wallet address to lowercase for consistent DB lookups
        walletAddress: user?.address?.toLowerCase() ?? null,
      }),
      
      setWalletAddress: (address) => set({ 
        walletAddress: address?.toLowerCase() ?? null 
      }),

      setSessionUserId: (id) => set({ sessionUserId: id }),

      // Role actions
      setUserRole: (role) => set({ userRole: role }),
      setIsRoleLoading: (loading) => set({ isRoleLoading: loading }),
      setShowRoleSelection: (show) => set({ showRoleSelection: show }),
      setIsSettingRole: (setting) => set({ isSettingRole: setting }),
      setCompanyName: (name) => set({ companyName: name }),

      // Profile setup actions
      setShowProfileSetup: (show) => set({ showProfileSetup: show }),

      checkAndShowProfileSetup: async (walletAddress, userRole) => {
        if (!walletAddress || !userRole || userRole === 'employer') return
        if (profileCheckRanForWallet === walletAddress) return
        profileCheckRanForWallet = walletAddress

        try {
          // Use the hub blocks endpoint which returns user_profiles data
          const res = await fetch('/api/hub/blocks', {
            headers: { 'x-wallet-address': walletAddress },
          })

          if (!res.ok) {
            set({ showProfileSetup: true })
            return
          }

          const data = await res.json()
          const hasName = data.profile?.first_name
          if (!hasName) set({ showProfileSetup: true })
        } catch {
          // Non-blocking — if the check fails, don't interrupt the user's session
        }
      },

      // Referral actions
      setReferralCode: (code) => set({ referralCode: code }),

      // Session actions
      setIsCheckingSession: (checking) => set({ isCheckingSession: checking }),
      setIsInitialized: (initialized) => set({ isInitialized: initialized }),

      // Compound actions
      login: (user) => {
        set({
          user,
          walletAddress: user.address?.toLowerCase() ?? null,
          isCheckingSession: false,
          isInitialized: true,
        })
      },

      logout: () => {
        profileCheckRanForWallet = null
        set({
          ...initialState,
          isCheckingSession: false,
          isInitialized: true,
          isRoleLoading: false,
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
      // Only persist wallet + role. Do not persist companyName — it is synced from profile on load
      // so we don't show stale "My Company" when rehydrating from an old session.
      partialize: (state) => ({
        walletAddress: state.walletAddress,
        userRole: state.userRole,
      }),
    }
  )
)

// Selector hooks for common patterns
export const useWalletAddress = () => useAuthStore((state) => state.walletAddress)
export const useUserRole = () => useAuthStore((state) => state.userRole)
export const useIsAuthenticated = () => useAuthStore((state) => !!state.user)
