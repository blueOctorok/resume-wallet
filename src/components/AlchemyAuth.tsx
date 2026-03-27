'use client'

/**
 * Alchemy Smart Wallets Authentication
 *
 * Professional SaaS-first authentication for resume verification platform
 * - Dead simple email + OTP login
 * - Automatic wallet creation (users don't know it's crypto)
 * - Professional business appearance
 * - Perfect for drivers and employers
 */

import { useState, useEffect, useRef } from 'react'
import {
  useAuthModal,
  useSignerStatus,
  useUser,
  AuthCard,
  useAccount,
  useLogout,
} from '@account-kit/react'
import { useTheme } from '@/contexts/ThemeContext'
import LoadingScreen from '@/components/LoadingScreen'

const checkWebCryptoSupport = () => {
  if (typeof window === 'undefined') return true
  
  try {
    const crypto = window.crypto || (window as any).webkitCrypto
    if (!crypto || !crypto.subtle) {
      return false
    }
    return true
  } catch (e) {
    return false
  }
}

interface AlchemyAuthProps {
  onAuthSuccess?: (user: any) => void
  onLogoutSuccess?: () => void
  title?: string
  subtitle?: string
  mode?: 'driver' | 'employer' | 'general'
}

export default function AlchemyAuth({
  onAuthSuccess,
  onLogoutSuccess,
  title,
  subtitle,
  mode = 'general',
}: AlchemyAuthProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const { openAuthModal } = useAuthModal()
  const { isConnected, isInitializing } = useSignerStatus()
  const user = useUser()
  const account = useAccount({ type: 'LightAccount' })
  const { logout } = useLogout()

  const [userInfo, setUserInfo] = useState<any>(null)
  const [cryptoError, setCryptoError] = useState<string | null>(null)

  const onAuthSuccessRef = useRef(onAuthSuccess)
  const lastCalledAddressRef = useRef<string | null>(null)
  const logoutStateRef = useRef<{ timestamp: number; address: string } | null>(null)

  useEffect(() => {
    const hasCryptoError = sessionStorage.getItem('crypto-error')
    if (hasCryptoError) {
      setCryptoError(
        'Authentication error detected. This is a known issue on some mobile browsers. Please try using Google sign-in instead, or refresh the page.'
      )
      sessionStorage.removeItem('crypto-error')
    }

    const hasCryptoSupport = checkWebCryptoSupport()
    if (!hasCryptoSupport) {
      setCryptoError(
        'Your browser may not fully support secure authentication. Please try using a different browser or updating your current browser.'
      )
    }

    const handleError = (event: ErrorEvent) => {
      if (
        event.message?.includes('crv') ||
        (event.message?.includes('invalid') && event.message?.includes('crypto')) ||
        event.message?.includes('g:invalid')
      ) {
        console.error('🔐 Crypto error detected:', event.message)
        setCryptoError(
          'Authentication error detected. This is a known issue on some mobile browsers. Please try using Google sign-in instead, or refresh the page.'
        )
      }
    }

    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason?.message || event.reason?.toString() || ''
      if (
        reason.includes('crv') ||
        (reason.includes('invalid') && reason.includes('crypto')) ||
        reason.includes('g:invalid')
      ) {
        console.error('🔐 Crypto promise rejection detected:', reason)
        setCryptoError(
          'Authentication error detected. This is a known issue on some mobile browsers. Please try using Google sign-in instead, or refresh the page.'
        )
      }
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleRejection)
    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleRejection)
    }
  }, [])

  useEffect(() => {
    console.log('🔧 [AUTH] onAuthSuccess callback ref updated:', { hasCallback: !!onAuthSuccess })
    onAuthSuccessRef.current = onAuthSuccess
  }, [onAuthSuccess])

  const getContent = () => {
    switch (mode) {
      case 'driver':
        return {
          title: title || 'Verify Your Resume',
          subtitle: subtitle || 'Enter your email to get started with professional resume verification',
          welcomeMessage: 'Welcome! Your resume verification account is ready.',
        }
      case 'employer':
        return {
          title: title || 'Access Verified Drivers',
          subtitle: subtitle || 'Sign in with your work email to access our verified driver database',
          welcomeMessage: 'Welcome! You can now search and verify driver resumes.',
        }
      default:
        return {
          title: title || 'Resume Verification Platform',
          subtitle: subtitle || 'Enter your email to access the platform',
          welcomeMessage: 'Welcome to the resume verification platform!',
        }
    }
  }

  const content = getContent()

  useEffect(() => {
    console.log('🔍 [AUTH] useEffect triggered - checking connection status:', {
      isConnected,
      hasUser: !!user,
      hasAccount: !!account?.address,
      lastCalledAddress: lastCalledAddressRef.current,
    })

    if (isConnected && user && account?.address) {
      const authData = {
        address: account.address,
        email: user.email,
        userId: user.userId,
        method: 'alchemy-smart-wallet',
        isConnected: true,
        chain: 'Base Sepolia',
        chainId: 84532,
      }

      const isNewAddress = lastCalledAddressRef.current !== authData.address
      const COOLDOWN_MS = 3000
      const logoutState = logoutStateRef.current
      const isSameAddressAsLogout = logoutState?.address === authData.address
      const timeSinceLogout = logoutState ? Date.now() - logoutState.timestamp : Infinity
      const isStaleReconnect = isSameAddressAsLogout && timeSinceLogout < COOLDOWN_MS

      if (isStaleReconnect) {
        console.log('⏸️ [AUTH] Ignoring stale session reconnect (logged out', timeSinceLogout, 'ms ago)')
        return
      }

      logoutStateRef.current = null

      console.log('📋 [AUTH] Auth data prepared:', {
        address: authData.address,
        email: authData.email,
        isNewAddress,
        hasCallback: !!onAuthSuccessRef.current,
      })

      setUserInfo((prev) => {
        if (prev?.address === authData.address) {
          console.log('⏭️ [AUTH] Same address, skipping userInfo update')
          return prev
        }
        console.log('🔄 [AUTH] Updating userInfo state')
        return authData
      })

      if (isNewAddress && onAuthSuccessRef.current) {
        console.log('🔔 [AUTH] Calling onAuthSuccess callback for new address:', authData.address)
        onAuthSuccessRef.current(authData)
        lastCalledAddressRef.current = authData.address
      } else if (!isNewAddress) {
        console.log('⏭️ [AUTH] Address already processed, skipping callback')
      } else if (!onAuthSuccessRef.current) {
        console.log('⚠️ [AUTH] No callback provided')
      }

      console.log('✅ [AUTH] Alchemy Smart Wallet authentication successful:', {
        address: account.address,
        email: user.email,
        chain: 'Base Sepolia',
      })
    }
  }, [isConnected, user, account])

  const handleLogout = async () => {
    try {
      if (lastCalledAddressRef.current) {
        logoutStateRef.current = {
          timestamp: Date.now(),
          address: lastCalledAddressRef.current,
        }
      }
      await logout()
      setUserInfo(null)
      lastCalledAddressRef.current = null
      if (onLogoutSuccess) {
        onLogoutSuccess()
      }
      console.log('👋 User logged out')
    } catch (error) {
      console.error('❌ Logout error:', error)
    }
  }

  useEffect(() => {
    if (onLogoutSuccess && handleLogout) {
      ;(window as any).__alchemyLogout = handleLogout
    }
  }, [onLogoutSuccess])

  const cardClass = isDark
    ? 'bg-gray-800/50 border-gray-700'
    : 'bg-white/90 border-gray-200'

  if (isInitializing) {
    return (
      <div className={`relative backdrop-blur-xl rounded-3xl shadow-2xl border p-8 ${cardClass}`}>
        <LoadingScreen message='Initializing authentication…' fullScreen={false} compact />
      </div>
    )
  }

  if (isConnected && userInfo) {
    return (
      <div className={`relative backdrop-blur-xl rounded-3xl shadow-2xl border p-6 ${cardClass}`}>
        <div className='relative'>
          <div className='text-center mb-6'>
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg ${
              isDark ? 'bg-teal-500/20' : 'bg-teal-100'
            }`}>
              <svg className={`w-8 h-8 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M5 13l4 4L19 7' />
              </svg>
            </div>
            <h2 className={`text-xl font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-800'}`}>
              {content.welcomeMessage}
            </h2>
          </div>

          <div className='space-y-4'>
            <div className={`rounded-2xl p-4 border ${
              isDark ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'
            }`}>
              <div className='space-y-3 text-sm'>
                {userInfo.email && (
                  <div className='flex justify-between items-center'>
                    <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>Email:</span>
                    <span className={isDark ? 'text-white' : 'text-gray-900'}>{userInfo.email}</span>
                  </div>
                )}
                <div className='flex justify-between items-center'>
                  <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>Wallet:</span>
                  <span className={`font-mono text-xs ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {userInfo.address?.slice(0, 8)}...{userInfo.address?.slice(-6)}
                  </span>
                </div>
                <div className='flex justify-between items-center'>
                  <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>Network:</span>
                  <span className={isDark ? 'text-white' : 'text-gray-900'}>{userInfo.chain}</span>
                </div>
              </div>
            </div>

            <div className='flex gap-3'>
              <button
                onClick={handleLogout}
                className='flex-1 px-4 py-3 font-medium rounded-xl transition-all duration-300 bg-teal-600 text-white hover:bg-teal-500'
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative backdrop-blur-xl rounded-3xl shadow-2xl border p-6 sm:p-8 ${cardClass}`}>
      <div className='relative overflow-hidden'>
        {cryptoError && (
          <div className='mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg'>
            <div className='flex items-start'>
              <span className='text-yellow-600 dark:text-yellow-400 mr-2'>⚠️</span>
              <div className='flex-1'>
                <p className='text-sm text-yellow-800 dark:text-yellow-200 font-medium mb-1'>
                  Authentication Issue
                </p>
                <p className='text-xs text-yellow-700 dark:text-yellow-300'>
                  {cryptoError}
                </p>
                <button
                  onClick={() => {
                    setCryptoError(null)
                    window.location.reload()
                  }}
                  className='mt-2 text-xs text-yellow-800 dark:text-yellow-200 underline hover:text-yellow-900 dark:hover:text-yellow-100'
                >
                  Refresh Page
                </button>
              </div>
            </div>
          </div>
        )}

        <div 
          className='overflow-hidden'
          style={{
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
            minHeight: '200px',
          }}
        >
          <AuthCard />
        </div>
      </div>
    </div>
  )
}

export function useAlchemyAuth() {
  const { isConnected, isInitializing } = useSignerStatus()
  const user = useUser()
  const account = useAccount({ type: 'LightAccount' })

  return {
    isConnected,
    isInitializing,
    user,
    address: account?.address,
    email: user?.email,
    userId: user?.userId,
    chain: { name: 'Base Sepolia', id: 84532 },
  }
}
