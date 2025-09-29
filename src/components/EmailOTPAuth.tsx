'use client'

/**
 * Multi-Method Authentication Component
 *
 * Following Alchemy React documentation for multiple authentication methods
 * - Email + OTP authentication
 * - Passkey authentication (biometric)
 * - Google social authentication
 * - Professional SaaS appearance
 * - Perfect for drivers and employers
 */

import React, { useState, useEffect, useRef } from 'react'
import {
  useAuthenticate,
  useSignerStatus,
  useUser,
  useAccount,
  useLogout,
  AuthCard,
} from '@account-kit/react'
import { AlchemySignerStatus } from '@account-kit/signer'
import { getUSDCBalance } from '@/lib/alchemy-token-api'

// Session persistence constants
const AUTH_STORAGE_KEY = 'resume-wallet-auth'
const SESSION_DURATION = 2 * 60 * 60 * 1000 // 2 hours in milliseconds

interface MultiMethodAuthProps {
  onAuthSuccess?: (user: any) => void
  title?: string
  subtitle?: string
  mode?: 'driver' | 'employer' | 'general'
}

// Session persistence utilities
const saveAuthState = (userData: any) => {
  try {
    const authState = {
      ...userData,
      timestamp: Date.now(),
      expiresAt: Date.now() + SESSION_DURATION,
    }
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authState))
    console.log('💾 Auth state saved to localStorage')
  } catch (error) {
    console.error('❌ Failed to save auth state:', error)
  }
}

const getAuthState = () => {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!stored) return null

    const authState = JSON.parse(stored)
    const now = Date.now()

    // Check if session has expired
    if (now > authState.expiresAt) {
      localStorage.removeItem(AUTH_STORAGE_KEY)
      console.log('⏰ Session expired, clearing localStorage')
      return null
    }

    // Check if session is close to expiring (5 minutes warning)
    const timeUntilExpiry = authState.expiresAt - now
    const fiveMinutes = 5 * 60 * 1000
    if (timeUntilExpiry < fiveMinutes && timeUntilExpiry > 0) {
      console.log('⚠️ Session expires in less than 5 minutes')
    }

    console.log('✅ Valid session found in localStorage')
    return authState
  } catch (error) {
    console.error('❌ Failed to get auth state:', error)
    localStorage.removeItem(AUTH_STORAGE_KEY)
    return null
  }
}

const clearAuthState = () => {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY)
    console.log('🗑️ Auth state cleared from localStorage')
  } catch (error) {
    console.error('❌ Failed to clear auth state:', error)
  }
}

