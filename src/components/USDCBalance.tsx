'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useState, useEffect } from 'react'
import {
  getUSDCBalanceMainnet,
  getUSDCBalanceSepolia,
  hasSufficientUSDC,
} from '@/lib/alchemy-token-api'
import { useTheme } from '@/contexts/ThemeContext'
import { RefreshCw, ExternalLink } from 'lucide-react'

interface USDCBalanceProps {
  walletAddress: string
  requiredAmount?: string
  showSufficiencyCheck?: boolean
  refreshInterval?: number
}

export default function USDCBalance({
  walletAddress,
  requiredAmount,
  showSufficiencyCheck = false,
  refreshInterval = 60000,
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
      console.error('Error fetching USDC balance:', errorMessage)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBalance()
  }, [walletAddress, requiredAmount, showSufficiencyCheck])

  useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(fetchBalance, refreshInterval)
      return () => clearInterval(interval)
    }
  }, [refreshInterval, walletAddress])

  const handleRefresh = () => {
    setLoading(true)
    fetchBalance()
  }

  // Card styling (matches hub)
  const cardClass = `rounded-2xl border transition-all duration-200 ${
    isDarkTheme(theme)
      ? 'bg-gray-800/50 border-gray-700'
      : 'bg-white/70 border-gray-200'
  }`

  if (loading) {
    return (
      <div className={`${cardClass} p-4`}>
        <div className='flex items-center gap-3'>
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isDarkTheme(theme) ? 'bg-blue-500/20' : 'bg-blue-50'
            }`}
          >
            <span className='text-lg'>💵</span>
          </div>
          <div className='flex-1'>
            <div
              className={`h-4 w-20 rounded animate-pulse ${
                isDarkTheme(theme) ? 'bg-gray-700' : 'bg-gray-200'
              }`}
            />
            <div
              className={`h-3 w-16 rounded animate-pulse mt-2 ${
                isDarkTheme(theme) ? 'bg-gray-700' : 'bg-gray-200'
              }`}
            />
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div
        className={`${cardClass} p-4 ${
          isDarkTheme(theme) ? 'border-red-500/30' : 'border-red-200'
        }`}
      >
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <span className='text-red-500'>❌</span>
            <span
              className={`text-sm ${
                isDarkTheme(theme) ? 'text-red-300' : 'text-red-700'
              }`}
            >
              {error}
            </span>
          </div>
          <button
            onClick={handleRefresh}
            className={`p-1.5 rounded-lg transition-colors ${
              isDarkTheme(theme)
                ? 'hover:bg-gray-700 text-gray-400'
                : 'hover:bg-gray-200 text-gray-500'
            }`}
          >
            <RefreshCw className='w-4 h-4' />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`${cardClass} p-4`}>
      <div className='flex items-center justify-between mb-3'>
        <div className='flex items-center gap-3'>
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isDarkTheme(theme) ? 'bg-blue-500/20' : 'bg-blue-50'
            }`}
          >
            <span className='text-lg'>💵</span>
          </div>
          <span
            className={`font-semibold ${
              isDarkTheme(theme) ? 'text-gray-200' : 'text-gray-800'
            }`}
          >
            USDC
          </span>
        </div>
        <button
          onClick={handleRefresh}
          className={`p-1.5 rounded-lg transition-colors ${
            isDarkTheme(theme)
              ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200'
              : 'hover:bg-gray-200 text-gray-500 hover:text-gray-700'
          }`}
          title='Refresh balance'
        >
          <RefreshCw className='w-4 h-4' />
        </button>
      </div>

      {/* Balance rows */}
      <div className='space-y-2'>
        {/* Base Mainnet */}
        <div
          className={`flex items-center justify-between p-2.5 rounded-xl ${
            isDarkTheme(theme) ? 'bg-green-500/10' : 'bg-green-50'
          }`}
        >
          <div className='flex items-center gap-2'>
            <div
              className={`w-2 h-2 rounded-full ${
                isDarkTheme(theme) ? 'bg-green-400' : 'bg-green-500'
              }`}
            />
            <span
              className={`text-sm ${
                isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-600'
              }`}
            >
              Mainnet
            </span>
          </div>
          <span
            className={`text-sm font-bold ${
              isDarkTheme(theme) ? 'text-green-400' : 'text-green-600'
            }`}
          >
            ${balanceMainnet}
          </span>
        </div>

        {/* Base Sepolia */}
        <div
          className={`flex items-center justify-between p-2.5 rounded-xl ${
            isDarkTheme(theme) ? 'bg-blue-500/10' : 'bg-blue-50'
          }`}
        >
          <div className='flex items-center gap-2'>
            <div
              className={`w-2 h-2 rounded-full ${
                isDarkTheme(theme) ? 'bg-blue-400' : 'bg-blue-500'
              }`}
            />
            <span
              className={`text-sm ${
                isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-600'
              }`}
            >
              Sepolia
            </span>
          </div>
          <span
            className={`text-sm font-bold ${
              isDarkTheme(theme) ? 'text-blue-400' : 'text-blue-600'
            }`}
          >
            ${balanceSepolia}
          </span>
        </div>
      </div>

      {/* Sufficiency Check */}
      {showSufficiencyCheck && requiredAmount && (
        <div
          className={`mt-3 p-2.5 rounded-xl ${
            hasSufficient
              ? isDarkTheme(theme)
                ? 'bg-green-500/10'
                : 'bg-green-50'
              : isDarkTheme(theme)
                ? 'bg-yellow-500/10'
                : 'bg-yellow-50'
          }`}
        >
          <div className='flex items-center gap-2'>
            <span>{hasSufficient ? '✅' : '⚠️'}</span>
            <span
              className={`text-xs ${
                hasSufficient
                  ? isDarkTheme(theme)
                    ? 'text-green-300'
                    : 'text-green-700'
                  : isDarkTheme(theme)
                    ? 'text-yellow-300'
                    : 'text-yellow-700'
              }`}
            >
              {hasSufficient
                ? `Sufficient (need $${requiredAmount})`
                : `Need $${requiredAmount}${shortfall ? `, short $${shortfall}` : ''}`}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
