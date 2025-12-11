'use client'

import { useState, useEffect } from 'react'
import { Copy, Check } from 'lucide-react'
import { getUSDCBalance } from '@/lib/alchemy-token-api'
import { useTheme } from '@/contexts/ThemeContext'

interface WalletInfoProps {
  walletAddress: string
  refreshInterval?: number // Auto-refresh interval in milliseconds (default 30s)
  onClick?: () => void // Handler for opening wallet modal
}

export default function WalletInfo({
  walletAddress,
  refreshInterval = 30000, // 30 seconds
  onClick,
}: WalletInfoProps) {
  const { theme } = useTheme()
  const [balance, setBalance] = useState<string>('0.00')
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
      const balanceResult = await getUSDCBalance(walletAddress)
      if (balanceResult.success) {
        setBalance(balanceResult.balanceFormatted)
      } else {
        setBalance('0.00')
      }
    } catch (err) {
      console.error('Error fetching USDC balance:', err)
      setBalance('0.00')
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

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      className={`hidden md:flex items-center gap-3 px-4 py-2.5 rounded-xl backdrop-blur-xl border transition-all duration-300 shadow-lg hover:shadow-xl cursor-pointer ${
        theme === 'dark'
          ? 'bg-brand-sage-light/20 border-brand-mint/40 hover:border-brand-mint/60'
          : 'bg-white/80 border-brand-sage/40 hover:border-brand-sage/60'
      }`}
      style={{
        boxShadow:
          theme === 'dark'
            ? '0 4px 12px rgba(0, 0, 0, 0.2), 0 0 20px rgba(20, 184, 166, 0.1)'
            : '0 4px 12px rgba(0, 0, 0, 0.1), 0 0 20px rgba(107, 142, 35, 0.1)',
      }}
      aria-label="Open wallet"
    >
      {/* Wallet Address */}
      <div
        onClick={(e) => {
          e.stopPropagation() // Prevent parent onClick from firing
          handleCopyAddress()
        }}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-200 hover:scale-105 cursor-pointer ${
          theme === 'dark'
            ? 'bg-brand-sage-light/30 hover:bg-brand-sage-light/40 border border-brand-mint/30 hover:border-brand-mint/50'
            : 'bg-brand-sage/10 hover:bg-brand-sage/20 border border-brand-sage/30 hover:border-brand-sage/50'
        }`}
        title={`Click to copy full address: ${walletAddress}`}
      >
        <span
          className={`font-mono text-xs font-semibold ${
            theme === 'dark' ? 'text-brand-cream' : 'text-gray-800'
          }`}
        >
          {truncateAddress(walletAddress)}
        </span>
        {copied ? (
          <Check className={`w-3.5 h-3.5 ${
            theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'
          }`} />
        ) : (
          <Copy className={`w-3.5 h-3.5 ${
            theme === 'dark' ? 'text-brand-cream/60' : 'text-gray-600'
          }`} />
        )}
      </div>

      {/* USDC Balance */}
      <div className="flex items-center gap-2">
        <div
          className={`w-1.5 h-1.5 rounded-full ${
            theme === 'dark' ? 'bg-brand-mint' : 'bg-brand-sage'
          }`}
          style={{
            boxShadow:
              theme === 'dark'
                ? '0 0 8px rgba(20, 184, 166, 0.6)'
                : '0 0 8px rgba(107, 142, 35, 0.6)',
          }}
        />
        <div className="flex items-baseline gap-1.5">
          <span
            className={`text-xs font-medium ${
              theme === 'dark' ? 'text-brand-cream/70' : 'text-gray-600'
            }`}
          >
            USDC
          </span>
          {loading ? (
            <div
              className={`animate-spin rounded-full h-3 w-3 border-b-2 ${
                theme === 'dark' ? 'border-brand-mint' : 'border-brand-sage'
              }`}
            />
          ) : (
            <span
              className={`text-sm font-bold ${
                theme === 'dark' ? 'text-brand-cream' : 'text-gray-900'
              }`}
            >
              ${balance}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

