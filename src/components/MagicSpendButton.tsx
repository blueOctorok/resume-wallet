'use client'

import React, { useState, useEffect } from 'react'
import { baseProvider } from '@/lib/base-account-sdk'

interface MagicSpendButtonProps {
  address?: string
  amount?: string
  onSend?: () => void
  disabled?: boolean
  children?: React.ReactNode
  className?: string
}

export const MagicSpendButton: React.FC<MagicSpendButtonProps> = ({
  address,
  amount = '0',
  onSend,
  disabled = false,
  children,
  className = '',
}) => {
  const [hasAuxFunds, setHasAuxFunds] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!address) {
      setHasAuxFunds(null)
      return
    }

    checkAuxiliaryFunds()
  }, [address])

  const checkAuxiliaryFunds = async () => {
    if (!baseProvider || !address) return

    try {
      setIsLoading(true)
      const capabilities = await baseProvider.request({
        method: 'wallet_getCapabilities',
        params: [address],
      })

      const supported = capabilities?.[8453]?.auxiliaryFunds?.supported ?? false // Base Mainnet: 8453
      setHasAuxFunds(supported)
    } catch (err) {
      console.error('wallet_getCapabilities failed', err)
      setHasAuxFunds(false)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClick = () => {
    if (onSend) {
      onSend()
    }
  }

  // Determine button state
  const isDisabled = disabled || hasAuxFunds === false || isLoading

  // Determine button text
  const getButtonText = () => {
    if (isLoading) return 'Checking capabilities...'
    if (hasAuxFunds === null) return 'Connect wallet'
    if (hasAuxFunds === false) return 'Insufficient Balance'
    if (children) return children
    return `Send ${amount} USDC`
  }

  // Determine button styling
  const getButtonClasses = () => {
    const baseClasses =
      'w-full flex items-center justify-center gap-3 px-6 py-3 rounded-lg transition-colors'

    if (isDisabled) {
      return `${baseClasses} bg-gray-300 text-gray-500 cursor-not-allowed`
    }

    if (hasAuxFunds) {
      return `${baseClasses} bg-blue-600 text-white hover:bg-blue-700`
    }

    return `${baseClasses} bg-red-100 text-red-700 border border-red-200`
  }

  return (
    <div className='space-y-2'>
      <button
        onClick={handleClick}
        disabled={isDisabled}
        className={`${getButtonClasses()} ${className}`}
      >
        {isLoading ? (
          <>
            <div className='w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin'></div>
            {getButtonText()}
          </>
        ) : (
          <>
            <div className='w-5 h-5 bg-current rounded-sm'></div>
            {getButtonText()}
          </>
        )}
      </button>

      {/* Status indicator */}
      {hasAuxFunds !== null && (
        <div className='text-xs text-center'>
          {hasAuxFunds ? (
            <span className='text-green-600'>
              ✅ Can pay with Coinbase balance
            </span>
          ) : (
            <span className='text-red-600'>
              ❌ Insufficient onchain balance
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export default MagicSpendButton
