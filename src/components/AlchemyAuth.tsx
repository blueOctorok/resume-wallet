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

import { useState, useEffect } from 'react'
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

      setUserInfo(authData)

      if (onAuthSuccess) {
        onAuthSuccess(authData)
      }

      console.log('✅ Alchemy Smart Wallet authentication successful:', {
        address: account.address,
        email: user.email,
        chain: 'Base Sepolia',
      })
    }
  }, [isConnected, user, account, onAuthSuccess])

  // Handle logout
  const handleLogout = async () => {
    try {
      await logout()
      setUserInfo(null)
      console.log('👋 User logged out')
    } catch (error) {
      console.error('❌ Logout error:', error)
    }
  }

  // Loading state
  if (isInitializing) {
    return (
      <div className='flex items-center justify-center p-8'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4'></div>
          <p className='text-gray-600'>Initializing authentication...</p>
        </div>
      </div>
    )
  }

  // Authenticated state
  if (isConnected && userInfo) {
    return (
      <div className='bg-white rounded-lg shadow-lg p-6 max-w-md mx-auto'>
        <div className='text-center mb-6'>
          <div className='w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4'>
            <svg
              className='w-8 h-8 text-green-600'
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
          <h2 className='text-xl font-bold text-gray-900 mb-2'>
            {content.welcomeMessage}
          </h2>
        </div>

        <div className='space-y-4'>
          {/* User Info */}
          <div className='bg-gray-50 rounded-lg p-4'>
            <div className='space-y-2 text-sm'>
              {userInfo.email && (
                <div>
                  <span className='font-medium text-gray-700'>Email:</span>
                  <span className='ml-2 text-gray-900'>{userInfo.email}</span>
                </div>
              )}
              <div>
                <span className='font-medium text-gray-700'>Wallet:</span>
                <span className='ml-2 text-gray-900 font-mono text-xs'>
                  {userInfo.address?.slice(0, 8)}...
                  {userInfo.address?.slice(-6)}
                </span>
              </div>
              <div>
                <span className='font-medium text-gray-700'>Network:</span>
                <span className='ml-2 text-gray-900'>{userInfo.chain}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className='flex gap-3'>
            <button
              onClick={handleLogout}
              className='flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors'
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Authentication form
  return (
    <div className='max-w-md mx-auto'>
      <div className='text-center mb-6'>
        <h1 className='text-2xl font-bold text-gray-900 mb-2'>
          {content.title}
        </h1>
        <p className='text-gray-600'>{content.subtitle}</p>
      </div>

      {/* Alchemy AuthCard - handles all the authentication logic */}
      <AuthCard />

      {/* Additional info for users */}
      <div className='mt-6 text-center'>
        <p className='text-xs text-gray-500'>
          By signing in, you agree to our terms of service and privacy policy.
          {mode === 'driver' && ' Resume verification costs $5 USDC.'}
          {mode === 'employer' &&
            ' Driver verification checks cost $2 USDC each.'}
        </p>
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
