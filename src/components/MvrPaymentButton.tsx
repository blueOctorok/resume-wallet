'use client'

/**
 * USDC payment for MVR via Alchemy Smart Wallets.
 * Candidates pay from their Light Account. Employers pay from the company MultiOwnerLightAccount
 * when payFromCompanyWallet + companyWalletAddress + companyId are set.
 */

import { useState, useEffect } from 'react'
import {
  useSignerStatus,
  useSmartAccountClient,
  useSendCalls,
  useAccount,
} from '@account-kit/react'
import { encodeFunctionData, parseAbi } from 'viem'
import { useTheme } from '@/contexts/ThemeContext'
import { companyIdToWalletSalt } from '@/lib/company-wallet-salt'
import { getCompanyWalletServiceOwnerAddress } from '@/lib/company-wallet-public'

interface MvrConfig {
  usdcAddress: string
  decimals: number
  treasuryAddress: string
  priceUsdc: string
}

export interface MvrPaymentButtonProps {
  userAddress?: string
  onPaymentSuccess?: (txHash: string) => void
  onPaymentError?: (error: string) => void
  disabled?: boolean
  userType?: 'applicant' | 'employer'
  /** When true with companyWalletAddress + companyId, USDC is sent from the shared company SCW. */
  payFromCompanyWallet?: boolean
  companyWalletAddress?: string | null
  companyId?: string | null
}

export default function MvrPaymentButton(props: MvrPaymentButtonProps) {
  const useCompany =
    Boolean(
      props.payFromCompanyWallet &&
        props.companyWalletAddress &&
        props.companyId
    )

  if (useCompany) {
    return <MvrPaymentFromCompanyWallet {...props} />
  }
  return <MvrPaymentFromPersonalLightAccount {...props} />
}

