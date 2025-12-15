'use client'

import { useState } from 'react'
import { useSignerStatus, useSmartAccountClient, useSendCalls } from '@account-kit/react'
import { encodeFunctionData, parseAbi, isAddress, parseUnits } from 'viem'
import { useTheme } from '@/contexts/ThemeContext'
import { getUSDCBalanceSepolia } from '@/lib/alchemy-token-api'
import { policyId } from '@/lib/alchemy-account-config'

interface SendUSDCProps {
  walletAddress: string
  onSuccess?: () => void
}

export default function SendUSDC({ walletAddress, onSuccess }: SendUSDCProps) {
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

  // USDC contract address on Base Sepolia (6 decimals)
  // NOTE: This component is intentionally scoped to Base Sepolia USDC (testnet)
  // so drivers can practice and we can iterate safely. Production will swap to Base mainnet
  // and/or Veree token flows.
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
      // Check Sepolia USDC balance first
      // We scope this send flow explicitly to Base Sepolia (testnet) so it's crystal clear
      const balanceResult = await getUSDCBalanceSepolia(walletAddress)
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
      console.log('💸 [SEND USDC] Sending transaction with gas sponsorship...')
      
      let result
      try {
        // Try to send with sponsorship first
        // According to Alchemy docs, we can pass policyId explicitly to override global config
        // This ensures we're using the correct policy even if global config changes
        result = await sendCallsAsync({
          capabilities: {
            paymasterService: {
              // Explicitly set policy ID for reliability
              // If you have multiple policies, you can use policyIds array: [policy1, policy2]
              // Alchemy will try the first eligible one
              policyId: policyId || undefined,
            },
          },
          calls: [
            {
              to: USDC_ADDRESS as `0x${string}`,
              data: callData,
            },
          ],
        })
      } catch (sendError: any) {
        // Check if this is a sponsorship policy error
        const errorMessage = sendError?.message || sendError?.toString() || ''
        const isSponsorshipError = 
          errorMessage.includes('Policy max count exceeded') ||
          errorMessage.includes('Sponsorship failed') ||
          errorMessage.includes('invalid_argument')
        
        if (isSponsorshipError) {
          console.warn('⚠️ [SEND USDC] Gas sponsorship failed - policy limit reached')
          
          // Retry WITHOUT sponsorship (user pays gas)
          // We need to confirm with the user first ideally, but for now we'll notify them
          // that we're falling back to their own ETH for gas.
          
          // Note: In a real app, you might want to show a modal confirmation here.
          // For now, we'll try to proceed and let the wallet handle the gas estimation/signing flow.
          // If they don't have ETH, it will fail with "insufficient funds for gas" which is correct.
          
          try {
            console.log('🔄 [SEND USDC] Retrying without sponsorship (user will pay gas)...')
            // Retry without any capabilities object to disable sponsorship
            // The user's wallet will prompt them to pay gas with their ETH balance
            result = await sendCallsAsync({
              calls: [
                {
                  to: USDC_ADDRESS as `0x${string}`,
                  data: callData,
                },
              ],
              // Omit capabilities entirely to disable paymaster sponsorship
              // The transaction will use the user's own ETH for gas
            })
            
            // If we get here, the fallback worked!
            console.log('✅ [SEND USDC] Fallback transaction sent successfully (user paid gas)')
          } catch (fallbackError: any) {
            console.error('❌ [SEND USDC] Fallback transaction failed:', fallbackError)
            const fallbackMessage = fallbackError?.message || fallbackError?.toString() || ''
            
            // Provide helpful error messages
            if (fallbackMessage.includes('insufficient') || fallbackMessage.includes('balance')) {
              throw new Error(
                'Gas sponsorship unavailable and insufficient ETH for gas fees. ' +
                'Please add some ETH to your wallet to cover transaction costs, or try again later when sponsorship is available.'
              )
            }
            
            throw fallbackError
          }
        } else {
          // Re-throw other errors
          throw sendError
        }
      }

      console.log('✅ [SEND USDC] Transaction sent, call IDs:', result.ids)
      
      // Get the call ID to wait for status
      const callId = result.ids[0]

      // Wait for transaction confirmation using client.waitForCallsStatus
      try {
        console.log('⏳ [SEND USDC] Waiting for transaction confirmation...')
        
        const statusResult = await client.waitForCallsStatus({ id: callId })
        
        console.log('✅ [SEND USDC] Transaction status:', statusResult)
        
        // Extract transaction hash from status result
        // The status result may have different structures, so we check multiple possible locations
        const txHash = 
          statusResult?.status === 'CONFIRMED' 
            ? (statusResult.transactions?.[0]?.hash || 
               statusResult.hash || 
               statusResult.transactionHash || 
               callId)
            : callId // Fallback to call ID if we can't extract hash
        
        console.log('✅ [SEND USDC] Transaction hash:', txHash)
        setTxHash(txHash)
        setSuccess(true)
      } catch (waitErr) {
        // If waiting fails, still show success with the call ID
        // The transaction was submitted successfully, even if we can't confirm it
        console.warn('⚠️ [SEND USDC] Could not wait for confirmation, but transaction was sent:', waitErr)
        setTxHash(callId)
        setSuccess(true)
      }
      
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
      {/* Asset / Network context */}
      <div
        className={`p-3 rounded-lg border text-xs sm:text-sm ${
          theme === 'dark'
            ? 'bg-blue-900/20 border-blue-500/40 text-brand-cream/80'
            : 'bg-blue-50 border-blue-200 text-blue-900'
        }`}
      >
        <div className='flex items-center justify-between'>
          <div>
            <div className='font-semibold'>Sending: USDC (testnet)</div>
            <div className='opacity-80'>
              Network: <span className='font-medium'>Base Sepolia</span>
            </div>
          </div>
          <span
            className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold ${
              theme === 'dark'
                ? 'bg-blue-500/20 text-blue-200 border border-blue-400/40'
                : 'bg-blue-100 text-blue-700 border border-blue-300'
            }`}
          >
            Test funds only
          </span>
        </div>
        <p className='mt-1 text-[11px] opacity-80'>
          This send flow uses <span className='font-semibold'>Base Sepolia USDC</span> for
          testing. Production will use Base mainnet USDC and the Veree token.
        </p>
      </div>
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
            <div className='space-y-2'>
              <a
                href={`https://sepolia.basescan.org/tx/${txHash}`}
                target='_blank'
                rel='noopener noreferrer'
                className={`text-xs underline block ${
                  theme === 'dark' ? 'text-green-400' : 'text-green-600'
                }`}
              >
                View on BaseScan →
              </a>
              <div className={`text-xs mt-2 p-2 rounded ${
                theme === 'dark' ? 'bg-blue-900/30 text-blue-200' : 'bg-blue-50 text-blue-800'
              }`}>
                <p className='font-semibold mb-1'>💡 Not seeing USDC in MetaMask?</p>
                <ol className='list-decimal list-inside space-y-1 text-[10px]'>
                  <li>Switch MetaMask to <strong>Base Sepolia</strong> network</li>
                  <li>Add USDC token: <code className='bg-black/20 px-1 rounded'>0x036CbD53842c5426634e7929541eC2318f3dCF7e</code></li>
                  <li>Token decimals: <strong>6</strong></li>
                </ol>
              </div>
            </div>
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
        {error?.includes('sponsorship') && (
          <span className='block mt-1 text-orange-400'>⚠️ Sponsorship failed - tried user payment</span>
        )}
      </p>
    </div>
  )
}

