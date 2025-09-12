'use client'

import React, { useState, useEffect } from 'react'
import { baseProvider } from '@/lib/base-account-sdk'

interface MagicSpendButtonProps {
  amount: string
  recipient: string
  onMagicSpendAvailable?: (available: boolean) => void
  onTransactionCreated?: (transaction: any) => void
  className?: string
  children?: React.ReactNode
}

export const MagicSpendButton: React.FC<MagicSpendButtonProps> = ({
  amount,
  recipient,
  onMagicSpendAvailable,
  onTransactionCreated,
  className = '',
  children,
}) => {
  const [isMagicSpendAvailable, setIsMagicSpendAvailable] = useState<
    boolean | null
  >(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [userAddress, setUserAddress] = useState<string>('')

  // Check for MagicSpend capability on component mount
  useEffect(() => {
    if (baseProvider) {
      checkMagicSpendCapability()
    }
  }, [baseProvider])

  const checkMagicSpendCapability = async () => {
    if (!baseProvider) return

    setIsLoading(true)
    setError('')

    try {
      console.log('🔍 Checking MagicSpend capability...')

      // Get user address first
      const accounts = await baseProvider.request({ method: 'eth_accounts' })
      if (accounts && accounts.length > 0) {
        setUserAddress(accounts[0])
      }

      // Check wallet capabilities for auxiliaryFunds
      const capabilities = await baseProvider.request({
        method: 'wallet_getCapabilities',
      })

      console.log('📋 Wallet capabilities:', capabilities)

      // Check if auxiliaryFunds capability is supported
      const hasAuxiliaryFunds =
        capabilities &&
        capabilities[84532] && // Base Sepolia chain ID
        capabilities[84532].capabilities &&
        capabilities[84532].capabilities.auxiliaryFunds

      console.log(
        '✨ MagicSpend (auxiliaryFunds) available:',
        hasAuxiliaryFunds
      )

      setIsMagicSpendAvailable(!!hasAuxiliaryFunds)
      onMagicSpendAvailable?.(!!hasAuxiliaryFunds)
    } catch (error: any) {
      console.error('❌ Failed to check MagicSpend capability:', error)
      setError(`Failed to check MagicSpend: ${error.message}`)
      setIsMagicSpendAvailable(false)
      onMagicSpendAvailable?.(false)
    } finally {
      setIsLoading(false)
    }
  }

  const handleMagicSpendTransaction = async () => {
    if (!baseProvider || !userAddress) {
      setError('Wallet not connected')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      console.log('✨ Creating MagicSpend transaction...', {
        amount,
        recipient,
      })

      // Create a transaction that will use auxiliary funds
      const transaction = {
        from: userAddress,
        to: recipient,
        value: amount, // Amount in ETH/wei
        gas: '21000', // Standard transfer gas
        gasPrice: '0x0', // Let the wallet handle gas pricing with auxiliary funds
      }

      console.log('✅ MagicSpend transaction created:', transaction)
      onTransactionCreated?.(transaction)

      // Note: The actual transaction sending would be handled by the parent component
      // This component just creates the transaction structure
    } catch (error: any) {
      console.error('❌ Failed to create MagicSpend transaction:', error)
      setError(`Failed to create transaction: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const getButtonText = () => {
    if (isLoading) return 'Checking...'
    if (isMagicSpendAvailable === null) return 'Check MagicSpend'
    if (isMagicSpendAvailable) return '✨ Use MagicSpend'
    return 'MagicSpend Not Available'
  }

  const getButtonColor = () => {
    if (isMagicSpendAvailable === null) return 'bg-gray-600 hover:bg-gray-700'
    if (isMagicSpendAvailable) return 'bg-purple-600 hover:bg-purple-700'
    return 'bg-gray-400 cursor-not-allowed'
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* MagicSpend Status */}
      <div
        className={`p-3 rounded-md border ${
          isMagicSpendAvailable === null
            ? 'bg-gray-50 border-gray-200'
            : isMagicSpendAvailable
              ? 'bg-purple-50 border-purple-200'
              : 'bg-red-50 border-red-200'
        }`}
      >
        <div className='flex items-center gap-2'>
          {isMagicSpendAvailable === null && (
            <div className='w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin'></div>
          )}
          {isMagicSpendAvailable === true && (
            <span className='text-purple-600'>✨</span>
          )}
          {isMagicSpendAvailable === false && (
            <span className='text-red-600'>❌</span>
          )}
          <span
            className={`text-sm font-medium ${
              isMagicSpendAvailable === null
                ? 'text-gray-700'
                : isMagicSpendAvailable
                  ? 'text-purple-800'
                  : 'text-red-800'
            }`}
          >
            {isMagicSpendAvailable === null
              ? 'Checking MagicSpend capability...'
              : isMagicSpendAvailable
                ? 'MagicSpend Available - Pay with Coinbase USDC balance'
                : 'MagicSpend Not Available'}
          </span>
        </div>

        {isMagicSpendAvailable && (
          <p className='text-xs text-purple-600 mt-1'>
            You can pay transaction fees using your Coinbase USDC balance, even
            with zero ETH
          </p>
        )}

        {isMagicSpendAvailable === false && (
          <p className='text-xs text-red-600 mt-1'>
            MagicSpend requires Base Account SDK with auxiliaryFunds capability
          </p>
        )}
      </div>

      {/* MagicSpend Button */}
      <button
        onClick={handleMagicSpendTransaction}
        disabled={isLoading || !isMagicSpendAvailable}
        className={`w-full flex items-center justify-center gap-2 px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${getButtonColor()}`}
      >
        {isLoading ? (
          <>
            <div className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin'></div>
            {getButtonText()}
          </>
        ) : (
          <>
            {isMagicSpendAvailable && <span>✨</span>}
            {children || getButtonText()}
          </>
        )}
      </button>

      {/* Error Display */}
      {error && (
        <div className='p-3 bg-red-50 border border-red-200 rounded-md'>
          <p className='text-sm text-red-800'>{error}</p>
        </div>
      )}

      {/* MagicSpend Info */}
      {isMagicSpendAvailable && (
        <div className='p-3 bg-purple-50 border border-purple-200 rounded-md'>
          <h4 className='text-sm font-medium text-purple-800 mb-2'>
            What is MagicSpend?
          </h4>
          <ul className='text-xs text-purple-700 space-y-1'>
            <li>• Pay transaction fees with your Coinbase USDC balance</li>
            <li>• No need to hold ETH for gas fees</li>
            <li>• Automatic conversion from USDC to ETH for gas</li>
            <li>• Seamless user experience</li>
          </ul>
        </div>
      )}

      {/* Refresh Button */}
      <button
        onClick={checkMagicSpendCapability}
        disabled={isLoading}
        className='w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
      >
        {isLoading ? (
          <>
            <div className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin'></div>
            Checking...
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
            Refresh MagicSpend Status
          </>
        )}
      </button>
    </div>
  )
}

export default MagicSpendButton
