'use client'

import { useState, useEffect } from 'react'
import { getUSDCBalance, hasSufficientUSDC } from '@/lib/alchemy-token-api'

interface USDCBalanceProps {
  walletAddress: string
  requiredAmount?: string // Optional - for checking if user has enough USDC
  showSufficiencyCheck?: boolean
  refreshInterval?: number // Auto-refresh interval in milliseconds
}

export default function USDCBalance({
  walletAddress,
  requiredAmount,
  showSufficiencyCheck = false,
  refreshInterval = 60000, // 60 seconds default (reduced frequency)
}: USDCBalanceProps) {
  const [balance, setBalance] = useState<string>('0.00')
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [hasSufficient, setHasSufficient] = useState<boolean>(true)
  const [shortfall, setShortfall] = useState<string | undefined>()

  const fetchBalance = async () => {
    if (!walletAddress) {
      setError('No wallet address provided')
      setLoading(false)
      return
    }

    try {
      setError(null)

      // Get USDC balance
      const balanceResult = await getUSDCBalance(walletAddress)

      if (!balanceResult.success) {
        setError(balanceResult.error || 'Failed to get USDC balance')
        setBalance('0.00')
      } else {
        setBalance(balanceResult.balanceFormatted)
      }

      // Check sufficiency if required
      if (showSufficiencyCheck && requiredAmount) {
        const sufficiencyResult = await hasSufficientUSDC(
          walletAddress,
          requiredAmount
        )

        if (sufficiencyResult.success) {
          setHasSufficient(sufficiencyResult.hasSufficient)
          setShortfall(sufficiencyResult.shortfall)
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      console.error('❌ Error fetching USDC balance:', errorMessage)
    } finally {
      setLoading(false)
    }
  }

  // Initial fetch
  useEffect(() => {
    fetchBalance()
  }, [walletAddress, requiredAmount, showSufficiencyCheck])

  // Auto-refresh
  useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(fetchBalance, refreshInterval)
      return () => clearInterval(interval)
    }
  }, [refreshInterval, walletAddress])

  // Manual refresh handler
  const handleRefresh = () => {
    setLoading(true)
    fetchBalance()
  }

  if (loading) {
    return (
      <div className='flex items-center space-x-2 p-3 bg-gray-50 rounded-lg'>
        <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600'></div>
        <span className='text-sm text-gray-600'>Loading USDC balance...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className='p-3 bg-red-50 border border-red-200 rounded-lg'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center space-x-2'>
            <span className='text-red-600'>❌</span>
            <span className='text-sm text-red-700'>Error: {error}</span>
          </div>
          <button
            onClick={handleRefresh}
            className='text-xs text-red-600 hover:text-red-800 underline'
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className='space-y-2'>
      {/* USDC Balance Display */}
      <div className='flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg'>
        <div className='flex items-center space-x-2'>
          <span className='text-blue-600'>💰</span>
          <span className='font-medium text-blue-900'>USDC Balance:</span>
          <span className='font-bold text-blue-900'>${balance}</span>
        </div>
        <button
          onClick={handleRefresh}
          className='text-xs text-blue-600 hover:text-blue-800 underline'
          title='Refresh balance'
        >
          🔄 Refresh
        </button>
      </div>

      {/* Sufficiency Check */}
      {showSufficiencyCheck && requiredAmount && (
        <div
          className={`p-3 border rounded-lg ${
            hasSufficient
              ? 'bg-green-50 border-green-200'
              : 'bg-yellow-50 border-yellow-200'
          }`}
        >
          <div className='flex items-center space-x-2'>
            <span
              className={hasSufficient ? 'text-green-600' : 'text-yellow-600'}
            >
              {hasSufficient ? '✅' : '⚠️'}
            </span>
            <div className='flex-1'>
              {hasSufficient ? (
                <span className='text-sm text-green-700'>
                  Sufficient USDC for transaction (${requiredAmount} required)
                </span>
              ) : (
                <div className='text-sm text-yellow-700'>
                  <div>Insufficient USDC for transaction</div>
                  <div className='text-xs mt-1'>
                    Need ${requiredAmount}, have ${balance}
                    {shortfall && ` (short $${shortfall})`}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Balance Info */}
      <div className='text-xs text-gray-500 text-center'>
        Base Sepolia USDC • Auto-refreshes every{' '}
        {Math.floor(refreshInterval / 1000)}s
      </div>
    </div>
  )
}
