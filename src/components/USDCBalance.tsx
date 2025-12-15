'use client'

import { useState, useEffect } from 'react'
import { getUSDCBalanceMainnet, getUSDCBalanceSepolia, hasSufficientUSDC, tokenAPIConfig } from '@/lib/alchemy-token-api'
import { useTheme } from '@/contexts/ThemeContext'

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
  const { theme } = useTheme()
  const [balanceMainnet, setBalanceMainnet] = useState<string>('0.00')
  const [balanceSepolia, setBalanceSepolia] = useState<string>('0.00')
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

      // Get both Mainnet and Sepolia USDC balances in parallel
      const [mainnetResult, sepoliaResult] = await Promise.all([
        getUSDCBalanceMainnet(walletAddress),
        getUSDCBalanceSepolia(walletAddress),
      ])

      if (mainnetResult.success) {
        setBalanceMainnet(mainnetResult.balanceFormatted)
      } else {
        setBalanceMainnet('0.00')
      }

      if (sepoliaResult.success) {
        setBalanceSepolia(sepoliaResult.balanceFormatted)
      } else {
        setBalanceSepolia('0.00')
      }

      // Check sufficiency if required (uses configured network)
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
      <div className={`flex items-center space-x-2 p-3 rounded-lg ${
        theme === 'dark'
          ? 'bg-brand-sage-light/10 border border-brand-mint/20'
          : 'bg-gray-50 border border-gray-200'
      }`}>
        <div className={`animate-spin rounded-full h-4 w-4 border-b-2 ${
          theme === 'dark' ? 'border-brand-mint' : 'border-blue-600'
        }`}></div>
        <span className={`text-sm ${
          theme === 'dark' ? 'text-brand-cream/70' : 'text-gray-600'
        }`}>Loading USDC balance...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`p-3 rounded-lg border ${
        theme === 'dark'
          ? 'bg-red-900/20 border-red-500/30'
          : 'bg-red-50 border-red-200'
      }`}>
        <div className='flex items-center justify-between'>
          <div className='flex items-center space-x-2'>
            <span className={theme === 'dark' ? 'text-red-400' : 'text-red-600'}>❌</span>
            <span className={`text-sm ${
              theme === 'dark' ? 'text-red-300' : 'text-red-700'
            }`}>Error: {error}</span>
          </div>
          <button
            onClick={handleRefresh}
            className={`text-xs underline ${
              theme === 'dark'
                ? 'text-red-400 hover:text-red-300'
                : 'text-red-600 hover:text-red-800'
            }`}
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
      <div className={`p-3 rounded-lg border ${
        theme === 'dark'
          ? 'bg-brand-mint/10 border-brand-mint/30'
          : 'bg-blue-50 border-blue-200'
      }`}>
        <div className='flex items-center justify-between mb-2'>
          <span className={`font-medium ${
            theme === 'dark' ? 'text-brand-cream' : 'text-blue-900'
          }`}>💰 USDC Balances</span>
          <button
            onClick={handleRefresh}
            className={`text-xs underline ${
              theme === 'dark'
                ? 'text-brand-mint hover:text-brand-cream'
                : 'text-blue-600 hover:text-blue-800'
            }`}
            title='Refresh balances'
          >
            🔄 Refresh
          </button>
        </div>
        
        {/* Base Mainnet USDC */}
        <div className={`flex items-center justify-between p-2 rounded ${
          theme === 'dark' ? 'bg-green-900/20' : 'bg-green-50'
        } mb-1`}>
          <div className='flex items-center gap-2'>
            <div className={`w-2 h-2 rounded-full ${
              theme === 'dark' ? 'bg-green-400' : 'bg-green-600'
            }`} />
            <span className={`text-sm font-medium ${
              theme === 'dark' ? 'text-green-300' : 'text-green-700'
            }`}>Base Mainnet:</span>
          </div>
          <span className={`text-sm font-bold ${
            theme === 'dark' ? 'text-green-400' : 'text-green-700'
          }`}>
            {loading ? (
              <div className={`animate-spin rounded-full h-3 w-3 border-b-2 ${
                theme === 'dark' ? 'border-green-400' : 'border-green-600'
              }`} />
            ) : (
              `$${balanceMainnet}`
            )}
          </span>
        </div>

        {/* Base Sepolia USDC */}
        <div className={`flex items-center justify-between p-2 rounded ${
          theme === 'dark' ? 'bg-blue-900/20' : 'bg-blue-50'
        }`}>
          <div className='flex items-center gap-2'>
            <div className={`w-2 h-2 rounded-full ${
              theme === 'dark' ? 'bg-blue-400' : 'bg-blue-600'
            }`} />
            <span className={`text-sm font-medium ${
              theme === 'dark' ? 'text-blue-300' : 'text-blue-700'
            }`}>Base Sepolia:</span>
          </div>
          <span className={`text-sm font-bold ${
            theme === 'dark' ? 'text-blue-400' : 'text-blue-700'
          }`}>
            {loading ? (
              <div className={`animate-spin rounded-full h-3 w-3 border-b-2 ${
                theme === 'dark' ? 'border-blue-400' : 'border-blue-600'
              }`} />
            ) : (
              `$${balanceSepolia}`
            )}
          </span>
        </div>
      </div>

      {/* Sufficiency Check */}
      {showSufficiencyCheck && requiredAmount && (
        <div
          className={`p-3 border rounded-lg ${
            hasSufficient
              ? theme === 'dark'
                ? 'bg-green-900/20 border-green-500/30'
                : 'bg-green-50 border-green-200'
              : theme === 'dark'
                ? 'bg-yellow-900/20 border-yellow-500/30'
                : 'bg-yellow-50 border-yellow-200'
          }`}
        >
          <div className='flex items-center space-x-2'>
            <span
              className={hasSufficient 
                ? (theme === 'dark' ? 'text-green-400' : 'text-green-600')
                : (theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600')
              }
            >
              {hasSufficient ? '✅' : '⚠️'}
            </span>
            <div className='flex-1'>
              {hasSufficient ? (
                <span className={`text-sm ${
                  theme === 'dark' ? 'text-green-300' : 'text-green-700'
                }`}>
                  Sufficient USDC for transaction (${requiredAmount} required)
                </span>
              ) : (
                <div className={`text-sm ${
                  theme === 'dark' ? 'text-yellow-300' : 'text-yellow-700'
                }`}>
                  <div>Insufficient USDC for transaction</div>
                  <div className={`text-xs mt-1 ${
                    theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'
                  }`}>
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
      <div className={`text-xs text-center ${
        theme === 'dark' ? 'text-brand-cream/50' : 'text-gray-500'
      }`}>
        Auto-refreshes every {Math.floor(refreshInterval / 1000)}s
      </div>
    </div>
  )
}
