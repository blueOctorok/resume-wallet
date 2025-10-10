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

interface AlchemyAuthProps {
  onAuthSuccess?: (user: any) => void
  title?: string
  subtitle?: string
  mode?: 'driver' | 'employer' | 'general'
}

export default function AlchemyAuth({
  onAuthSuccess,
  title,
  subtitle,
  mode = 'general',
}: AlchemyAuthProps) {
  const { openAuthModal } = useAuthModal()
  const { isConnected, isInitializing } = useSignerStatus()
  const user = useUser()
  const account = useAccount({ type: 'LightAccount' })
  const { logout } = useLogout()

  const [userInfo, setUserInfo] = useState<any>(null)

  // Use ref to store callback and track the last address we called it for
  const onAuthSuccessRef = useRef(onAuthSuccess)
  const lastCalledAddressRef = useRef<string | null>(null)

  useEffect(() => {
    onAuthSuccessRef.current = onAuthSuccess
  }, [onAuthSuccess])

  // Get mode-specific content
  const getContent = () => {
    switch (mode) {
      case 'driver':
        return {
          title: title || 'Verify Your Resume',
          subtitle:
            subtitle ||
            'Enter your email to get started with professional resume verification',
          welcomeMessage: 'Welcome! Your resume verification account is ready.',
        }
      case 'employer':
        return {
          title: title || 'Access Verified Drivers',
          subtitle:
            subtitle ||
            'Sign in with your work email to access our verified driver database',
          welcomeMessage:
            'Welcome! You can now search and verify driver resumes.',
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

  // Handle authentication success
  useEffect(() => {
    if (isConnected && user && account?.address) {
      const authData = {
        address: account.address,
        email: user.email,
        userId: user.userId,
        method: 'alchemy-smart-wallet',
        isConnected: true,
        chain: 'Base Sepolia', // We know this from our config
        chainId: 84532, // Base Sepolia chain ID
      }

      // Check if this is a new address (first login or address changed)
      const isNewAddress = lastCalledAddressRef.current !== authData.address

      // Update user info state
      setUserInfo((prev) => {
        if (prev?.address === authData.address) {
          return prev // Don't update if it's the same
        }
        return authData
      })

      // Call the callback only for new addresses
      if (isNewAddress && onAuthSuccessRef.current) {
        console.log(
          '🔔 Calling onAuthSuccess callback for new address:',
          authData.address
        )
        onAuthSuccessRef.current(authData)
        lastCalledAddressRef.current = authData.address
      }

      console.log('✅ Alchemy Smart Wallet authentication successful:', {
        address: account.address,
        email: user.email,
        chain: 'Base Sepolia',
      })
    }
  }, [isConnected, user, account]) // Removed onAuthSuccess from dependencies

  // Handle logout
  const handleLogout = async () => {
    try {
      await logout()
      setUserInfo(null)
      lastCalledAddressRef.current = null // Reset so callback works on next login
      console.log('👋 User logged out')
    } catch (error) {
      console.error('❌ Logout error:', error)
    }
  }

  // Loading state
  if (isInitializing) {
    return (
      <div className='relative bg-brand-sage-light/20 backdrop-blur-xl rounded-3xl shadow-2xl border border-brand-mint/30 p-8'>
        {/* Inner shadow for depth */}
        <div className='absolute inset-0 rounded-3xl shadow-[inset_0_2px_20px_rgba(0,0,0,0.3)] pointer-events-none' />

        {/* Outer glow */}
        <div className='absolute -inset-[1px] rounded-3xl bg-gradient-to-b from-brand-mint/20 to-transparent opacity-50 blur-sm -z-10' />

        <div className='relative text-center'>
          <div className='animate-spin rounded-full h-10 w-10 border-b-2 border-brand-mint mx-auto mb-4'></div>
          <p className='text-brand-cream/80'>Initializing authentication...</p>
        </div>
      </div>
    )
  }

  // Authenticated state
  if (isConnected && userInfo) {
    return (
      <div className='relative bg-brand-sage-light/20 backdrop-blur-xl rounded-3xl shadow-2xl border border-brand-mint/30 p-6'>
        {/* Inner shadow for depth */}
        <div className='absolute inset-0 rounded-3xl shadow-[inset_0_2px_20px_rgba(0,0,0,0.3)] pointer-events-none' />

        {/* Outer glow */}
        <div className='absolute -inset-[1px] rounded-3xl bg-gradient-to-b from-brand-mint/20 to-transparent opacity-50 blur-sm -z-10' />

        <div className='relative'>
          <div className='text-center mb-6'>
            <div className='w-16 h-16 bg-brand-mint/30 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg'>
              <svg
                className='w-8 h-8 text-brand-cream drop-shadow-sm'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M5 13l4 4L19 7'
                />
              </svg>
            </div>
            <h2 className='text-xl font-semibold text-brand-cream mb-2'>
              {content.welcomeMessage}
            </h2>
          </div>

          <div className='space-y-4'>
            {/* User Info */}
            <div className='bg-brand-sage/30 backdrop-blur-sm rounded-2xl p-4 border border-brand-mint/20 shadow-lg'>
              <div className='space-y-3 text-sm'>
                {userInfo.email && (
                  <div className='flex justify-between items-center'>
                    <span className='font-medium text-brand-cream/70'>
                      Email:
                    </span>
                    <span className='text-brand-cream'>{userInfo.email}</span>
                  </div>
                )}
                <div className='flex justify-between items-center'>
                  <span className='font-medium text-brand-cream/70'>
                    Wallet:
                  </span>
                  <span className='text-brand-cream font-mono text-xs'>
                    {userInfo.address?.slice(0, 8)}...
                    {userInfo.address?.slice(-6)}
                  </span>
                </div>
                <div className='flex justify-between items-center'>
                  <span className='font-medium text-brand-cream/70'>
                    Network:
                  </span>
                  <span className='text-brand-cream'>{userInfo.chain}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className='flex gap-3'>
              <button
                onClick={handleLogout}
                className='flex-1 px-4 py-3 text-brand-sage font-medium bg-brand-mint rounded-xl hover:bg-brand-mint/80 transition-all duration-300 shadow-lg hover:shadow-xl'
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Authentication form
  return (
    <div className='relative bg-brand-sage-light/20 backdrop-blur-xl rounded-3xl shadow-2xl border border-brand-mint/30 p-6 sm:p-8'>
      {/* Inner shadow for depth */}
      <div className='absolute inset-0 rounded-3xl shadow-[inset_0_2px_20px_rgba(0,0,0,0.3)] pointer-events-none' />

      {/* Outer glow */}
      <div className='absolute -inset-[1px] rounded-3xl bg-gradient-to-b from-brand-mint/20 to-transparent opacity-50 blur-sm -z-10' />

      <div className='relative'>
        {/* Alchemy AuthCard - handles all the authentication logic */}
        <div>
          <AuthCard />
        </div>

        {/* Additional info for users */}
        <div className='text-center mt-6'>
          <p className='text-xs sm:text-sm text-brand-cream/50 leading-relaxed'>
            By signing in, you agree to our terms of service and privacy policy.
            {mode === 'driver' && ' Resume verification costs $5 USDC.'}
            {mode === 'employer' &&
              ' Driver verification checks cost $2 USDC each.'}
          </p>
        </div>
      </div>
    </div>
  )
}

// Export user info hook for other components
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
    chain: { name: 'Base Sepolia', id: 84532 }, // From our config
  }
}
