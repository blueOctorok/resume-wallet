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
  
  // Role state
  userRole: UserRole
  isRoleLoading: boolean
  showRoleSelection: boolean
  isSettingRole: boolean
  companyName: string | null
  
  // Session state
  isCheckingSession: boolean
  isInitialized: boolean
}

interface AuthActions {
  // User actions
  setUser: (user: AlchemyUser | null) => void
  setWalletAddress: (address: string | null) => void
  
  // Role actions
  setUserRole: (role: UserRole) => void
  setIsRoleLoading: (loading: boolean) => void
  setShowRoleSelection: (show: boolean) => void
  setIsSettingRole: (setting: boolean) => void
  setCompanyName: (name: string | null) => void
  
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
  userRole: null,
  isRoleLoading: true,
  showRoleSelection: false,
  isSettingRole: false,
  companyName: null,
  isCheckingSession: true,
  isInitialized: false,
}

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

      // Role actions
      setUserRole: (role) => set({ userRole: role }),
      setIsRoleLoading: (loading) => set({ isRoleLoading: loading }),
      setShowRoleSelection: (show) => set({ showRoleSelection: show }),
      setIsSettingRole: (setting) => set({ isSettingRole: setting }),
      setCompanyName: (name) => set({ companyName: name }),

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
      // Only persist essential auth state, not loading flags
      partialize: (state) => ({
        walletAddress: state.walletAddress,
        userRole: state.userRole,
        companyName: state.companyName,
      }),
    }
  )
)

// Selector hooks for common patterns
export const useWalletAddress = () => useAuthStore((state) => state.walletAddress)
export const useUserRole = () => useAuthStore((state) => state.userRole)
export const useIsAuthenticated = () => useAuthStore((state) => !!state.user)
