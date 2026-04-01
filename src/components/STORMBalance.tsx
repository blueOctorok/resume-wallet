'use client'

import { useState, useEffect } from 'react'
import {
  getSTORMBalanceSepolia,
  getSTORMBalanceMainnet,
  STORM_TOKEN_ADDRESS_SEPOLIA,
} from '@/lib/alchemy-token-api'
import { useTheme } from '@/contexts/ThemeContext'
import { RefreshCw, ExternalLink, FileText, Coins } from 'lucide-react'
import BuyUSDCButton from '@/components/BuyUSDCButton'
import StormTokenMark from '@/components/ui/StormTokenMark'
import BlockCard from '@/components/ui/BlockCard'
import Button from '@/components/ui/Button'
import VaultHorizontalVaultShell from '@/components/ui/VaultHorizontalVaultShell'

interface STORMBalanceProps {
  walletAddress: string
  refreshInterval?: number
  compact?: boolean
  onReadWhitepaper?: () => void
  /** Hub only: fold “Add USDC” into this card so tokens + stablecoin live in one place */
  showBuyUsdc?: boolean
}

export default function STORMBalance({
  walletAddress,
  refreshInterval = 60000,
  compact = false,
  onReadWhitepaper,
  showBuyUsdc = false,
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
        <div className='flex items-center gap-2'>
          <StormTokenMark size='xs' />
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
        className='flex items-center gap-2'
        title={`STORM Token Balance: ${displayBalance}`}
      >
        <StormTokenMark size='xs' />
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

  const isDark = theme === 'dark'

  if (loading) {
    return (
      <VaultHorizontalVaultShell isDark={isDark} layout='panel' accent='amber' contentClassName='p-4 sm:p-5 lg:p-6'>
        <BlockCard variant='embed' icon={Coins} title='STORM' description='Storm Token — loading balances'>
          <div className='flex items-center gap-3'>
            <StormTokenMark size='md' />
            <div className='flex-1'>
              <div
                className={`h-4 w-20 rounded animate-pulse ${
                  isDark ? 'bg-gray-700' : 'bg-gray-200'
                }`}
              />
              <div
                className={`h-3 w-16 rounded animate-pulse mt-2 ${
                  isDark ? 'bg-gray-700' : 'bg-gray-200'
                }`}
              />
            </div>
          </div>
        </BlockCard>
      </VaultHorizontalVaultShell>
    )
  }

  if (error) {
    return (
      <VaultHorizontalVaultShell isDark={isDark} layout='panel' accent='amber' contentClassName='p-4 sm:p-5 lg:p-6'>
        <BlockCard
          variant='embed'
          icon={Coins}
          title='STORM'
          description='Could not load balance — try again.'
          headerActions={
            <Button
              type='button'
              variant='ghost'
              size='sm'
              className='shrink-0 text-amber-600 dark:text-amber-300'
              onClick={handleRefresh}
              title='Refresh balance'
            >
              <RefreshCw className='w-4 h-4' />
            </Button>
          }
        >
          <p className={`text-sm ${isDark ? 'text-red-300' : 'text-red-700'}`}>{error}</p>
        </BlockCard>
      </VaultHorizontalVaultShell>
    )
  }

  return (
    <VaultHorizontalVaultShell isDark={isDark} layout='panel' accent='amber' contentClassName='p-4 sm:p-5 lg:p-6'>
      <BlockCard
        variant='embed'
        icon={Coins}
        title='STORM'
        description='Storm Token on Base — Sepolia and mainnet.'
        headerActions={
          <Button
            type='button'
            variant='ghost'
            size='sm'
            className='shrink-0 text-amber-700 dark:text-amber-300'
            onClick={handleRefresh}
            title='Refresh balance'
          >
            <RefreshCw className='w-4 h-4' />
          </Button>
        }
      >
      {/* Balance rows */}
      <div className='space-y-2'>
        {/* Base Sepolia (currently active for testnet) */}
        <div
          className={`flex items-center justify-between p-2.5 rounded-xl ${
            isDark ? 'bg-amber-500/15' : 'bg-amber-50 dark:bg-amber-500/10'
          }`}
        >
          <div className='flex items-center gap-2'>
            <div
              className={`w-2 h-2 rounded-full shrink-0 ${
                isDark ? 'bg-amber-400' : 'bg-amber-500'
              }`}
            />
            <span
              className={`text-sm ${
                isDark ? 'text-gray-300' : 'text-gray-600 dark:text-gray-300'
              }`}
            >
              Sepolia
            </span>
          </div>
          <span
            className={`text-sm font-bold ${
              isDark ? 'text-amber-300' : 'text-amber-700 dark:text-amber-300'
            }`}
          >
            {balanceSepolia} STORM
          </span>
        </div>

        {/* Base Mainnet (coming soon) */}
        <div
          className={`flex items-center justify-between p-2.5 rounded-xl ${
            isDark ? 'bg-gray-700/30' : 'bg-gray-100 dark:bg-gray-700/30'
          }`}
        >
          <div className='flex items-center gap-2'>
            <div
              className={`w-2 h-2 rounded-full ${
                isDark ? 'bg-gray-500' : 'bg-gray-400 dark:bg-gray-500'
              }`}
            />
            <span
              className={`text-sm ${
                isDark ? 'text-gray-400' : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              Mainnet
            </span>
          </div>
          <span
            className={`text-sm ${
              isDark ? 'text-gray-500' : 'text-gray-400 dark:text-gray-500'
            }`}
          >
            {balanceMainnet !== '0.00' ? `${balanceMainnet} STORM` : 'Soon'}
          </span>
        </div>
      </div>

      {showBuyUsdc && (
        <div
          className={`mt-3 pt-3 border-t border-gray-200 dark:border-gray-700/50`}
        >
          <h3
            className={`text-sm font-semibold mb-1 ${
              isDark ? 'text-gray-100' : 'text-gray-900 dark:text-gray-100'
            }`}
          >
            Add USDC
          </h3>
          <p
            className={`text-xs mb-3 ${
              isDark ? 'text-gray-400' : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            Card purchase settles on Base mainnet; this app runs on Base Sepolia — use Wallet → Send to move funds for testnet.
          </p>
          <BuyUSDCButton walletAddress={walletAddress} />
        </div>
      )}

      {/* Footer row: contract link + whitepaper */}
      <div className='mt-3 pt-3 border-t border-gray-200 dark:border-gray-700/50 flex items-center justify-between gap-2 flex-wrap'>
        {STORM_TOKEN_ADDRESS_SEPOLIA && (
          <a
            href={`https://sepolia.basescan.org/address/${STORM_TOKEN_ADDRESS_SEPOLIA}`}
            target='_blank'
            rel='noopener noreferrer'
            className={`inline-flex items-center gap-1 text-xs ${
              isDark
                ? 'text-gray-500 hover:text-gray-300'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300'
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
            type='button'
            onClick={onReadWhitepaper}
            className={`inline-flex items-center gap-1 text-xs font-medium transition-colors ${
              isDark
                ? 'text-teal-400 hover:text-teal-300'
                : 'text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300'
            }`}
          >
            <FileText className='w-3 h-3' />
            Whitepaper
          </button>
        )}
      </div>
      </BlockCard>
    </VaultHorizontalVaultShell>
  )
}
