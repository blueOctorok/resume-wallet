'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { baseAccountSDK, baseProvider } from '@/lib/base-account-sdk'
import {
  checkUSDCBalance,
  formatUSDCAmount,
  parseUSDCAmount,
} from '@/lib/erc20-gas-payment'

// Session interface for persistent authentication
interface AuthSession {
  address: string
  signature: string
  message: string
  method: 'base-account-sdk' | 'web3-wallet'
  timestamp: number
  expiresAt: number
}

interface SimpleBaseAuthProps {
  onAuthSuccess?: (user: any) => void
  onAuthError?: (error: string) => void
}

// Session storage configuration
const SESSION_KEY = 'resume-wallet-auth-session'
const SESSION_DURATION = 4 * 60 * 60 * 1000 // 4 hours

// Session storage functions
const saveSession = (session: AuthSession) => {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    console.log('💾 Session saved:', {
      address: session.address.slice(0, 6) + '...' + session.address.slice(-4),
      expiresAt: new Date(session.expiresAt).toLocaleString(),
    })
  } catch (error) {
    console.error('❌ Failed to save session:', error)
  }
}

const loadSession = (): AuthSession | null => {
  try {
    const stored = localStorage.getItem(SESSION_KEY)
    if (!stored) {
      console.log('🔍 No stored session found')
      return null
    }

    const session = JSON.parse(stored)

    if (session.expiresAt > Date.now()) {
      console.log('✅ Valid session found:', {
        address:
          session.address.slice(0, 6) + '...' + session.address.slice(-4),
        method: session.method,
        expiresAt: new Date(session.expiresAt).toLocaleString(),
      })
      return session
    } else {
      console.log('⏰ Session expired, clearing...')
      localStorage.removeItem(SESSION_KEY)
      return null
    }
  } catch (error) {
    console.error('❌ Failed to load session:', error)
    localStorage.removeItem(SESSION_KEY)
    return null
  }
}

