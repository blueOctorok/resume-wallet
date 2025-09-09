'use client'

import React, { useState, useEffect } from 'react'
import { baseAccountSDK, baseProvider } from '@/lib/base-account-sdk'
import { createSignInTypedData, signTypedData } from '@/lib/typed-data'

interface BaseAccountAuthProps {
  onAuthSuccess?: (user: any) => void
  onAuthError?: (error: string) => void
}

export const BaseAccountAuth: React.FC<BaseAccountAuthProps> = ({
  onAuthSuccess,
  onAuthError,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>('')

  // Check authentication status on component mount
  useEffect(() => {
    checkAuthStatus()
  }, [])

  const checkAuthStatus = async () => {
    if (!baseProvider) {
      console.warn('Base provider not initialized')
      return
    }

    try {
      // Check if user is already connected by requesting accounts
      const accounts = await baseProvider.request({ method: 'eth_accounts' })
      if (accounts && accounts.length > 0) {
        // For existing connections, we don't have the message/signature
        // but we can still show the user as authenticated
        const userInfo = {
          address: accounts[0],
        }
        setIsAuthenticated(true)
        setUser(userInfo)
        onAuthSuccess?.(userInfo)
      }
    } catch (error) {
      console.error('Error checking auth status:', error)
    }
  }

  const signInWithBase = async () => {
    if (!baseProvider) {
      setError('Base provider not initialized. Please refresh the page.')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      // 1. Switch to Base Chain (Base Mainnet - 8453)
      await baseProvider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x2105' }], // Base Mainnet
      })

      // 2. Get user accounts
      const accounts = await baseProvider.request({
        method: 'eth_requestAccounts',
      })

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found. Please connect your wallet.')
      }

      const userAddress = accounts[0]

      // 3. Create EIP-712 typed data
      const typedData = createSignInTypedData(userAddress)

      // 4. Request typed data signature
      const signature = await signTypedData(userAddress, typedData)

      // 5. Send to backend for verification
      const response = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          typedData,
          signature,
          address: userAddress,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Authentication verification failed')
      }

      const authResult = await response.json()

      const userInfo = {
        address: userAddress,
        typedData,
        signature,
        sessionToken: authResult.sessionToken,
        nonce: typedData.message.nonce,
        expiry: typedData.message.expiry,
      }

      setUser(userInfo)
      setIsAuthenticated(true)
      onAuthSuccess?.(userInfo)
    } catch (error: any) {
      console.error('Error signing in with Base:', error)

      // Handle different types of errors
      let errorMessage = 'Failed to sign in with Base'

      if (error.message) {
        errorMessage = error.message
      } else if (typeof error === 'string') {
        errorMessage = error
      } else if (error.code) {
        switch (error.code) {
          case 4001:
            errorMessage = 'User rejected the authentication request'
            break
          case 4100:
            errorMessage = 'Unauthorized - please try again'
            break
          case 4200:
            errorMessage = 'Unsupported method'
            break
          case 4900:
            errorMessage = 'Unauthorized - please refresh and try again'
            break
          default:
            errorMessage = `Authentication error: ${error.code}`
        }
      }

      setError(errorMessage)
      onAuthError?.(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const signOut = async () => {
    try {
      // Base Account SDK doesn't have a direct sign-out method
      // The user will remain signed in until they manually disconnect
      setUser(null)
      setIsAuthenticated(false)
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  if (isAuthenticated && user) {
    return (
      <div className='flex items-center gap-4 p-4 bg-green-50 border border-green-200 rounded-lg'>
        <div className='flex items-center gap-2'>
          <div className='w-3 h-3 bg-green-500 rounded-full'></div>
          <div className='flex flex-col'>
            <span className='text-sm font-medium text-green-800'>
              Signed in: {user.address.slice(0, 6)}...{user.address.slice(-4)}
            </span>
            {user.message && (
              <span className='text-xs text-green-600'>
                Authenticated with Base Account
              </span>
            )}
          </div>
        </div>
        <button
          onClick={signOut}
          className='px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors'
        >
          Sign Out
        </button>
      </div>
    )
  }

  return (
    <div className='p-6 bg-white border border-gray-200 rounded-lg shadow-sm'>
      <div className='text-center'>
        <div className='mb-4'>
          <div className='w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3'>
            <svg
              className='w-8 h-8 text-blue-600'
              fill='currentColor'
              viewBox='0 0 24 24'
            >
              <path d='M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5' />
            </svg>
          </div>
          <h2 className='text-xl font-semibold text-gray-900'>
            Sign in with Base
          </h2>
          <p className='text-gray-600 mt-2'>
            Connect your Base Account to access your resume wallet
          </p>
        </div>

        <button
          onClick={signInWithBase}
          disabled={isLoading}
          className='w-full flex items-center justify-center gap-3 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
        >
          {isLoading ? (
            <>
              <div className='w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin'></div>
              Signing in...
            </>
          ) : (
            <>
              <div className='w-5 h-5 bg-white rounded-sm'></div>
              Sign in with Base
            </>
          )}
        </button>

        {error && (
          <div className='mt-4 p-3 bg-red-100 border border-red-200 rounded text-red-700 text-sm'>
            {error}
          </div>
        )}
      </div>
    </div>
  )
}

export default BaseAccountAuth
