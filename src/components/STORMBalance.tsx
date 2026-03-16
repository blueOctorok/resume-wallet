'use client'

import { useState, useEffect } from 'react'
import {
  getSTORMBalanceSepolia,
  getSTORMBalanceMainnet,
  STORM_TOKEN_ADDRESS_SEPOLIA,
} from '@/lib/alchemy-token-api'
import { useTheme } from '@/contexts/ThemeContext'
import { RefreshCw, ExternalLink, FileText } from 'lucide-react'

interface STORMBalanceProps {
  walletAddress: string
  refreshInterval?: number
  compact?: boolean
  onReadWhitepaper?: () => void
}

export default function STORMBalance({
  walletAddress,
  refreshInterval = 60000,
  compact = false,
  onReadWhitepaper,
}: STORMBalanceProps) {
  const { theme } = useTheme()
  const [balanceSepolia, setBalanceSepolia] = useState<string>('0.00')
  const [balanceMainnet, setBalanceMainnet] = useState<string>('0.00')
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBalance = async () => {
    if (!walletAddress) {
      setError('No wallet address provided')
      setLoading(false)
      return
    }

    try {
      setError(null)

      const [sepoliaResult, mainnetResult] = await Promise.all([
        getSTORMBalanceSepolia(walletAddress),
        getSTORMBalanceMainnet(walletAddress),
      ])

      if (sepoliaResult.success) {
        setBalanceSepolia(sepoliaResult.balanceFormatted)
      } else {
        setBalanceSepolia('0.00')
      }

      if (mainnetResult.success) {
        setBalanceMainnet(mainnetResult.balanceFormatted)
      } else {
        setBalanceMainnet('0.00')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      console.error('Error fetching STORM balance:', errorMessage)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBalance()
  }, [walletAddress])

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

  // Compact mode for nav/header display
  if (compact) {
    if (loading) {
      return (
        <div className='flex items-center gap-1'>
          <span className='text-yellow-400'>⛈️</span>
          <div
            className={`animate-pulse h-4 w-12 rounded ${
              theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
            }`}
          />
        </div>
      )
    }

    const displayBalance =
      balanceSepolia !== '0.00' ? balanceSepolia : balanceMainnet

    return (
      <div
        className='flex items-center gap-1'
        title={`STORM Token Balance: ${displayBalance}`}
      >
        <span className='text-yellow-400'>⛈️</span>
        <span
          className={`text-sm font-medium ${
            theme === 'dark' ? 'text-yellow-300' : 'text-yellow-600'
          }`}
        >
          {displayBalance}
        </span>
      </div>
    )
  }

  // Card styling (matches hub)
  const cardClass = `rounded-2xl border transition-all duration-200 ${
    theme === 'dark'
      ? 'bg-gray-800/50 border-gray-700'
      : 'bg-white/70 border-gray-200'
  }`

  if (loading) {
    return (
      <div className={`${cardClass} p-4`}>
        <div className='flex items-center gap-3'>
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              theme === 'dark' ? 'bg-yellow-500/20' : 'bg-yellow-50'
            }`}
          >
            <span className='text-lg'>⛈️</span>
          </div>
          <div className='flex-1'>
            <div
              className={`h-4 w-20 rounded animate-pulse ${
                theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
              }`}
            />
            <div
              className={`h-3 w-16 rounded animate-pulse mt-2 ${
                theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
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
          theme === 'dark' ? 'border-red-500/30' : 'border-red-200'
        }`}
      >
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <span className='text-red-500'>❌</span>
            <span
              className={`text-sm ${
                theme === 'dark' ? 'text-red-300' : 'text-red-700'
              }`}
            >
              {error}
            </span>
          </div>
          <button
            onClick={handleRefresh}
            className={`p-1.5 rounded-lg transition-colors ${
              theme === 'dark'
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
              theme === 'dark' ? 'bg-yellow-500/20' : 'bg-yellow-50'
            }`}
          >
            <span className='text-lg'>⛈️</span>
          </div>
          <div>
            <span
              className={`font-semibold ${
                theme === 'dark' ? 'text-gray-200' : 'text-gray-800'
              }`}
            >
              STORM
            </span>
            <p
              className={`text-xs ${
                theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
              }`}
            >
              StormChain Token
            </p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          className={`p-1.5 rounded-lg transition-colors ${
            theme === 'dark'
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
        {/* Base Sepolia (currently active for testnet) */}
        <div
          className={`flex items-center justify-between p-2.5 rounded-xl ${
            theme === 'dark' ? 'bg-yellow-500/10' : 'bg-yellow-50'
          }`}
        >
          <div className='flex items-center gap-2'>
            <div
              className={`w-2 h-2 rounded-full ${
                theme === 'dark' ? 'bg-yellow-400' : 'bg-yellow-500'
              }`}
            />
            <span
              className={`text-sm ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
              }`}
            >
              Sepolia
            </span>
          </div>
          <span
            className={`text-sm font-bold ${
              theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'
            }`}
          >
            {balanceSepolia} STORM
          </span>
        </div>

        {/* Base Mainnet (coming soon) */}
        <div
          className={`flex items-center justify-between p-2.5 rounded-xl ${
            theme === 'dark' ? 'bg-gray-700/30' : 'bg-gray-100'
          }`}
        >
          <div className='flex items-center gap-2'>
            <div
              className={`w-2 h-2 rounded-full ${
                theme === 'dark' ? 'bg-gray-500' : 'bg-gray-400'
              }`}
            />
            <span
              className={`text-sm ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              }`}
            >
              Mainnet
            </span>
          </div>
          <span
            className={`text-sm ${
              theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
            }`}
          >
            {balanceMainnet !== '0.00' ? `${balanceMainnet} STORM` : 'Soon'}
          </span>
        </div>
      </div>

      {/* Footer row: contract link + whitepaper */}
      <div className='mt-3 pt-3 border-t border-gray-700/50 flex items-center justify-between'>
        {STORM_TOKEN_ADDRESS_SEPOLIA && (
          <a
            href={`https://sepolia.basescan.org/address/${STORM_TOKEN_ADDRESS_SEPOLIA}`}
            target='_blank'
            rel='noopener noreferrer'
            className={`inline-flex items-center gap-1 text-xs ${
              theme === 'dark'
                ? 'text-gray-500 hover:text-gray-300'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <span className='font-mono'>
              {STORM_TOKEN_ADDRESS_SEPOLIA?.slice(0, 6)}...
              {STORM_TOKEN_ADDRESS_SEPOLIA?.slice(-4)}
            </span>
            <ExternalLink className='w-3 h-3' />
          </a>
        )}
        {onReadWhitepaper && (
          <button
            onClick={onReadWhitepaper}
            className={`inline-flex items-center gap-1 text-xs font-medium transition-colors ${
              theme === 'dark'
                ? 'text-teal-400 hover:text-teal-300'
                : 'text-teal-600 hover:text-teal-700'
            }`}
          >
            <FileText className='w-3 h-3' />
            Whitepaper
          </button>
        )}
      </div>
    </div>
  )
}
