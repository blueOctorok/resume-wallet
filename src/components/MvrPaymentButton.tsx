'use client'

/**
 * MVR Payment Button Component
 * 
 * Safely handles USDC payments for MVR orders using Alchemy Smart Wallets.
 * Only renders when authentication is fully initialized to prevent auth conflicts.
 */

import { useState, useEffect } from 'react'
import { useSignerStatus, useSmartAccountClient, useSendCalls } from '@account-kit/react'
import { encodeFunctionData, parseAbi } from 'viem'
import { useTheme } from '@/contexts/ThemeContext'

interface MvrConfig {
  usdcAddress: string
  decimals: number
  treasuryAddress: string
  priceUsdc: string
}

export default function MvrPaymentButton() {
  const { isConnected, isInitializing } = useSignerStatus()
  const { client } = useSmartAccountClient({ type: 'LightAccount' })
  const { sendCalls, isPending } = useSendCalls({ client })
  const { theme } = useTheme()

  const [config, setConfig] = useState<MvrConfig | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Fetch MVR payment configuration
  useEffect(() => {
    if (!isConnected || isInitializing) return

    const fetchConfig = async () => {
      try {
        const response = await fetch('/api/wallet/mvr-config')
        if (!response.ok) throw new Error('Failed to fetch MVR config')
        const data = await response.json()
        setConfig(data)
      } catch (err) {
        console.error('❌ Error fetching MVR config:', err)
        setError('Failed to load payment configuration')
      }
    }

    fetchConfig()
  }, [isConnected, isInitializing])

  // Don't render during auth initialization
  if (isInitializing) {
    return null
  }

  // Don't render if not connected
  if (!isConnected) {
    return null
  }

  // Don't render if config not loaded or client not ready
  if (!config || !client) {
    return null
  }

  const handlePayment = async () => {
    if (!client || !config) return

    setIsLoading(true)
    setError(null)
    setSuccess(false)

    try {
      // Calculate amount in raw USDC (6 decimals)
      const amountRaw = BigInt(Math.floor(parseFloat(config.priceUsdc) * 10 ** config.decimals))

      // Encode ERC-20 transfer function call
      const transferAbi = parseAbi([
        'function transfer(address to, uint256 amount) returns (bool)',
      ])

      const callData = encodeFunctionData({
        abi: transferAbi,
        functionName: 'transfer',
        args: [config.treasuryAddress as `0x${string}`, amountRaw],
      })

      // Send the transaction via Alchemy Smart Wallet
      const result = await sendCalls({
        calls: [
          {
            to: config.usdcAddress as `0x${string}`,
            data: callData,
          },
        ],
      })

      console.log('✅ USDC payment transaction sent:', result)

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      console.error('❌ MVR payment error:', err)
      setError(err instanceof Error ? err.message : 'Payment failed')
    } finally {
      setIsLoading(false)
    }
  }

  const buttonClasses = `w-full md:w-auto px-6 py-2.5 text-sm font-semibold rounded-xl border transition-all duration-300 ${
    isLoading || isPending
      ? theme === 'light'
        ? 'text-gray-400 bg-gray-100 border-gray-200 cursor-not-allowed'
        : 'text-brand-cream/40 bg-brand-sage-light/10 border-brand-cream/20 cursor-not-allowed'
      : success
        ? theme === 'light'
          ? 'text-white bg-green-600 hover:bg-green-700 border-green-600 shadow-lg'
          : 'text-brand-cream bg-green-600/80 hover:bg-green-600 border-green-500 shadow-lg'
        : theme === 'light'
          ? 'text-white bg-brand-sage hover:bg-brand-sage-dark border-brand-sage hover:border-brand-sage-dark shadow-lg hover:shadow-xl hover:scale-105 cursor-pointer'
          : 'text-brand-cream bg-brand-sage-light/20 hover:bg-brand-sage-light/30 border-brand-cream/30 hover:border-brand-cream/50 shadow-lg hover:shadow-xl hover:scale-105 cursor-pointer'
  }`

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handlePayment}
        disabled={isLoading || isPending || !config}
        className={buttonClasses}
      >
        {isLoading || isPending
          ? 'Processing...'
          : success
            ? '✅ Payment Successful!'
            : `💳 Order MVR (${config.priceUsdc} USDC)`}
      </button>
      {error && (
        <p className={`text-xs ${theme === 'light' ? 'text-red-600' : 'text-red-400'}`}>
          {error}
        </p>
      )}
    </div>
  )
}

