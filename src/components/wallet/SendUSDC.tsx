'use client'

import { useState } from 'react'
import { useSignerStatus, useSmartAccountClient, useSendCalls } from '@account-kit/react'
import { encodeFunctionData, parseAbi, isAddress, formatUnits, parseUnits } from 'viem'
import { useTheme } from '@/contexts/ThemeContext'
import { getUSDCBalance } from '@/lib/alchemy-token-api'

interface SendUSDCProps {
  walletAddress: string
  onSuccess?: () => void
}

export default function SendUSDC({ walletAddress, onSuccess }: SendUSDCProps) {
  const { isConnected } = useSignerStatus()
  const { client } = useSmartAccountClient({ type: 'LightAccount' })
  const { sendCalls, isPending } = useSendCalls({ client })
  const { theme } = useTheme()

  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [txHash, setTxHash] = useState<string | null>(null)

  // USDC contract address on Base Sepolia (6 decimals)
  const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'
  const USDC_DECIMALS = 6

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

    setError(null)
    return true
  }

  const handleSend = async () => {
    if (!validateForm() || !client || !isConnected) return

    setIsLoading(true)
    setError(null)
    setSuccess(false)

    try {
      // Check balance first
      const balanceResult = await getUSDCBalance(walletAddress)
      if (!balanceResult.success) {
        setError('Failed to check balance. Please try again.')
        return
      }

      const currentBalance = parseFloat(balanceResult.balanceFormatted)
      const sendAmount = parseFloat(amount)

      if (sendAmount > currentBalance) {
        setError(`Insufficient balance. You have $${currentBalance.toFixed(2)} USDC`)
        return
      }

      // Calculate amount in raw USDC (6 decimals)
      const amountRaw = parseUnits(amount, USDC_DECIMALS)

      // Encode ERC-20 transfer function call
      const transferAbi = parseAbi([
        'function transfer(address to, uint256 amount) returns (bool)',
      ])

      const callData = encodeFunctionData({
        abi: transferAbi,
        functionName: 'transfer',
        args: [recipient as `0x${string}`, amountRaw],
      })

      // Send the transaction via Alchemy Smart Wallet
      const result = await sendCalls({
        calls: [
          {
            to: USDC_ADDRESS as `0x${string}`,
            data: callData,
          },
        ],
      })

      console.log('✅ USDC send transaction:', result)
      
      setTxHash(typeof result === 'string' ? result : result.hash || 'pending')
      setSuccess(true)
      
      // Clear form after short delay
      setTimeout(() => {
        setRecipient('')
        setAmount('')
        setSuccess(false)
        onSuccess?.()
      }, 3000)
    } catch (err) {
      console.error('❌ Send USDC error:', err)
      setError(err instanceof Error ? err.message : 'Failed to send USDC')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isConnected || !client) {
    return (
      <div className={`p-4 rounded-lg ${
        theme === 'dark'
          ? 'bg-brand-sage-light/10 border border-brand-cream/20'
          : 'bg-gray-50 border border-gray-200'
      }`}>
        <p className={`text-sm ${
          theme === 'dark' ? 'text-brand-cream/70' : 'text-gray-600'
        }`}>
          Please connect your wallet to send USDC
        </p>
      </div>
    )
  }

  return (
    <div className='space-y-4'>
      <div>
        <label className={`block text-sm font-medium mb-2 ${
          theme === 'dark' ? 'text-brand-cream' : 'text-gray-700'
        }`}>
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
          className={`w-full px-4 py-3 rounded-lg border font-mono text-sm ${
            theme === 'dark'
              ? 'bg-brand-sage-light/10 border-brand-cream/30 text-brand-cream placeholder-brand-cream/40'
              : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
          } focus:outline-none focus:ring-2 focus:ring-brand-mint`}
        />
      </div>

      <div>
        <label className={`block text-sm font-medium mb-2 ${
          theme === 'dark' ? 'text-brand-cream' : 'text-gray-700'
        }`}>
          Amount (USDC)
        </label>
        <input
          type='number'
          step='0.01'
          min='0'
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value)
            setError(null)
          }}
          placeholder='0.00'
          className={`w-full px-4 py-3 rounded-lg border text-sm ${
            theme === 'dark'
              ? 'bg-brand-sage-light/10 border-brand-cream/30 text-brand-cream placeholder-brand-cream/40'
              : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
          } focus:outline-none focus:ring-2 focus:ring-brand-mint`}
        />
      </div>

      {error && (
        <div className={`p-3 rounded-lg ${
          theme === 'dark'
            ? 'bg-red-900/20 border border-red-500/30'
            : 'bg-red-50 border border-red-200'
        }`}>
          <p className={`text-sm ${
            theme === 'dark' ? 'text-red-300' : 'text-red-700'
          }`}>
            {error}
          </p>
        </div>
      )}

      {success && (
        <div className={`p-3 rounded-lg ${
          theme === 'dark'
            ? 'bg-green-900/20 border border-green-500/30'
            : 'bg-green-50 border border-green-200'
        }`}>
          <p className={`text-sm font-medium mb-2 ${
            theme === 'dark' ? 'text-green-300' : 'text-green-700'
          }`}>
            ✅ Transaction sent successfully!
          </p>
          {txHash && (
            <a
              href={`https://sepolia.basescan.org/tx/${txHash}`}
              target='_blank'
              rel='noopener noreferrer'
              className={`text-xs underline ${
                theme === 'dark' ? 'text-green-400' : 'text-green-600'
              }`}
            >
              View on BaseScan →
            </a>
          )}
        </div>
      )}

      <button
        onClick={handleSend}
        disabled={isLoading || isPending || !recipient || !amount}
        className={`w-full px-6 py-3 rounded-lg font-semibold transition-all duration-200 ${
          isLoading || isPending || !recipient || !amount
            ? theme === 'dark'
              ? 'bg-gray-700/50 text-gray-400 cursor-not-allowed'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : theme === 'dark'
              ? 'bg-brand-mint hover:bg-brand-mint/80 text-brand-sage shadow-lg hover:shadow-xl'
              : 'bg-brand-sage hover:bg-brand-sage-dark text-white shadow-lg hover:shadow-xl'
        }`}
      >
        {isLoading || isPending ? 'Sending...' : 'Send USDC'}
      </button>

      <p className={`text-xs text-center ${
        theme === 'dark' ? 'text-brand-cream/50' : 'text-gray-500'
      }`}>
        Gas fees are sponsored by the server
      </p>
    </div>
  )
}

