'use client'

/**
 * MVR Payment Button Component
 * 
 * Safely handles USDC payments for MVR orders using Alchemy Smart Wallets.
 * Only renders when authentication is fully initialized to prevent auth conflicts.
 */

import { useState, useEffect } from 'react'
import { useSignerStatus, useSmartAccountClient, useSendCalls, useAccount } from '@account-kit/react'
import { encodeFunctionData, parseAbi } from 'viem'
import { useTheme } from '@/contexts/ThemeContext'

interface MvrConfig {
  usdcAddress: string
  decimals: number
  treasuryAddress: string
  priceUsdc: string
}

interface MvrPaymentButtonProps {
  userAddress?: string // Explicitly pass wallet address to ensure consistency
  onPaymentSuccess?: (txHash: string) => void
  onPaymentError?: (error: string) => void
  disabled?: boolean
  /** 'applicant' = 1x Storm reward, 'employer' = 0.5x. Defaults to 'applicant'. */
  userType?: 'applicant' | 'employer'
}

export default function MvrPaymentButton({ 
  userAddress,
  onPaymentSuccess, 
  onPaymentError,
  disabled = false,
  userType = 'applicant',
}: MvrPaymentButtonProps) {
  const { isConnected, isInitializing } = useSignerStatus()
  const { client } = useSmartAccountClient({ type: 'LightAccount' })
  const { sendCallsAsync, isPending } = useSendCalls({ client })
  const { theme } = useTheme()
  
  // IMPORTANT: Use useAccount to get the SMART WALLET address, not useUser
  // useUser() returns the signer (EOA) address, which is different from the smart wallet
  const account = useAccount({ type: 'LightAccount' })
  
  // Use explicit userAddress prop if provided, otherwise use the smart account address
  const walletAddress = userAddress || account?.address

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
    if (!client || !config) {
      setError('Payment service not ready. Please try again.')
      return
    }

    if (!sendCallsAsync || !client) {
      setError('Transaction service not available. Please refresh and try again.')
      return
    }

    setIsLoading(true)
    setError(null)
    setSuccess(false)

    try {
      // Calculate amount in raw USDC (6 decimals)
      const amountRaw = BigInt(Math.floor(parseFloat(config.priceUsdc) * 10 ** config.decimals))

      console.log('💳 [MVR PAYMENT] Initiating payment:', {
        amount: config.priceUsdc,
        amountRaw: amountRaw.toString(),
        to: config.treasuryAddress,
        usdcAddress: config.usdcAddress,
      })

      // Encode ERC-20 transfer function call
      const transferAbi = parseAbi([
        'function transfer(address to, uint256 amount) returns (bool)',
      ])

      const callData = encodeFunctionData({
        abi: transferAbi,
        functionName: 'transfer',
        args: [config.treasuryAddress as `0x${string}`, amountRaw],
      })

      console.log('💳 [MVR PAYMENT] Calling sendCallsAsync...')

      // Send the transaction via Alchemy Smart Wallet
      const result = await sendCallsAsync({
        calls: [
          {
            to: config.usdcAddress as `0x${string}`,
            data: callData,
          },
        ],
      })

      console.log('💳 [MVR PAYMENT] Transaction sent, call IDs:', result.ids)
      
      // Get the call ID to wait for status
      const callId = result.ids[0]

      // Wait for transaction confirmation using client.waitForCallsStatus
      let txHash: string
      try {
        console.log('⏳ [MVR PAYMENT] Waiting for transaction confirmation...')
        
        // Check if waitForCallsStatus is available on the client
        if (client && typeof client.waitForCallsStatus === 'function') {
          const statusResult = await client.waitForCallsStatus({ id: callId })
          
          console.log('✅ [MVR PAYMENT] Transaction status:', statusResult)
          
          // Extract transaction hash from status result
          txHash = 
            statusResult?.status === 'CONFIRMED' 
              ? (statusResult.transactions?.[0]?.hash || 
                 statusResult.hash || 
                 statusResult.transactionHash || 
                 callId)
              : callId // Fallback to call ID if we can't extract hash
          
          console.log('✅ [MVR PAYMENT] Transaction hash:', txHash)
        } else {
          // If method not available, use call ID as transaction reference
          console.log('ℹ️ [MVR PAYMENT] waitForCallsStatus not available, using call ID as transaction reference')
          txHash = callId
        }
      } catch (waitErr) {
        // If waiting fails, still use the call ID as the hash
        // The transaction was submitted successfully, even if we can't confirm it
        console.warn('⚠️ [MVR PAYMENT] Could not wait for confirmation, but transaction was sent:', waitErr)
        txHash = callId
      }

      // Record payment in database
      let savedPaymentTxHash = txHash
      try {
        const paymentResponse = await fetch('/api/mvr/payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            txHash,
            amountUsdc: config.priceUsdc,
            walletAddress: walletAddress,
            userType,
          }),
        })

        if (!paymentResponse.ok) {
          console.warn('⚠️ Payment recorded in blockchain but failed to save to database')
        } else {
          const paymentData = await paymentResponse.json()
          console.log('✅ [MVR PAYMENT] Payment saved to database:', paymentData)
          // Use the saved hash from the database (which may be truncated to 66 chars)
          savedPaymentTxHash = paymentData.payment?.txHash || txHash
        }
      } catch (err) {
        console.error('⚠️ Error recording payment:', err)
        // Don't fail the payment if DB recording fails - blockchain payment succeeded
      }

      setSuccess(true)
      // Pass the saved hash (may be truncated) to the form so it can find the payment
      onPaymentSuccess?.(savedPaymentTxHash)
    } catch (err) {
      console.error('❌ MVR payment error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Payment failed'
      setError(errorMessage)
      onPaymentError?.(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const buttonClasses = `w-full md:w-auto px-6 py-2.5 text-sm font-semibold rounded-xl border transition-all duration-300 ${
    isLoading || isPending
      ? theme === 'light'
        ? 'text-gray-400 bg-gray-100 border-gray-200 cursor-not-allowed'
        : 'text-gray-500 bg-gray-800 border-gray-700 cursor-not-allowed'
      : success
        ? theme === 'light'
          ? 'text-white bg-green-600 hover:bg-green-700 border-green-600 shadow-lg'
          : 'text-white bg-green-600/80 hover:bg-green-600 border-green-500 shadow-lg'
        : theme === 'light'
          ? 'text-white bg-teal-600 hover:bg-teal-700 border-teal-600 hover:border-teal-700 shadow-lg hover:shadow-xl hover:scale-105 cursor-pointer'
          : 'text-white bg-teal-600/80 hover:bg-teal-700 border-teal-500/50 hover:border-teal-500 shadow-lg hover:shadow-xl hover:scale-105 cursor-pointer'
  }`

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handlePayment}
        disabled={isLoading || isPending || !config || disabled}
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

