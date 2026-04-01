'use client'

/**
 * Buy USDC Button
 *
 * Simple button that opens the Coinbase Onramp experience.
 * Users can buy USDC directly with a credit/debit card.
 *
 * Requires Coinbase Developer Platform credentials to be configured.
 */

import { useState } from 'react'
import { CreditCard, Loader2, ExternalLink, AlertCircle } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'

interface BuyUSDCButtonProps {
  walletAddress: string
  onSuccess?: () => void
  onError?: (error: string) => void
  className?: string
}

// Coinbase Onramp base URL
const ONRAMP_BASE_URL = 'https://pay.coinbase.com/buy/select-asset'

export default function BuyUSDCButton({
  walletAddress,
  onSuccess,
  onError,
  className = '',
}: BuyUSDCButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { theme } = useTheme()

  const handleBuyClick = async () => {
    if (!walletAddress) {
      setError('Wallet address not available')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Request a session token from our backend
      const response = await fetch('/api/onramp/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress }),
      })

      const data = await response.json()

      if (!response.ok) {
        // Check if it's a configuration error
        if (response.status === 503) {
          setError('Coinbase Onramp not yet configured. Coming soon!')
          onError?.('Not configured')
          return
        }
        throw new Error(data.error || 'Failed to start purchase')
      }

      if (!data.sessionToken) {
        throw new Error('No session token received')
      }

      // Build the onramp URL with the session token
      const params = new URLSearchParams({
        sessionToken: data.sessionToken,
        defaultAsset: 'USDC',
        defaultNetwork: 'base', // Base Mainnet (Coinbase Onramp only supports mainnet)
        presetFiatAmount: '25', // Default to $25 purchase
      })

      const onrampUrl = `${ONRAMP_BASE_URL}?${params.toString()}`

      // Open in a popup window for better UX
      const popup = window.open(
        onrampUrl,
        'coinbase-onramp',
        'width=450,height=700,scrollbars=yes,resizable=yes'
      )

      if (!popup) {
        // Fallback to new tab if popup blocked
        window.open(onrampUrl, '_blank')
      }

      onSuccess?.()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Purchase failed'
      setError(message)
      onError?.(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className='flex flex-col gap-2'>
      <button
        onClick={handleBuyClick}
        disabled={isLoading || !walletAddress}
        className={`
          flex items-center justify-center gap-2 px-4 py-2.5 
          rounded-lg font-semibold text-sm
          transition-all duration-200
          ${
            theme !== 'dark'
              ? 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-300 disabled:text-gray-500'
              : 'bg-blue-500 hover:bg-blue-600 text-white disabled:bg-gray-700 disabled:text-gray-500'
          }
          ${isLoading ? 'cursor-wait' : 'cursor-pointer'}
          ${className}
        `}
      >
        {isLoading ? (
          <>
            <Loader2 className='w-4 h-4 animate-spin' />
            <span>Opening...</span>
          </>
        ) : (
          <>
            <CreditCard className='w-4 h-4' />
            <span>Buy USDC</span>
            <ExternalLink className='w-3 h-3 opacity-70' />
          </>
        )}
      </button>

      {error && (
        <div
          className={`flex items-center gap-1.5 text-xs ${
            theme !== 'dark' ? 'text-amber-600' : 'text-amber-400'
          }`}
        >
          <AlertCircle className='w-3 h-3' />
          <span>{error}</span>
        </div>
      )}

      <p
        className={`text-xs ${
          theme !== 'dark' ? 'text-gray-500' : 'text-gray-400'
        }`}
      >
        Buy with card via Coinbase
      </p>
    </div>
  )
}