function MvrPaymentFromPersonalLightAccount({
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
  const account = useAccount({ type: 'LightAccount' })
  const walletAddress = userAddress || account?.address

  const [config, setConfig] = useState<MvrConfig | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

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

  if (isInitializing) return null
  if (!isConnected) return null
  if (!config || !client) return null

  const handlePayment = async () => {
    await executeMvrPayment({
      client,
      sendCallsAsync,
      config,
      theme,
      walletAddressForRecord: walletAddress ?? '',
      paidByWalletAddress: undefined,
      companyId: undefined,
      userType,
      setIsLoading,
      setError,
      setSuccess,
      onPaymentSuccess,
      onPaymentError,
    })
  }

  return (
    <MvrPaymentButtonUI
      handlePayment={handlePayment}
      isLoading={isLoading}
      isPending={isPending}
      disabled={disabled}
      success={success}
      error={error}
      config={config}
      theme={theme}
    />
  )
}

function MvrPaymentFromCompanyWallet(props: MvrPaymentButtonProps) {
  const serviceOwner = getCompanyWalletServiceOwnerAddress()
  if (!serviceOwner) {
    return (
      <p className="text-xs text-amber-600 dark:text-amber-400">
        Company wallet payments are not configured (missing NEXT_PUBLIC_COMPANY_WALLET_SERVICE_ADDRESS).
      </p>
    )
  }
  return <MvrPaymentFromCompanyWalletInner {...props} serviceOwner={serviceOwner} />
}

function MvrPaymentFromCompanyWalletInner({
  userAddress,
  onPaymentSuccess,
  onPaymentError,
  disabled = false,
  userType = 'employer',
  companyWalletAddress,
  companyId,
  serviceOwner,
}: MvrPaymentButtonProps & { serviceOwner: `0x${string}` }) {
  const { isConnected, isInitializing } = useSignerStatus()
  const { client } = useSmartAccountClient({
    type: 'MultiOwnerLightAccount',
    accountParams:
      companyWalletAddress && companyId
        ? {
            accountAddress: companyWalletAddress as `0x${string}`,
            salt: companyIdToWalletSalt(companyId),
            owners: [serviceOwner],
          }
        : undefined,
  })
  const { sendCallsAsync, isPending } = useSendCalls({ client })
  const { theme } = useTheme()
  const account = useAccount({ type: 'LightAccount' })
  const memberWallet = userAddress || account?.address

  const [config, setConfig] = useState<MvrConfig | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

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

  if (isInitializing) return null
  if (!isConnected) return null
  if (!config || !client || !companyWalletAddress || !companyId) return null

  const handlePayment = async () => {
    await executeMvrPayment({
      client,
      sendCallsAsync,
      config,
      theme,
      walletAddressForRecord: companyWalletAddress,
      paidByWalletAddress: memberWallet ?? undefined,
      companyId,
      userType,
      setIsLoading,
      setError,
      setSuccess,
      onPaymentSuccess,
      onPaymentError,
    })
  }

  return (
    <MvrPaymentButtonUI
      handlePayment={handlePayment}
      isLoading={isLoading}
      isPending={isPending}
      disabled={disabled}
      success={success}
      error={error}
      config={config}
      theme={theme}
    />
  )
}

type MvrExecClient = {
  waitForCallsStatus?: (args: { id: string }) => Promise<{
    status?: string
    transactions?: Array<{ hash?: string }>
    hash?: string
    transactionHash?: string
  }>
}

async function executeMvrPayment({
  client,
  sendCallsAsync,
  config,
  theme: _theme,
  walletAddressForRecord,
  paidByWalletAddress,
  companyId,
  userType,
  setIsLoading,
  setError,
  setSuccess,
  onPaymentSuccess,
  onPaymentError,
}: {
  client: MvrExecClient
  sendCallsAsync:
    | ((args: {
        calls: Array<{ to: `0x${string}`; data: `0x${string}` }>
      }) => Promise<{ ids: string[] }>)
    | undefined
  config: MvrConfig
  theme: string
  walletAddressForRecord: string
  paidByWalletAddress?: string
  companyId?: string
  userType: 'applicant' | 'employer'
  setIsLoading: (v: boolean) => void
  setError: (v: string | null) => void
  setSuccess: (v: boolean) => void
  onPaymentSuccess?: (txHash: string) => void
  onPaymentError?: (error: string) => void
}) {
  if (!client || !sendCallsAsync) {
    setError('Transaction service not available. Please refresh and try again.')
    return
  }

  setIsLoading(true)
  setError(null)
  setSuccess(false)

  try {
    const amountRaw = BigInt(Math.floor(parseFloat(config.priceUsdc) * 10 ** config.decimals))
    const transferAbi = parseAbi([
      'function transfer(address to, uint256 amount) returns (bool)',
    ])
    const callData = encodeFunctionData({
      abi: transferAbi,
      functionName: 'transfer',
      args: [config.treasuryAddress as `0x${string}`, amountRaw],
    })

    const result = await sendCallsAsync({
      calls: [
        {
          to: config.usdcAddress as `0x${string}`,
          data: callData,
        },
      ],
    })

    const callId = result.ids[0]
    let txHash: string
    try {
      if (client && typeof client.waitForCallsStatus === 'function') {
        const statusResult = await client.waitForCallsStatus({ id: callId })
        txHash =
          statusResult?.status === 'CONFIRMED'
            ? (statusResult.transactions?.[0]?.hash ||
                statusResult.hash ||
                statusResult.transactionHash ||
                callId)
            : callId
      } else {
        txHash = callId
      }
    } catch {
      txHash = callId
    }

    let savedPaymentTxHash = txHash
    try {
      const paymentResponse = await fetch('/api/mvr/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txHash,
          amountUsdc: config.priceUsdc,
          walletAddress: walletAddressForRecord,
          userType,
          ...(companyId ? { companyId } : {}),
          ...(paidByWalletAddress ? { paidByWalletAddress } : {}),
        }),
      })
      if (paymentResponse.status === 409) {
        const errBody = await paymentResponse.json().catch(() => ({}))
        const msg =
          typeof errBody.message === 'string'
            ? errBody.message
            : 'This payment was already linked to another account. Try again with a fresh transaction or contact support.'
        throw new Error(msg)
      }
      if (paymentResponse.ok) {
        const paymentData = await paymentResponse.json()
        savedPaymentTxHash = paymentData.payment?.txHash || txHash
      }
    } catch (err) {
      console.error('⚠️ Error recording payment:', err)
    }

    setSuccess(true)
    onPaymentSuccess?.(savedPaymentTxHash)
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Payment failed'
    setError(errorMessage)
    onPaymentError?.(errorMessage)
  } finally {
    setIsLoading(false)
  }
}

function MvrPaymentButtonUI({
  handlePayment,
  isLoading,
  isPending,
  disabled,
  success,
  error,
  config,
  theme,
}: {
  handlePayment: () => void
  isLoading: boolean
  isPending: boolean
  disabled: boolean
  success: boolean
  error: string | null
  config: MvrConfig
  theme: string
}) {
  const buttonClasses = `w-full md:w-auto px-6 py-2.5 text-sm font-semibold rounded-xl border transition-all duration-300 ${
    isLoading || isPending
      ? theme !== 'dark'
        ? 'text-gray-400 bg-gray-100 border-gray-200 cursor-not-allowed'
        : 'text-gray-500 bg-gray-800 border-gray-700 cursor-not-allowed'
      : success
        ? theme !== 'dark'
          ? 'text-white bg-green-600 hover:bg-green-700 border-green-600 shadow-lg'
          : 'text-white bg-green-600/80 hover:bg-green-600 border-green-500 shadow-lg'
        : theme !== 'dark'
          ? 'text-white bg-teal-600 hover:bg-teal-700 border-teal-600 hover:border-teal-700 shadow-lg hover:shadow-xl hover:scale-105 cursor-pointer'
          : 'text-white bg-teal-600/80 hover:bg-teal-700 border-teal-500/50 hover:border-teal-500 shadow-lg hover:shadow-xl hover:scale-105 cursor-pointer'
  }`

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
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
        <p className={`text-xs ${theme !== 'dark' ? 'text-red-600' : 'text-red-400'}`}>
          {error}
        </p>
      )}
    </div>
  )
}