const clearSession = () => {
  try {
    localStorage.removeItem(SESSION_KEY)
    console.log('🗑️ Session cleared')
  } catch (error) {
    console.error('❌ Failed to clear session:', error)
  }
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
  const [usdcBalance, setUsdcBalance] = useState<string>('0')
  const [ethBalance, setEthBalance] = useState<string>('0')
  const [isLoadingBalance, setIsLoadingBalance] = useState(false)
  const [currentChainId, setCurrentChainId] = useState<string>('')
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false)

  // Check if we're in a browser environment
  const isBrowser = typeof window !== 'undefined'

  // Use ref to avoid infinite loops with onAuthSuccess
  const onAuthSuccessRef = useRef(onAuthSuccess)
  onAuthSuccessRef.current = onAuthSuccess

  // Check for wallet providers and restore session on component mount
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

      // Try to restore session from localStorage
      const savedSession = loadSession()
      if (savedSession) {
        console.log('🔄 Restoring authentication from session...')
        setUser({
          address: savedSession.address,
          message: savedSession.message,
          signature: savedSession.signature,
          method: savedSession.method,
        })
        setIsAuthenticated(true)
        onAuthSuccessRef.current?.({
          address: savedSession.address,
          message: savedSession.message,
          signature: savedSession.signature,
          method: savedSession.method,
        })
        console.log('✅ Session restored successfully')
      }
    }
  }, [isBrowser]) // Only depend on isBrowser, not onAuthSuccess

  // Check balances when user is authenticated
  const checkBalances = async (userAddress: string) => {
    if (!baseProvider) return

    setIsLoadingBalance(true)
    try {
      console.log('💰 Checking balances for:', userAddress)

      // Check ETH balance
      const ethBalance = await baseProvider.request({
        method: 'eth_getBalance',
        params: [userAddress, 'latest'],
      })
      const ethInWei = BigInt(ethBalance)
      const ethFormatted = (Number(ethInWei) / 1e18).toFixed(6)
      setEthBalance(ethFormatted)

      // Check USDC balance using Alchemy Token API
      try {
        const { getUSDCBalance } = await import('@/lib/alchemy-token-api')
        const usdcResult = await getUSDCBalance(userAddress)
        const usdcBalance = usdcResult.success
          ? usdcResult.balanceFormatted
          : '0.00'
        setUsdcBalance(usdcBalance)
        console.log('✅ Balances (via Alchemy):', {
          eth: ethFormatted,
          usdc: usdcBalance,
        })
      } catch (usdcError) {
        console.warn('⚠️ Failed to get USDC balance via Alchemy:', usdcError)
        // Fallback to original method
        try {
          const usdcBalance = await checkUSDCBalance(userAddress, baseProvider)
          setUsdcBalance(usdcBalance)
          console.log('✅ Balances (fallback):', {
            eth: ethFormatted,
            usdc: usdcBalance,
          })
        } catch (fallbackError) {
          console.warn(
            '⚠️ Fallback USDC balance check also failed:',
            fallbackError
          )
          setUsdcBalance('0.00')
          console.log('✅ Balances:', {
            eth: ethFormatted,
            usdc: '0.00 (error)',
          })
        }
      }
    } catch (error) {
      console.error('❌ Failed to check balances:', error)
    } finally {
      setIsLoadingBalance(false)
    }
  }

  // Check balances when user changes
  useEffect(() => {
    if (user?.address) {
      checkBalances(user.address)
    }
  }, [user?.address])

  // Get current chain ID
  const getCurrentChainId = async () => {
    if (!baseProvider) return

    try {
      const chainId = await baseProvider.request({ method: 'eth_chainId' })
      setCurrentChainId(chainId)
      console.log('🔍 Current chain ID:', chainId)
    } catch (error) {
      console.error('Failed to get chain ID:', error)
    }
  }

  // Switch to Base Sepolia
  const switchToBaseSepolia = async () => {
    if (!baseProvider) return

    setIsSwitchingNetwork(true)
    setError('')

    try {
      console.log('🔄 Switching to Base Sepolia...')

      await baseProvider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x14a34' }], // Base Sepolia
      })

      console.log('✅ Switched to Base Sepolia')

      // Update chain ID and refresh balances
      await getCurrentChainId()
      if (user?.address) {
        await checkBalances(user.address)
      }
    } catch (error: any) {
      console.error('❌ Failed to switch network:', error)
      if (error.code === 4902) {
        // Network not added to wallet
        setError(
          'Base Sepolia network not found. Please add it to your wallet.'
        )
      } else {
        setError(`Failed to switch network: ${error.message}`)
      }
    } finally {
      setIsSwitchingNetwork(false)
    }
  }

  // Get chain ID when user is authenticated
  useEffect(() => {
    if (user?.address) {
      getCurrentChainId()
    }
  }, [user?.address])

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

        // Save session to localStorage
        const sessionData: AuthSession = {
          address: userAddress,
          message,
          signature,
          method: 'base-account-sdk',
          timestamp: Date.now(),
          expiresAt: Date.now() + SESSION_DURATION,
        }
        saveSession(sessionData)

        setUser(userInfo)
        setIsAuthenticated(true)
        onAuthSuccessRef.current?.(userInfo)

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
          method: 'web3-wallet',
        }

        // Save session to localStorage
        const sessionData: AuthSession = {
          address: userAddress,
          message,
          signature,
          method: 'web3-wallet',
          timestamp: Date.now(),
          expiresAt: Date.now() + SESSION_DURATION,
        }
        saveSession(sessionData)

        setUser(userInfo)
        setIsAuthenticated(true)
        onAuthSuccessRef.current?.(userInfo)

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
    // Clear session from localStorage
    clearSession()

    setUser(null)
    setIsAuthenticated(false)
    console.log('✅ Signed out')
  }

  if (isAuthenticated && user) {
    return (
      <div className='p-4 bg-white border border-gray-200 rounded-lg shadow-sm'>
        {/* Authentication Status */}
        <div className='p-3 bg-green-50 border border-green-200 rounded-lg mb-4'>
          <div className='flex items-center justify-between mb-2'>
            <div className='flex items-center gap-2'>
              <div className='w-3 h-3 bg-green-500 rounded-full'></div>
              <div className='flex flex-col'>
                <span className='text-sm font-medium text-green-800'>
                  Signed in: {user.address.slice(0, 6)}...
                  {user.address.slice(-4)}
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

          {/* Network Status */}
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <span className='text-xs text-gray-600'>Network:</span>
              <span
                className={`text-xs font-medium ${
                  currentChainId === '0x14a34'
                    ? 'text-green-600'
                    : 'text-orange-600'
                }`}
              >
                {currentChainId === '0x14a34'
                  ? 'Base Sepolia ✅'
                  : currentChainId === '0x2105'
                    ? 'Base Mainnet ⚠️'
                    : currentChainId
                      ? `Chain ${currentChainId}`
                      : 'Unknown'}
              </span>
            </div>
            {currentChainId !== '0x14a34' && (
              <button
                onClick={switchToBaseSepolia}
                disabled={isSwitchingNetwork}
                className='px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50 transition-colors'
              >
                {isSwitchingNetwork ? 'Switching...' : 'Switch to Sepolia'}
              </button>
            )}
          </div>
        </div>

        {/* Balance Display - Prominent */}
        <div className='space-y-2 mb-4'>
          <div className='p-3 bg-blue-50 border border-blue-200 rounded-lg'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <div className='w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center'>
                  <span className='text-white text-xs font-bold'>$</span>
                </div>
                <span className='text-sm font-medium text-blue-800'>
                  USDC Balance
                </span>
              </div>
              <span className='text-lg font-bold text-blue-900'>
                {isLoadingBalance ? (
                  <div className='w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin'></div>
                ) : (
                  `${formatUSDCAmount(parseUSDCAmount(usdcBalance))} USDC`
                )}
              </span>
            </div>
          </div>

          <div className='p-3 bg-gray-50 border border-gray-200 rounded-lg'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <div className='w-6 h-6 bg-gray-600 rounded-full flex items-center justify-center'>
                  <span className='text-white text-xs font-bold'>Ξ</span>
                </div>
                <span className='text-sm font-medium text-gray-700'>
                  ETH Balance
                </span>
              </div>
              <span className='text-sm font-medium text-gray-900'>
                {isLoadingBalance ? (
                  <div className='w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin'></div>
                ) : (
                  `${ethBalance} ETH`
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Refresh Button */}
        <button
          onClick={() => user?.address && checkBalances(user.address)}
          disabled={isLoadingBalance}
          className='w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50 transition-colors'
        >
          {isLoadingBalance ? (
            <>
              <div className='w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin'></div>
              Refreshing...
            </>
          ) : (
            <>
              <svg
                className='w-4 h-4'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'
                />
              </svg>
              Refresh Balances
            </>
          )}
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
