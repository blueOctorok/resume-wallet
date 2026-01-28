'use client'

import { useState, useEffect } from 'react'
import { Copy, Check, ChevronDown, ChevronRight, Wallet } from 'lucide-react'
import {
  getUSDCBalanceMainnet,
  getUSDCBalanceSepolia,
} from '@/lib/alchemy-token-api'
import { useTheme } from '@/contexts/ThemeContext'

interface WalletInfoProps {
  walletAddress: string
  refreshInterval?: number // Auto-refresh interval in milliseconds (default 30s)
  onClick?: () => void // Handler for opening wallet modal
  /** Start expanded (default: false = collapsed) */
  defaultExpanded?: boolean
}

export default function WalletInfo({
  walletAddress,
  refreshInterval = 30000, // 30 seconds
  onClick,
  defaultExpanded = false,
}: WalletInfoProps) {
  const { theme } = useTheme()
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [balanceMainnet, setBalanceMainnet] = useState<string>('0.00')
  const [balanceSepolia, setBalanceSepolia] = useState<string>('0.00')
  const [loading, setLoading] = useState<boolean>(true)
  const [copied, setCopied] = useState<boolean>(false)

  // Truncate wallet address: first 6 chars ... last 4 chars
  const truncateAddress = (address: string) => {
    if (!address) return ''
    if (address.length <= 10) return address
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  // Copy address to clipboard
  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(walletAddress)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy address:', err)
    }
  }

  const fetchBalance = async () => {
    if (!walletAddress) {
      setLoading(false)
      return
    }

    try {
      // Fetch both Mainnet and Sepolia balances in parallel
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
    } catch (err) {
      console.error('Error fetching USDC balances:', err)
      setBalanceMainnet('0.00')
      setBalanceSepolia('0.00')
    } finally {
      setLoading(false)
    }
  }

  // Initial fetch
  useEffect(() => {
    fetchBalance()
  }, [walletAddress])

  // Auto-refresh
  useEffect(() => {
    if (refreshInterval > 0 && walletAddress) {
      const interval = setInterval(fetchBalance, refreshInterval)
      return () => clearInterval(interval)
    }
  }, [refreshInterval, walletAddress])

  const baseBoxClasses = `hidden md:flex flex-col rounded-xl backdrop-blur-xl border transition-all duration-300 shadow-lg overflow-hidden ${
    theme === 'dark'
      ? 'bg-brand-sage-light/20 border-brand-mint/40'
      : 'bg-white/80 border-brand-sage/40'
  }`
  const boxShadowStyle =
    theme === 'dark'
      ? '0 4px 12px rgba(0, 0, 0, 0.2), 0 0 20px rgba(20, 184, 166, 0.1)'
      : '0 4px 12px rgba(0, 0, 0, 0.1), 0 0 20px rgba(107, 142, 35, 0.1)'

  return (
    <div className={baseBoxClasses} style={{ boxShadow: boxShadowStyle }}>
      {/* Collapsible header: "Wallet" + chevron */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          setExpanded((prev) => !prev)
        }}
        className={`flex items-center gap-2 px-4 py-2.5 w-full text-left hover:opacity-90 transition-opacity ${
          theme === 'dark'
            ? 'hover:bg-brand-sage-light/10'
            : 'hover:bg-brand-sage/10'
        }`}
        aria-expanded={expanded}
        aria-label={expanded ? 'Collapse wallet' : 'Expand wallet'}
      >
        <Wallet
          className={`w-4 h-4 ${theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'}`}
        />
        <span
          className={`text-sm font-semibold ${theme === 'dark' ? 'text-brand-cream' : 'text-gray-800'}`}
        >
          Wallet
        </span>
        {expanded ? (
          <ChevronDown
            className={`w-4 h-4 ml-auto ${theme === 'dark' ? 'text-brand-cream/60' : 'text-gray-500'}`}
          />
        ) : (
          <ChevronRight
            className={`w-4 h-4 ml-auto ${theme === 'dark' ? 'text-brand-cream/60' : 'text-gray-500'}`}
          />
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div
          className={`flex flex-col gap-3 px-4 pb-4 pt-0 border-t ${
            theme === 'dark' ? 'border-brand-mint/20' : 'border-brand-sage/20'
          }`}
        >
          {/* Click row to open full wallet modal */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onClick?.()
            }}
            className='text-left text-xs text-brand-mint hover:underline'
          >
            Open full wallet →
          </button>

          {/* Wallet Address (copy on click) */}
          <div
            onClick={(e) => {
              e.stopPropagation()
              handleCopyAddress()
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-200 hover:scale-[1.02] cursor-pointer ${
              theme === 'dark'
                ? 'bg-brand-sage-light/30 hover:bg-brand-sage-light/40 border border-brand-mint/30'
                : 'bg-brand-sage/10 hover:bg-brand-sage/20 border border-brand-sage/30'
            }`}
            title={`Click to copy: ${walletAddress}`}
          >
            <span
              className={`font-mono text-xs font-semibold ${theme === 'dark' ? 'text-brand-cream' : 'text-gray-800'}`}
            >
              {truncateAddress(walletAddress)}
            </span>
            {copied ? (
              <Check
                className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'}`}
              />
            ) : (
              <Copy
                className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-brand-cream/60' : 'text-gray-600'}`}
              />
            )}
          </div>

          {/* USDC Balances */}
          <div className='flex items-center gap-4'>
            <div className='flex items-center gap-1.5'>
              <div
                className={`w-1.5 h-1.5 rounded-full ${theme === 'dark' ? 'bg-green-400' : 'bg-green-600'}`}
                style={{
                  boxShadow:
                    theme === 'dark'
                      ? '0 0 8px rgba(74, 222, 128, 0.6)'
                      : '0 0 8px rgba(22, 163, 74, 0.6)',
                }}
              />
              <span
                className={`text-xs ${theme === 'dark' ? 'text-brand-cream/70' : 'text-gray-600'}`}
              >
                Base
              </span>
              {loading ? (
                <div
                  className={`animate-spin rounded-full h-3 w-3 border-b-2 ${theme === 'dark' ? 'border-green-400' : 'border-green-600'}`}
                />
              ) : (
                <span
                  className={`text-xs font-bold ${theme === 'dark' ? 'text-green-400' : 'text-green-700'}`}
                >
                  ${balanceMainnet}
                </span>
              )}
            </div>
            <div className='flex items-center gap-1.5'>
              <div
                className={`w-1.5 h-1.5 rounded-full ${theme === 'dark' ? 'bg-blue-400' : 'bg-blue-600'}`}
                style={{
                  boxShadow:
                    theme === 'dark'
                      ? '0 0 8px rgba(96, 165, 250, 0.6)'
                      : '0 0 8px rgba(37, 99, 235, 0.6)',
                }}
              />
              <span
                className={`text-xs ${theme === 'dark' ? 'text-brand-cream/70' : 'text-gray-600'}`}
              >
                Sepolia
              </span>
              {loading ? (
                <div
                  className={`animate-spin rounded-full h-3 w-3 border-b-2 ${theme === 'dark' ? 'border-blue-400' : 'border-blue-600'}`}
                />
              ) : (
                <span
                  className={`text-xs font-bold ${theme === 'dark' ? 'text-blue-400' : 'text-blue-700'}`}
                >
                  ${balanceSepolia}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
