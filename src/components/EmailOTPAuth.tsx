'use client'

/**
 * Email OTP Authentication Component
 *
 * Following Alchemy React documentation for Email OTP authentication
 * - Dead simple email + OTP flow
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
} from '@account-kit/react'
import { AlchemySignerStatus } from '@account-kit/signer'
import { getUSDCBalance } from '@/lib/alchemy-token-api'

interface EmailOTPAuthProps {
  onAuthSuccess?: (user: any) => void
  title?: string
  subtitle?: string
  mode?: 'driver' | 'employer' | 'general'
}

export default function EmailOTPAuth({
  onAuthSuccess,
  title = 'Sign In',
  subtitle = 'Enter your email to get started',
  mode = 'general',
}: EmailOTPAuthProps) {
  const [email, setEmail] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [otpSent, setOtpSent] = useState(false) // Track if OTP was sent
  const [usdcBalance, setUsdcBalance] = useState<string>('0.00')
  const [balanceLoading, setBalanceLoading] = useState(false)
  const authSuccessCalledRef = useRef(false) // Track if onAuthSuccess was already called

  const { authenticate } = useAuthenticate()
  const { status, isConnected } = useSignerStatus()
  const user = useUser()
  const account = useAccount({ type: 'LightAccount' })
  const { logout } = useLogout()

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
        method: 'alchemy-email-otp',
        isConnected: true,
        chain: 'Base Sepolia',
        chainId: 84532,
      }

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

  // Send OTP to email
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    setLoading(true)
    setError('')

    try {
      await authenticate(
        {
          type: 'email',
          emailMode: 'otp',
          email,
        },
        {
          onSuccess: () => {
            console.log('✅ Email OTP flow completed')
            setOtpSent(true) // Mark OTP as sent
            setLoading(false)
          },
          onError: (error) => {
            console.error('❌ Email OTP error:', error)
            setError('Failed to send verification code. Please try again.')
            setLoading(false)
          },
        }
      )
      // Also set OTP sent immediately after authenticate call
      setOtpSent(true)
      setLoading(false)
    } catch (error) {
      console.error('❌ Send code error:', error)
      setError('Failed to send verification code. Please try again.')
      setLoading(false)
    }
  }

  // Verify OTP code
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!otpCode) return

    setLoading(true)
    setError('')

    try {
      await authenticate(
        {
          type: 'otp',
          otpCode,
        },
        {
          onSuccess: () => {
            console.log('✅ OTP verification successful')
            setLoading(false)
          },
          onError: (error) => {
            console.error('❌ OTP verification error:', error)
            setError('Invalid verification code. Please try again.')
            setLoading(false)
          },
        }
      )
    } catch (error) {
      console.error('❌ Verify code error:', error)
      setError('Invalid verification code. Please try again.')
      setLoading(false)
    }
  }

  // Handle logout
  const handleLogout = async () => {
    try {
      await logout()
      setEmail('')
      setOtpCode('')
      setError('')
      setOtpSent(false) // Reset OTP sent state
      setUsdcBalance('0.00') // Reset USDC balance
      setBalanceLoading(false) // Reset balance loading state
      authSuccessCalledRef.current = false // Reset auth success flag
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

  // Show OTP input when waiting for email auth OR when we've sent an OTP
  if (status === AlchemySignerStatus.AWAITING_EMAIL_AUTH || otpSent) {
    return (
      <div className='bg-white p-6 rounded-lg shadow-sm border border-gray-200'>
        <h3 className='text-lg font-medium text-gray-900 mb-4'>
          📧 Check Your Email
        </h3>

        <div className='mb-4'>
          <p className='text-gray-600 mb-2'>
            We sent a 6-digit code to <strong>{email}</strong>
          </p>
          <div className='bg-green-50 p-3 rounded-lg'>
            <p className='text-green-800 text-sm'>
              ✅ Verification code sent! Check your email inbox.
            </p>
          </div>
        </div>

        <form onSubmit={handleVerifyCode} className='space-y-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>
              Verification Code
            </label>
            <input
              type='text'
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              placeholder='123456'
              maxLength={6}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-lg font-mono'
              disabled={loading}
            />
          </div>

          {error && (
            <div className='bg-red-50 p-3 rounded-lg'>
              <p className='text-red-800 text-sm'>{error}</p>
            </div>
          )}

          <button
            type='submit'
            disabled={loading || !otpCode}
            className='w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
          >
            {loading ? 'Verifying...' : 'Verify Code'}
          </button>
        </form>

        <div className='flex gap-2 mt-3'>
          <button
            onClick={() => {
              setEmail('')
              setOtpCode('')
              setError('')
              setOtpSent(false) // Reset OTP sent state
            }}
            className='flex-1 text-sm text-gray-500 hover:text-gray-700'
          >
            ← Use different email
          </button>
          <button
            onClick={() => {
              setOtpCode('')
              setError('')
              handleSendCode({ preventDefault: () => {} } as React.FormEvent)
            }}
            disabled={loading}
            className='flex-1 text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50'
          >
            {loading ? 'Sending...' : 'Resend code'}
          </button>
        </div>
      </div>
    )
  }

  // Show email input form
  return (
    <div className='bg-white p-6 rounded-lg shadow-sm border border-gray-200'>
      <h3 className='text-lg font-medium text-gray-900 mb-2'>
        {content.title}
      </h3>
      <p className='text-gray-600 mb-4'>{content.subtitle}</p>

      <form onSubmit={handleSendCode} className='space-y-4'>
        <div>
          <label className='block text-sm font-medium text-gray-700 mb-2'>
            Email Address
          </label>
          <input
            type='email'
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder='Enter your email address'
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            disabled={loading}
            required
          />
        </div>

        {error && (
          <div className='bg-red-50 p-3 rounded-lg'>
            <p className='text-red-800 text-sm'>{error}</p>
          </div>
        )}

        <button
          type='submit'
          disabled={loading || !email}
          className='w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
        >
          {loading ? 'Sending...' : 'Continue with Email'}
        </button>
      </form>

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
export function useEmailOTPAuth() {
  const { isConnected } = useSignerStatus()
  const user = useUser()
  const account = useAccount({ type: 'LightAccount' })

  return {
    isConnected,
    user,
    address: account?.address,
    email: user?.email,
    userId: user?.userId,
    chain: { name: 'Base Sepolia', id: 84532 },
  }
}