export default function MultiMethodAuth({
  onAuthSuccess,
  title = 'Sign In',
  subtitle = 'Choose your preferred sign-in method',
  mode = 'general',
}: MultiMethodAuthProps) {
  const [usdcBalance, setUsdcBalance] = useState<string>('0.00')
  const [balanceLoading, setBalanceLoading] = useState(false)
  const [sessionExpiry, setSessionExpiry] = useState<number | null>(null)
  const [showSessionWarning, setShowSessionWarning] = useState(false)
  const authSuccessCalledRef = useRef(false) // Track if onAuthSuccess was already called

  const { authenticate } = useAuthenticate()
  const { status, isConnected } = useSignerStatus()
  const user = useUser()
  const account = useAccount({ type: 'LightAccount' })
  const { logout } = useLogout()

  // Check for existing session on component mount
  useEffect(() => {
    const existingSession = getAuthState()
    if (existingSession) {
      setSessionExpiry(existingSession.expiresAt)
      console.log('🔄 Restoring session from localStorage')
    }
  }, [])

  // Monitor session expiry and show warnings
  useEffect(() => {
    if (!sessionExpiry) return

    const checkExpiry = () => {
      const now = Date.now()
      const timeUntilExpiry = sessionExpiry - now
      const fiveMinutes = 5 * 60 * 1000

      if (timeUntilExpiry <= 0) {
        // Session expired
        setShowSessionWarning(false)
        clearAuthState()
        setSessionExpiry(null)
        console.log('⏰ Session expired, user needs to re-authenticate')
      } else if (timeUntilExpiry < fiveMinutes) {
        // Show warning
        setShowSessionWarning(true)
        console.log('⚠️ Session expires in less than 5 minutes')
      } else {
        setShowSessionWarning(false)
      }
    }

    // Check immediately
    checkExpiry()

    // Check every minute
    const interval = setInterval(checkExpiry, 60000)
    return () => clearInterval(interval)
  }, [sessionExpiry])

  // Auto-refresh session to prevent Alchemy timeout
  useEffect(() => {
    if (!isConnected || !user || !account?.address) return

    // Refresh session every 5 minutes to prevent Alchemy timeout
    const refreshInterval = setInterval(
      () => {
        console.log('🔄 Refreshing session to prevent timeout...')
        // Re-save auth state to extend localStorage session
        const authData = {
          address: account.address,
          email: user.email,
          userId: user.userId,
          method: user.authMethod || 'alchemy-auth',
          isConnected: true,
          chain: 'Base Sepolia',
          chainId: 84532,
        }
        saveAuthState(authData)
        setSessionExpiry(Date.now() + SESSION_DURATION)
      },
      5 * 60 * 1000
    ) // Every 5 minutes

    return () => clearInterval(refreshInterval)
  }, [isConnected, user, account?.address])

  // Fetch USDC balance
  const fetchUSDCBalance = async (address: string) => {
    if (!address) return

    setBalanceLoading(true)
    try {
      const result = await getUSDCBalance(address)
      if (result.success) {
        setUsdcBalance(result.balanceFormatted)
      } else {
        console.error('❌ Failed to get USDC balance:', result.error)
        setUsdcBalance('0.00')
      }
    } catch (error) {
      console.error('❌ Error fetching USDC balance:', error)
      setUsdcBalance('0.00')
    } finally {
      setBalanceLoading(false)
    }
  }

  // Handle successful authentication
  useEffect(() => {
    if (
      isConnected &&
      user &&
      account?.address &&
      !authSuccessCalledRef.current
    ) {
      authSuccessCalledRef.current = true // Mark as called to prevent loops

      const authData = {
        address: account.address,
        email: user.email,
        userId: user.userId,
        method: user.authMethod || 'alchemy-auth',
        isConnected: true,
        chain: 'Base Sepolia',
        chainId: 84532,
      }

      // Save session to localStorage
      saveAuthState(authData)
      setSessionExpiry(Date.now() + SESSION_DURATION)

      if (onAuthSuccess) {
        onAuthSuccess(authData)
      }

      console.log('✅ Email OTP authentication successful:', {
        address: account.address,
        email: user.email,
        chain: 'Base Sepolia',
      })

      // Fetch USDC balance when authenticated
      fetchUSDCBalance(account.address)
    }
  }, [isConnected, user?.email, account?.address, onAuthSuccess])

  // Fetch balance when wallet address changes (with debounce)
  useEffect(() => {
    if (account?.address && isConnected) {
      // Debounce the balance fetch to prevent spam
      const timeoutId = setTimeout(() => {
        fetchUSDCBalance(account.address)
      }, 1000) // 1 second delay

      return () => clearTimeout(timeoutId)
    }
  }, [account?.address, isConnected])

  // Note: Email OTP handling is now managed by Alchemy's AuthCard component

  // Handle logout
  const handleLogout = async () => {
    try {
      await logout()
      setUsdcBalance('0.00') // Reset USDC balance
      setBalanceLoading(false) // Reset balance loading state
      setSessionExpiry(null) // Clear session expiry
      setShowSessionWarning(false) // Clear session warning
      authSuccessCalledRef.current = false // Reset auth success flag
      clearAuthState() // Clear localStorage
      console.log('👋 User logged out')
    } catch (error) {
      console.error('❌ Logout error:', error)
    }
  }

  // Get mode-specific content
  const getContent = () => {
    switch (mode) {
      case 'driver':
        return {
          title: 'Driver Application Portal',
          subtitle: 'Sign in to submit your verified resume',
          description: 'Secure, professional resume verification for drivers',
        }
      case 'employer':
        return {
          title: 'Employer Verification Portal',
          subtitle: 'Sign in to verify driver credentials',
          description: 'Trusted resume verification for employers',
        }
      default:
        return {
          title: title,
          subtitle: subtitle,
          description: 'Professional resume verification platform',
        }
    }
  }

  const content = getContent()

  // Show authenticated state
  if (isConnected && user) {
    return (
      <div className='bg-white p-6 rounded-lg shadow-sm border border-gray-200'>
        {/* Session Warning */}
        {showSessionWarning && (
          <div className='bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4'>
            <div className='flex items-center'>
              <span className='text-yellow-400 mr-2'>⏰</span>
              <p className='text-yellow-800 text-sm'>
                Your session expires in less than 5 minutes.
                <button
                  onClick={() => {
                    // Extend session by re-saving current state
                    const authData = {
                      address: account?.address,
                      email: user.email,
                      userId: user.userId,
                      method: user.authMethod || 'alchemy-auth',
                      isConnected: true,
                      chain: 'Base Sepolia',
                      chainId: 84532,
                    }
                    saveAuthState(authData)
                    setSessionExpiry(Date.now() + SESSION_DURATION)
                    setShowSessionWarning(false)
                  }}
                  className='underline ml-1 hover:text-yellow-900'
                >
                  Extend session
                </button>
              </p>
            </div>
          </div>
        )}

        <div className='flex items-center justify-between mb-4'>
          <h3 className='text-lg font-medium text-gray-900'>
            ✅ Authenticated
          </h3>
          <button
            onClick={handleLogout}
            className='text-sm text-gray-500 hover:text-gray-700'
          >
            Sign Out
          </button>
        </div>

        <div className='space-y-3'>
          <div className='bg-green-50 p-4 rounded-lg'>
            <p className='text-green-800 font-medium'>{user.email}</p>
            <p className='text-green-600 text-sm'>
              {account?.address
                ? `${account.address.slice(0, 6)}...${account.address.slice(-4)}`
                : 'Wallet address loading...'}
            </p>
          </div>

          {/* USDC Balance Display */}
          <div className='bg-blue-50 p-4 rounded-lg border border-blue-200'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center space-x-2'>
                <span className='text-blue-600'>💰</span>
                <span className='font-medium text-blue-900'>USDC Balance:</span>
                <span className='font-bold text-blue-900'>
                  {balanceLoading ? (
                    <span className='flex items-center space-x-1'>
                      <div className='animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600'></div>
                      <span>Loading...</span>
                    </span>
                  ) : (
                    `$${usdcBalance}`
                  )}
                </span>
              </div>
              <button
                onClick={() =>
                  account?.address && fetchUSDCBalance(account.address)
                }
                className='text-xs text-blue-600 hover:text-blue-800 underline'
                title='Refresh balance'
                disabled={balanceLoading}
              >
                🔄 Refresh
              </button>
            </div>
            <p className='text-xs text-blue-600 mt-1'>Base Sepolia Testnet</p>
          </div>

          <div className='text-sm text-gray-600'>
            <p>✅ Email verified</p>
            <p>✅ Wallet created automatically</p>
            <p>✅ Ready for transactions</p>
          </div>
        </div>
      </div>
    )
  }

  // Note: OTP verification UI is now handled by Alchemy's AuthCard component

  // Show Alchemy AuthCard with all authentication methods
  return (
    <div className='bg-white p-6 rounded-lg shadow-sm border border-gray-200'>
      <h3 className='text-lg font-medium text-gray-900 mb-2'>
        {content.title}
      </h3>
      <p className='text-gray-600 mb-4'>{content.subtitle}</p>

      {/* Use Alchemy's AuthCard component for proper multi-method authentication */}
      <div className='flex flex-row p-4 bg-white border border-gray-200 rounded-lg'>
        <AuthCard />
      </div>

      {/* Debug info */}
      <div className='mt-4 p-3 bg-gray-50 rounded text-xs'>
        <p className='font-medium'>Debug Info:</p>
        <p>Status: {status}</p>
        <p>Connected: {isConnected ? 'Yes' : 'No'}</p>
        <p>User: {user ? 'Authenticated' : 'Not authenticated'}</p>
      </div>

      <div className='mt-4 text-xs text-gray-500'>
        <p>{content.description}</p>
        <p className='mt-1'>
          ✅ No passwords • ✅ Secure verification • ✅ Professional platform
        </p>
      </div>
    </div>
  )
}

// Export hook for other components to use
export function useMultiMethodAuth() {
  const { isConnected } = useSignerStatus()
  const user = useUser()
  const account = useAccount({ type: 'LightAccount' })

  return {
    isConnected,
    user,
    address: account?.address,
    email: user?.email,
    userId: user?.userId,
    authMethod: user?.authMethod || 'alchemy-auth',
    chain: { name: 'Base Sepolia', id: 84532 },
  }
}

// Keep backward compatibility
export const useEmailOTPAuth = useMultiMethodAuth
