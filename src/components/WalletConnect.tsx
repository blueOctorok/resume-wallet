'use client'

import {
  useDynamicContext,
  useIsLoggedIn,
  useConnectWithOtp,
  getAuthToken,
  useDynamicWaas,
} from '@dynamic-labs/sdk-react-core'
import { ChainEnum } from '@dynamic-labs/sdk-api-core'
import { useState, FormEventHandler, useEffect } from 'react'
import { WalletIcon, UserIcon } from '@heroicons/react/24/outline'

export function WalletConnect() {
  const {
    user,
    primaryWallet,
    setShowAuthFlow,
    sdkHasLoaded,
    userWithMissingInfo,
    handleLogOut,
  } = useDynamicContext()
  const isLoggedIn = useIsLoggedIn()
  const { connectWithEmail, verifyOneTimePassword } = useConnectWithOtp()
  const { createWalletAccount, getWaasWallets } = useDynamicWaas()
  const [isConnecting, setIsConnecting] = useState(false)
  const [showOtpForm, setShowOtpForm] = useState(false)
  const [jwtToken, setJwtToken] = useState<string | null>(null)
  const [isCreatingWallet, setIsCreatingWallet] = useState(false)

  // Get JWT token using the proper utility function as per documentation
  useEffect(() => {
    const token = getAuthToken()
    if (token) {
      setJwtToken(token)
      console.log('✅ JWT token retrieved:', token)
    } else {
      setJwtToken(null)
      console.log('❌ No JWT token found')
    }
  }, [isLoggedIn, user])

  const onSubmitEmailHandler: FormEventHandler<HTMLFormElement> = async (
    event
  ) => {
    event.preventDefault()
    setIsConnecting(true)

    try {
      const email = event.currentTarget.email.value
      await connectWithEmail(email)
      setShowOtpForm(true)
    } catch (error) {
      console.error('Failed to connect with email:', error)
    } finally {
      setIsConnecting(false)
    }
  }

  const onSubmitOtpHandler: FormEventHandler<HTMLFormElement> = async (
    event
  ) => {
    event.preventDefault()
    setIsConnecting(true)

    try {
      const otp = event.currentTarget.otp.value
      await verifyOneTimePassword(otp)
    } catch (error) {
      console.error('Failed to verify OTP:', error)
    } finally {
      setIsConnecting(false)
    }
  }

  const onCreateWalletHandler = async () => {
    setIsCreatingWallet(true)
    try {
      const waasWallets = await getWaasWallets()
      if (waasWallets.length === 0) {
        await createWalletAccount([ChainEnum.Evm])
        console.log('✅ Embedded wallet created successfully')
      } else {
        console.log('✅ User already has embedded wallets:', waasWallets)
      }
    } catch (error) {
      console.error('❌ Failed to create embedded wallet:', error)
    } finally {
      setIsCreatingWallet(false)
    }
  }

  const handleConnect = async () => {
    setIsConnecting(true)
    try {
      setShowAuthFlow(true)
    } catch (error) {
      console.error('Failed to connect:', error)
    } finally {
      setIsConnecting(false)
    }
  }

  const handleDisconnectWallet = async () => {
    try {
      // Try Dynamic's proper logout method first
      if (handleLogOut && typeof handleLogOut === 'function') {
        await handleLogOut()
      } else {
        // Fallback: Clear localStorage and reload
        if (typeof window !== 'undefined') {
          localStorage.removeItem('dynamic_authentication_token')
          localStorage.removeItem('dynamic_min_authentication_token')
          window.location.reload()
        }
      }
    } catch (error) {
      console.error('Failed to disconnect:', error)
      // Fallback on error
      if (typeof window !== 'undefined') {
        localStorage.removeItem('dynamic_authentication_token')
        localStorage.removeItem('dynamic_min_authentication_token')
        window.location.reload()
      }
    }
  }

  // Wait for SDK to load
  if (!sdkHasLoaded) {
    return (
      <div className='p-4 bg-gray-50 border border-gray-200 rounded-lg'>
        <div className='flex items-center gap-3'>
          <div className='animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600'></div>
          <span className='text-sm text-gray-600'>Loading SDK...</span>
        </div>
      </div>
    )
  }

  // Check user states as per documentation
  let message = ''
  if (userWithMissingInfo) {
    message =
      'You are authenticated but need to complete the onboarding process.'
  } else if (!isLoggedIn) {
    message = 'Please log in to continue.'
  } else {
    message = 'You are logged in!'
  }

  // Show connected state
  if (isLoggedIn && primaryWallet) {
    return (
      <div className='p-3 bg-green-50 border border-green-200 rounded-lg'>
        <div className='flex items-center gap-3 mb-2'>
          <div className='flex items-center gap-2'>
            <WalletIcon className='w-5 h-5 text-green-600' />
            <span className='text-sm font-medium text-green-800'>
              Wallet Connected
            </span>
          </div>

          <div className='flex items-center gap-2 ml-auto'>
            <UserIcon className='w-4 h-4 text-green-600' />
            <span className='text-xs text-green-700 font-mono'>
              {primaryWallet.address?.slice(0, 6)}...
              {primaryWallet.address?.slice(-4)}
            </span>

            <button
              onClick={handleDisconnectWallet}
              className='px-3 py-1 text-xs bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors'
            >
              Disconnect
            </button>
          </div>
        </div>

        <div className='text-xs text-gray-500 mb-2'>
          Debug: User: {user ? '✓' : '✗'}, Wallet: {primaryWallet ? '✓' : '✗'},
          LoggedIn: {isLoggedIn ? '✓' : '✗'}, JWT: {jwtToken ? '✓' : '✗'}
        </div>

        {jwtToken && (
          <div className='p-2 bg-gray-100 rounded text-xs'>
            <div className='font-medium text-gray-700 mb-1'>
              JWT Token Ready:
            </div>
            <div className='font-mono text-gray-600 break-all'>
              {jwtToken.substring(0, 50)}...
            </div>
          </div>
        )}
      </div>
    )
  }

  // Show wallet creation state when user is logged in but has no wallet
  if (isLoggedIn && !primaryWallet) {
    return (
      <div className='p-4 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg'>
        <div className='space-y-4'>
          <div className='flex items-center gap-2'>
            <WalletIcon className='w-6 h-6 text-yellow-600' />
            <h3 className='text-sm font-medium text-yellow-900'>
              Create Your Wallet
            </h3>
          </div>

          <p className='text-xs text-yellow-700'>
            You're logged in! Now let's create your embedded wallet to get
            started.
          </p>

          <button
            onClick={onCreateWalletHandler}
            disabled={isCreatingWallet}
            className='w-full px-4 py-2 bg-yellow-600 text-white text-sm font-medium rounded-md hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
          >
            {isCreatingWallet ? 'Creating Wallet...' : 'Create Embedded Wallet'}
          </button>

          <div className='text-xs text-gray-500'>
            Debug: User: {user ? '✓' : '✗'}, LoggedIn: {isLoggedIn ? '✓' : '✗'},
            JWT: {jwtToken ? '✓' : '✗'}
          </div>
        </div>
      </div>
    )
  }

  // Show email authentication forms
  if (showOtpForm) {
    return (
      <div className='p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg'>
        <div className='space-y-4'>
          <div className='flex items-center gap-2'>
            <WalletIcon className='w-6 h-6 text-green-600' />
            <h3 className='text-sm font-medium text-green-900'>
              Enter Verification Code
            </h3>
          </div>

          <form
            key='otp-form'
            onSubmit={onSubmitOtpHandler}
            className='space-y-3'
          >
            <input
              type='text'
              name='otp'
              placeholder='Enter OTP code'
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500'
              required
            />
            <button
              type='submit'
              disabled={isConnecting}
              className='w-full px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
            >
              {isConnecting ? 'Verifying...' : 'Verify Code'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // Show email form or connect button
  return (
    <div className='p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg'>
      <div className='space-y-4'>
        <div className='flex items-center gap-2'>
          <WalletIcon className='w-6 h-6 text-blue-600' />
          <h3 className='text-sm font-medium text-blue-900'>
            Connect Your Wallet
          </h3>
        </div>

        <p className='text-xs text-blue-700'>
          Connect your wallet to upload resumes and verify credentials on the
          blockchain
        </p>

        <form
          key='email-form'
          onSubmit={onSubmitEmailHandler}
          className='space-y-3'
        >
          <input
            type='email'
            name='email'
            placeholder='Enter your email'
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            required
          />
          <button
            type='submit'
            disabled={isConnecting}
            className='w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
          >
            {isConnecting ? 'Sending...' : 'Connect with Email'}
          </button>
        </form>

        <div className='text-center'>
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className='text-xs text-blue-600 hover:text-blue-800 underline'
          >
            Use Dynamic UI instead
          </button>
        </div>
      </div>
    </div>
  )
}
