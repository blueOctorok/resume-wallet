'use client'

import { useState } from 'react'
import {
  useSignerStatus,
  useSmartAccountClient,
  useSendCalls,
} from '@account-kit/react'
import { encodeFunctionData, parseAbi, isAddress, parseUnits } from 'viem'
import { useTheme } from '@/contexts/ThemeContext'
import {
  getSTORMBalanceSepolia,
  STORM_TOKEN_ADDRESS_SEPOLIA,
} from '@/lib/alchemy-token-api'
import { policyId } from '@/lib/alchemy-account-config'
import { ExternalLink, AlertCircle, CheckCircle } from 'lucide-react'
import StormTokenMark from '@/components/ui/StormTokenMark'

interface SendSTORMProps {
  walletAddress: string
  onSuccess?: () => void
}

export default function SendSTORM({ walletAddress, onSuccess }: SendSTORMProps) {
  const { isConnected } = useSignerStatus()
  const { client } = useSmartAccountClient({ type: 'LightAccount' })
  const { sendCallsAsync, isPending } = useSendCalls({ client })
  const { theme } = useTheme()

  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [txHash, setTxHash] = useState<string | null>(null)

  // STORM token has 18 decimals (standard ERC20)
  const STORM_DECIMALS = 18

  // Card styling (matches hub)
  const cardClass = `rounded-2xl border transition-all duration-200 ${
    theme === 'dark'
      ? 'bg-gray-800/50 border-gray-700'
      : 'bg-white/70 border-gray-200'
  }`

  const inputClass = `w-full px-4 py-3 rounded-xl border text-sm transition-colors ${
    theme === 'dark'
      ? 'bg-gray-900/50 border-gray-600 text-gray-200 placeholder-gray-500 focus:border-yellow-500'
      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-yellow-500'
  } focus:outline-none focus:ring-2 focus:ring-yellow-500/20`

  const validateForm = (): boolean => {
    if (!recipient.trim()) {
      setError('Please enter a recipient address')
      return false
    }

    if (!isAddress(recipient)) {
      setError('Invalid wallet address')
      return false
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount')
      return false
    }

    if (!STORM_TOKEN_ADDRESS_SEPOLIA) {
      setError('STORM token not configured')
      return false
    }

    setError(null)
    return true
  }

  const handleSend = async () => {
    if (!validateForm() || !client || !isConnected) return

    setIsLoading(true)
    setError(null)
    setSuccess(false)

    try {
      // Check STORM balance first
      const balanceResult = await getSTORMBalanceSepolia(walletAddress)
      if (!balanceResult.success) {
        setError('Failed to check STORM balance. Please try again.')
        return
      }

      const currentBalance = parseFloat(
        balanceResult.balanceFormatted.replace(/,/g, '')
      )
      const sendAmount = parseFloat(amount)

      if (sendAmount > currentBalance) {
        setError(
          `Insufficient balance. You have ${currentBalance.toLocaleString()} STORM`
        )
        return
      }

      // Calculate amount in raw STORM (18 decimals)
      const amountRaw = parseUnits(amount, STORM_DECIMALS)

      // Encode ERC-20 transfer function call
      const transferAbi = parseAbi([
        'function transfer(address to, uint256 amount) returns (bool)',
      ])

      const callData = encodeFunctionData({
        abi: transferAbi,
        functionName: 'transfer',
        args: [recipient as `0x${string}`, amountRaw],
      })

      console.log('⛈️ [SEND STORM] Sending transaction with gas sponsorship...')

      let result
      try {
        result = await sendCallsAsync({
          capabilities: {
            paymasterService: {
              policyId: policyId || undefined,
            },
          },
          calls: [
            {
              to: STORM_TOKEN_ADDRESS_SEPOLIA as `0x${string}`,
              data: callData,
            },
          ],
        })
      } catch (sendError: any) {
        const errorMessage = sendError?.message || sendError?.toString() || ''
        const isSponsorshipError =
          errorMessage.includes('Policy max count exceeded') ||
          errorMessage.includes('Sponsorship failed') ||
          errorMessage.includes('invalid_argument')

        if (isSponsorshipError) {
          console.warn('⚠️ [SEND STORM] Gas sponsorship failed - trying without')

          try {
            result = await sendCallsAsync({
              calls: [
                {
                  to: STORM_TOKEN_ADDRESS_SEPOLIA as `0x${string}`,
                  data: callData,
                },
              ],
            })
          } catch (fallbackError: any) {
            const fallbackMessage = fallbackError?.message || ''
            if (
              fallbackMessage.includes('insufficient') ||
              fallbackMessage.includes('balance')
            ) {
              throw new Error(
                'Gas sponsorship unavailable and insufficient ETH for gas fees. ' +
                  'Please add some ETH to your wallet or try again later.'
              )
            }
            throw fallbackError
          }
        } else {
          throw sendError
        }
      }

      console.log('✅ [SEND STORM] Transaction sent, call IDs:', result.ids)

      const callId = result.ids[0]

      try {
        console.log('⏳ [SEND STORM] Waiting for transaction confirmation...')
        const statusResult = await client.waitForCallsStatus({ id: callId })
        console.log('✅ [SEND STORM] Transaction status:', statusResult)

        const txHash =
          statusResult?.status === 'CONFIRMED'
            ? statusResult.transactions?.[0]?.hash ||
              statusResult.hash ||
              statusResult.transactionHash ||
              callId
            : callId

        setTxHash(txHash)
        setSuccess(true)
      } catch (waitErr) {
        console.warn('⚠️ [SEND STORM] Could not wait for confirmation:', waitErr)
        setTxHash(callId)
        setSuccess(true)
      }

      setTimeout(() => {
        setRecipient('')
        setAmount('')
        setSuccess(false)
        onSuccess?.()
      }, 3000)
    } catch (err) {
      console.error('❌ Send STORM error:', err)
      setError(err instanceof Error ? err.message : 'Failed to send STORM')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isConnected || !client) {
    return (
      <div className={`${cardClass} p-4`}>
        <p
          className={`text-sm ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          }`}
        >
          Please connect your wallet to send STORM
        </p>
      </div>
    )
  }

  return (
    <div className='space-y-4'>
      {/* Network context badge */}
      <div
        className={`flex items-center justify-between p-3 rounded-xl ${
          theme === 'dark' ? 'bg-yellow-500/10' : 'bg-yellow-50'
        }`}
      >
        <div className='flex items-center gap-2'>
          <span className='text-lg'>⛈️</span>
          <div>
            <p
              className={`text-sm font-medium ${
                theme === 'dark' ? 'text-gray-200' : 'text-gray-800'
              }`}
            >
              STORM on Base Sepolia
            </p>
            <p
              className={`text-xs ${
                theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
              }`}
            >
              Storm test tokens
            </p>
          </div>
        </div>
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            theme === 'dark'
              ? 'bg-yellow-500/20 text-yellow-300'
              : 'bg-yellow-100 text-yellow-600'
          }`}
        >
          Test
        </span>
      </div>

      {/* Recipient Input */}
      <div>
        <label
          className={`block text-sm font-medium mb-2 ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          }`}
        >
          Recipient Address
        </label>
        <input
          type='text'
          value={recipient}
          onChange={(e) => {
            setRecipient(e.target.value)
            setError(null)
          }}
          placeholder='0x...'
          className={`${inputClass} font-mono`}
        />
      </div>

      {/* Amount Input */}
      <div>
        <label
          className={`block text-sm font-medium mb-2 ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
          }`}
        >
          Amount (STORM)
        </label>
        <input
          type='number'
          step='0.0001'
          min='0'
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value)
            setError(null)
          }}
          placeholder='0.00'
          className={inputClass}
        />
      </div>

      {/* Error Message */}
      {error && (
        <div
          className={`flex items-start gap-2 p-3 rounded-xl ${
            theme === 'dark'
              ? 'bg-red-500/10 border border-red-500/20'
              : 'bg-red-50 border border-red-200'
          }`}
        >
          <AlertCircle
            className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
              theme === 'dark' ? 'text-red-400' : 'text-red-500'
            }`}
          />
          <p
            className={`text-sm ${
              theme === 'dark' ? 'text-red-300' : 'text-red-700'
            }`}
          >
            {error}
          </p>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div
          className={`p-3 rounded-xl ${
            theme === 'dark'
              ? 'bg-green-500/10 border border-green-500/20'
              : 'bg-green-50 border border-green-200'
          }`}
        >
          <div className='flex items-center gap-2 mb-2'>
            <CheckCircle
              className={`w-4 h-4 ${
                theme === 'dark' ? 'text-green-400' : 'text-green-500'
              }`}
            />
            <p
              className={`text-sm font-medium ${
                theme === 'dark' ? 'text-green-300' : 'text-green-700'
              }`}
            >
              STORM sent successfully!
            </p>
          </div>
          {txHash && (
            <a
              href={`https://sepolia.basescan.org/tx/${txHash}`}
              target='_blank'
              rel='noopener noreferrer'
              className={`inline-flex items-center gap-1 text-xs ${
                theme === 'dark'
                  ? 'text-green-400 hover:text-green-300'
                  : 'text-green-600 hover:text-green-700'
              }`}
            >
              View on BaseScan
              <ExternalLink className='w-3 h-3' />
            </a>
          )}
        </div>
      )}

      {/* Send Button */}
      <button
        onClick={handleSend}
        disabled={isLoading || isPending || !recipient || !amount}
        className={`w-full px-6 py-3 rounded-xl font-semibold transition-all duration-200 ${
          isLoading || isPending || !recipient || !amount
            ? theme === 'dark'
              ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            : theme === 'dark'
              ? 'bg-yellow-500 hover:bg-yellow-400 text-gray-900'
              : 'bg-yellow-500 hover:bg-yellow-600 text-white'
        }`}
      >
        {isLoading || isPending ? (
          'Sending...'
        ) : (
          <span className='flex items-center justify-center gap-2'>
            <StormTokenMark size='xs' />
            Send STORM
          </span>
        )}
      </button>

      <p
        className={`text-xs text-center ${
          theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
        }`}
      >
        Gas fees are sponsored
      </p>
    </div>
  )
}
