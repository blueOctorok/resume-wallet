'use client'

/**
 * StormiCreditModal — USDC payment flow for Stormi chat credit packs.
 * Follows the same Alchemy Smart Wallet pattern as MvrPaymentButton.
 */

import { useState, useEffect } from 'react'
import { useSignerStatus, useSmartAccountClient, useSendCalls } from '@account-kit/react'
import { encodeFunctionData, parseAbi } from 'viem'
import { X, Coins, Loader2, Check, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import { STORMI_CREDIT_PACKS, type StormiCreditPackId } from '@/lib/ava-usage'
import type { StormiUsageInfo } from '@/lib/ava-chat'

interface StormiCreditModalProps {
  walletAddress: string | null
  onClose: () => void
  onSuccess: (usage: StormiUsageInfo) => void
}

interface PaymentConfig {
  usdcAddress: string
  decimals: number
  treasuryAddress: string
}

const PACK_META: Record<StormiCreditPackId, { label: string; badge: string | null }> = {
  starter: { label: 'Starter', badge: null },
  standard: { label: 'Standard', badge: 'Most Popular' },
  pro: { label: 'Pro', badge: 'Best Value' },
}

export default function StormiCreditModal({ walletAddress, onClose, onSuccess }: StormiCreditModalProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const { isConnected } = useSignerStatus()
  const { client } = useSmartAccountClient({ type: 'LightAccount' })
  const { sendCallsAsync, isPending } = useSendCalls({ client })

  const [config, setConfig] = useState<PaymentConfig | null>(null)
  const [selectedPack, setSelectedPack] = useState<StormiCreditPackId>('standard')
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Reuse the MVR config endpoint — it returns USDC address + treasury
  useEffect(() => {
    fetch('/api/wallet/mvr-config')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setConfig({ usdcAddress: data.usdcAddress, decimals: data.decimals, treasuryAddress: data.treasuryAddress })
      })
      .catch(() => setError('Failed to load payment configuration'))
  }, [])

  const handlePurchase = async () => {
    if (!client || !config || !sendCallsAsync || !walletAddress) return
    setIsProcessing(true)
    setError(null)

    const pack = STORMI_CREDIT_PACKS[selectedPack]
    const amountRaw = BigInt(Math.floor(parseFloat(pack.priceUsdc) * 10 ** config.decimals))

    try {
      const transferAbi = parseAbi(['function transfer(address to, uint256 amount) returns (bool)'])
      const callData = encodeFunctionData({
        abi: transferAbi,
        functionName: 'transfer',
        args: [config.treasuryAddress as `0x${string}`, amountRaw],
      })

      const result = await sendCallsAsync({
        calls: [{ to: config.usdcAddress as `0x${string}`, data: callData }],
      })

      const callId = result.ids[0]
      let txHash = callId

      // Wait for confirmation if available
      if (client && typeof client.waitForCallsStatus === 'function') {
        try {
          const statusResult = await client.waitForCallsStatus({ id: callId })
          if (statusResult?.status === 'CONFIRMED') {
            txHash = statusResult.transactions?.[0]?.hash || statusResult.hash || statusResult.transactionHash || callId
          }
        } catch {
          // Transaction was sent even if we can't confirm
        }
      }

      // Credit the user via API
      const creditRes = await fetch('/api/ai/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-wallet-address': walletAddress },
        body: JSON.stringify({ pack: selectedPack, txHash }),
      })

      if (!creditRes.ok) throw new Error('Failed to record credits')

      const creditData = await creditRes.json()
      setSuccess(true)

      setTimeout(() => {
        onSuccess({
          dailyRemaining: creditData.dailyRemaining,
          credits: creditData.credits,
          totalMessages: creditData.totalMessages,
          model: null,
        })
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed')
    } finally {
      setIsProcessing(false)
    }
  }

  const packEntries = Object.keys(STORMI_CREDIT_PACKS) as StormiCreditPackId[]

  return (
    <div className='fixed inset-0 z-[10000] flex items-center justify-center p-4'>
      {/* Backdrop */}
      <div className='absolute inset-0 bg-black/60 backdrop-blur-sm' onClick={onClose} />

      {/* Modal */}
      <div
        className={cn(
          'relative w-full max-w-md rounded-2xl border shadow-2xl',
          isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200',
        )}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className={cn(
            'absolute top-4 right-4 p-1.5 rounded-lg transition-colors',
            isDark ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-500 hover:bg-gray-100',
          )}
        >
          <X className='w-4 h-4' />
        </button>

        {/* Header */}
        <div className='px-6 pt-6 pb-4'>
          <div className='flex items-center gap-3'>
            <div
              className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center',
                isDark ? 'bg-amber-500/15' : 'bg-amber-50',
              )}
            >
              <Sparkles className={cn('w-5 h-5', isDark ? 'text-amber-400' : 'text-amber-500')} />
            </div>
            <div>
              <h3 className={cn('text-lg font-bold', isDark ? 'text-white' : 'text-gray-900')}>Stormi credits</h3>
              <p className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>
                Keep chatting with Stormi beyond your daily free messages
              </p>
            </div>
          </div>
        </div>

        {/* Pack selection */}
        <div className='px-6 space-y-2'>
          {packEntries.map((packId) => {
            const pack = STORMI_CREDIT_PACKS[packId]
            const meta = PACK_META[packId]
            const isSelected = selectedPack === packId
            const costPerMsg = (parseFloat(pack.priceUsdc) / pack.messages * 100).toFixed(1)

            return (
              <button
                key={packId}
                type='button'
                onClick={() => setSelectedPack(packId)}
                disabled={isProcessing || success}
                className={cn(
                  'w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left',
                  isSelected
                    ? isDark
                      ? 'border-amber-500 bg-amber-500/10'
                      : 'border-amber-500 bg-amber-50'
                    : isDark
                      ? 'border-gray-700 hover:border-gray-600 bg-gray-800/50'
                      : 'border-gray-200 hover:border-gray-300 bg-gray-50',
                  (isProcessing || success) && 'opacity-60 cursor-not-allowed',
                )}
              >
                <div>
                  <div className='flex items-center gap-2'>
                    <span className={cn('text-sm font-bold', isDark ? 'text-white' : 'text-gray-900')}>
                      {meta.label}
                    </span>
                    {meta.badge && (
                      <span className='text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500 text-white'>
                        {meta.badge}
                      </span>
                    )}
                  </div>
                  <span className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>
                    {pack.messages} messages &middot; {costPerMsg}&cent; each
                  </span>
                </div>
                <span className={cn('text-sm font-bold', isDark ? 'text-white' : 'text-gray-900')}>
                  ${pack.priceUsdc} USDC
                </span>
              </button>
            )
          })}
        </div>

        {/* Action */}
        <div className='px-6 pt-4 pb-6'>
          {error && (
            <p className={cn('text-xs mb-3 text-center', isDark ? 'text-red-400' : 'text-red-600')}>{error}</p>
          )}

          <button
            onClick={handlePurchase}
            disabled={!isConnected || !config || !client || isProcessing || isPending || success}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all',
              success
                ? 'bg-green-500 text-white'
                : 'bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {success ? (
              <>
                <Check className='w-4 h-4' />
                Credits Added!
              </>
            ) : isProcessing || isPending ? (
              <>
                <Loader2 className='w-4 h-4 animate-spin' />
                Processing...
              </>
            ) : (
              <>
                <Coins className='w-4 h-4' />
                Buy {STORMI_CREDIT_PACKS[selectedPack].messages} Credits for $
                {STORMI_CREDIT_PACKS[selectedPack].priceUsdc} USDC
              </>
            )}
          </button>

          <p className={cn('text-[10px] text-center mt-3', isDark ? 'text-gray-500' : 'text-gray-400')}>
            Credits never expire. USDC on Base Sepolia.
          </p>
        </div>
      </div>
    </div>
  )
}
