'use client'

/**
 * MVR Payment Button Component
 * 
 * Safely handles USDC payments for MVR orders using Alchemy Smart Wallets.
 * Only renders when authentication is fully initialized to prevent auth conflicts.
 */

import { useState, useEffect } from 'react'
import { useSignerStatus, useSmartAccountClient, useSendCalls, useUser } from '@account-kit/react'
import { encodeFunctionData, parseAbi } from 'viem'
import { useTheme } from '@/contexts/ThemeContext'
import { getUSDCTransferHistory } from '@/lib/alchemy-transfers-api'

interface MvrConfig {
  usdcAddress: string
  decimals: number
  treasuryAddress: string
  priceUsdc: string
}

interface MvrPaymentButtonProps {
  onPaymentSuccess?: (txHash: string) => void
  onPaymentError?: (error: string) => void
  disabled?: boolean
}

export default function MvrPaymentButton({ 
  onPaymentSuccess, 
  onPaymentError,
  disabled = false 
}: MvrPaymentButtonProps) {
  const { isConnected, isInitializing } = useSignerStatus()
  const { client } = useSmartAccountClient({ type: 'LightAccount' })
  const { sendCalls, isPending } = useSendCalls({ client })
  const { theme } = useTheme()
  const user = useUser()

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

    if (!sendCalls) {
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

      console.log('💳 [MVR PAYMENT] Calling sendCalls...')

      // Send the transaction via Alchemy Smart Wallet
      const result = await sendCalls({
        calls: [
          {
            to: config.usdcAddress as `0x${string}`,
            data: callData,
          },
        ],
      })

      console.log('💳 [MVR PAYMENT] sendCalls result:', result)
      console.log('💳 [MVR PAYMENT] Result type:', typeof result)
      if (result) {
        console.log('💳 [MVR PAYMENT] Result keys:', Object.keys(result))
      }
      
      // Extract transaction hash from result
      // Alchemy Account Kit's sendCalls can return:
      // - A string (the hash directly)
      // - An object with hash/userOpHash property
      // - undefined (if the call hasn't been processed yet)
      let txHash: string | null = null
      
      if (result === undefined || result === null) {
        // Fallback: If result is undefined, we poll for the transaction
        console.warn('⚠️ sendCalls returned undefined - polling for transaction...')
        
        // Wait a moment for the transaction to propagate
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        // Poll for the latest USDC transfer matching our criteria
        let foundTx = false
        let attempts = 0
        const maxAttempts = 10 // 20 seconds total
        
        while (!foundTx && attempts < maxAttempts) {
          try {
            // Check recent USDC transfers
            const history = await getUSDCTransferHistory(
              user?.address || '',
              config.usdcAddress,
              { maxCount: 5 }
            )
            
            if (history.success && history.transfers.length > 0) {
              // Look for a transfer that matches:
              // 1. To the treasury address
              // 2. Created very recently (we can't easily check timestamp precision, so we take the latest)
              // 3. Amount matches roughly (ignoring decimals precision issues)
              
              const recentTransfer = history.transfers.find(t => 
                t.to.toLowerCase() === config.treasuryAddress.toLowerCase() &&
                // Check if value is close to expected amount (allowing for small diffs)
                Math.abs(t.value - parseFloat(config.priceUsdc)) < 0.0001
              )
              
              if (recentTransfer) {
                console.log('✅ Found matching transaction via polling:', recentTransfer.hash)
                txHash = recentTransfer.hash
                foundTx = true
                break
              }
            }
          } catch (pollErr) {
            console.warn('Polling error:', pollErr)
          }
          
          attempts++
          if (!foundTx) {
            await new Promise(resolve => setTimeout(resolve, 2000))
          }
        }
        
        if (!txHash) {
          throw new Error('Transaction was submitted but hash could not be retrieved. Please check your wallet history.')
        }
      }
      
      if (typeof result === 'string') {
        txHash = result
      } else if (result && typeof result === 'object') {
        txHash = (result as any).hash || (result as any).userOpHash || (result as any).txHash || null
      }
      
      if (!txHash || txHash === 'pending') {
        // One last check if we didn't get it from the result object directly
        if (!txHash) {
             throw new Error('Transaction hash not available. The transaction may still be processing.')
        }
      }

      // Record payment in database
      try {
        const paymentResponse = await fetch('/api/mvr/payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            txHash,
            amountUsdc: config.priceUsdc,
            walletAddress: user?.address,
          }),
        })

        if (!paymentResponse.ok) {
          console.warn('⚠️ Payment recorded in blockchain but failed to save to database')
        }
      } catch (err) {
        console.error('⚠️ Error recording payment:', err)
        // Don't fail the payment if DB recording fails - blockchain payment succeeded
      }

      setSuccess(true)
      onPaymentSuccess?.(txHash)
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

