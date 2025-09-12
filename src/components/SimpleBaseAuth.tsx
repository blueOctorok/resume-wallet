'use client'

import React, { useState, useEffect } from 'react'
import { baseAccountSDK, baseProvider } from '@/lib/base-account-sdk'

interface SimpleBaseAuthProps {
  onAuthSuccess?: (user: any) => void
  onAuthError?: (error: string) => void
}

export const SimpleBaseAuth: React.FC<SimpleBaseAuthProps> = ({
  onAuthSuccess,
  onAuthError,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [availableProviders, setAvailableProviders] = useState<string[]>([])

  // Check if we're in a browser environment
  const isBrowser = typeof window !== 'undefined'

  // Check for wallet providers on component mount
  useEffect(() => {
    if (isBrowser) {
      console.log('🔍 Checking for wallet providers on mount...')

      const providers: string[] = []

      // Check if Base Account SDK is available
      if (baseAccountSDK && baseProvider) {
        console.log('✅ Base Account SDK is available')
        providers.push('Base Account SDK')
      } else {
        console.log('⚠️ Base Account SDK not available')
      }

      // Check if Ethereum provider is available (MetaMask, etc.)
      if ((window as any).ethereum) {
        console.log('✅ Ethereum provider is available')
        providers.push('MetaMask/Web3 Wallet')
      } else {
        console.log('⚠️ Ethereum provider not available')
      }

      setAvailableProviders(providers)
      console.log('Available providers:', providers)
    }
  }, [isBrowser])

  const signInWithWallet = async () => {
    if (!isBrowser) {
      setError('Please use a web browser to sign in')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      console.log('🔍 Starting wallet authentication...')

      // Try Base Account SDK first
      if (baseAccountSDK && baseProvider) {
        console.log('✅ Attempting Base Account SDK authentication')
        await signInWithBaseAccount()
      } else if (typeof window !== 'undefined' && (window as any).ethereum) {
        console.log('✅ Attempting Ethereum provider authentication')
        await signInWithEthereum()
      } else {
        console.log('❌ No wallet provider found')
        throw new Error(
          'No wallet provider found. Please install MetaMask or another Web3 wallet.'
        )
      }
    } catch (error: any) {
      console.error('❌ Authentication failed:', error)
      setError(error.message || 'Authentication failed')
      onAuthError?.(error.message || 'Authentication failed')
    } finally {
      setIsLoading(false)
    }
  }

  const signInWithBaseAccount = async () => {
    try {
      console.log('🔍 Requesting accounts from Base Account SDK...')
      // Request accounts
      const accounts = await baseProvider.request({
        method: 'eth_requestAccounts',
      })

      console.log('✅ Accounts received:', accounts)

      if (accounts && accounts.length > 0) {
        const userAddress = accounts[0]

        // Create a simple message to sign
        const message = `Sign in to Resume Wallet\n\nAddress: ${userAddress}\nTimestamp: ${Date.now()}`

        console.log('✍️ Requesting signature for message:', message)
        // Sign the message
        const signature = await baseProvider.request({
          method: 'personal_sign',
          params: [message, userAddress],
        })

        const userInfo = {
          address: userAddress,
          message,
          signature,
          method: 'base-account-sdk',
        }

        setUser(userInfo)
        setIsAuthenticated(true)
        onAuthSuccess?.(userInfo)

        console.log('✅ Base Account SDK authentication successful')
      } else {
        throw new Error('No accounts returned from Base Account SDK')
      }
    } catch (error: any) {
      console.error('Base Account SDK authentication failed:', error)
      throw error
    }
  }

  const signInWithEthereum = async () => {
    try {
      const ethereum = (window as any).ethereum

      console.log('🔍 Requesting accounts from Ethereum provider...')
      // Request accounts
      const accounts = await ethereum.request({
        method: 'eth_requestAccounts',
      })

      console.log('✅ Accounts received:', accounts)

      if (accounts && accounts.length > 0) {
        const userAddress = accounts[0]

        // Create a simple message to sign
        const message = `Sign in to Resume Wallet\n\nAddress: ${userAddress}\nTimestamp: ${Date.now()}`

        console.log('✍️ Requesting signature for message:', message)
        // Sign the message
        const signature = await ethereum.request({
          method: 'personal_sign',
          params: [message, userAddress],
        })

        const userInfo = {
          address: userAddress,
          message,
          signature,
          method: 'ethereum',
        }

        setUser(userInfo)
        setIsAuthenticated(true)
        onAuthSuccess?.(userInfo)

        console.log('✅ Ethereum authentication successful')
      } else {
        throw new Error('No accounts returned from wallet')
      }
    } catch (error: any) {
      console.error('Ethereum authentication failed:', error)
      throw error
    }
  }

  const signOut = async () => {
    setUser(null)
    setIsAuthenticated(false)
    console.log('✅ Signed out')
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
            <span className='text-xs text-green-600'>
              Method:{' '}
              {user.method === 'base-account-sdk'
                ? 'Base Account SDK'
                : 'Web3 Wallet'}
            </span>
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
            Sign in to Resume Wallet
          </h2>
          <p className='text-gray-600 mt-2'>
            Connect your wallet to access your resume verification
          </p>
        </div>

        <button
          onClick={signInWithWallet}
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
              Sign in with Wallet
            </>
          )}
        </button>

        {error && (
          <div className='mt-4 p-3 bg-red-100 border border-red-200 rounded text-red-700 text-sm'>
            {error}
          </div>
        )}

        <div className='mt-4 text-xs text-gray-500'>
          <p>Available wallet providers:</p>
          {availableProviders.length > 0 ? (
            <ul className='mt-1 space-y-1'>
              {availableProviders.map((provider, index) => (
                <li key={index} className='text-green-600'>
                  • {provider}
                </li>
              ))}
            </ul>
          ) : (
            <p className='mt-1 text-red-600'>No wallet providers detected</p>
          )}
          <p className='mt-2 text-gray-400'>• Base Account SDK (preferred)</p>
          <p className='text-gray-400'>• Web3 wallet fallback</p>
        </div>
      </div>
    </div>
  )
}

export default SimpleBaseAuth
