'use client'

import { useState } from 'react'
import { baseProvider } from '@/lib/base-account-sdk'
import {
  getWalletBalance,
  signMessage,
  sendTransaction,
  signTypedData,
  hasSufficientBalance,
  sendAtomicTransactions,
  sendAtomicTransactionsEnhanced,
  supportsAtomicTransactions,
  supportsPaymasterServices,
  getWalletCapabilities,
  decodeSignature,
  verifySignature,
  signAndVerifyMessage,
} from '@/lib/wallet-utils'
import {
  WalletIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/24/outline'

interface WalletTransactionsProps {
  walletAddress?: string
}

export function WalletTransactions({
  walletAddress = '',
}: WalletTransactionsProps) {
  const [balance, setBalance] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [atomicSupport, setAtomicSupport] = useState<boolean | null>(null)
  const [paymasterSupport, setPaymasterSupport] = useState<boolean | null>(null)
  const [walletCapabilities, setWalletCapabilities] = useState<any>(null)

  // Check if wallet is connected
  const isWalletConnected =
    !!walletAddress && typeof window !== 'undefined' && !!baseProvider

  // Test message signing
  const handleSignMessage = async () => {
    if (!isWalletConnected) {
      setError('No wallet connected. Please connect your Base Account first.')
      return
    }

    setIsLoading(true)
    setError('')
    setResult('')

    try {
      const message = 'Hello from DriverAppChain! This is a test signature.'
      const signature = await signMessage(message, baseProvider)
      setResult(`Message signed successfully!\nSignature: ${signature}`)
    } catch (err) {
      setError(
        `Failed to sign message: ${err instanceof Error ? err.message : 'Unknown error'}`
      )
    } finally {
      setIsLoading(false)
    }
  }

  // Test wallet balance
  const handleGetBalance = async () => {
    if (!isWalletConnected) {
      setError('No wallet connected. Please connect your Base Account first.')
      return
    }

    setIsLoading(true)
    setError('')
    setResult('')

    try {
      const walletBalance = await getWalletBalance(walletAddress, baseProvider)
      setBalance(walletBalance)
      setResult(`Wallet Balance: ${walletBalance} ETH`)

      // Check if sufficient for gas
      const hasGas = await hasSufficientBalance()
      setResult(
        (prev) => prev + `\nSufficient for gas: ${hasGas ? 'Yes' : 'No'}`
      )
    } catch (err) {
      setError(
        `Failed to get balance: ${err instanceof Error ? err.message : 'Unknown error'}`
      )
    } finally {
      setIsLoading(false)
    }
  }

  // Test typed data signing (for resume verification)
  const handleSignTypedData = async () => {
    if (!isWalletConnected) {
      setError('No wallet connected. Please connect your Base Account first.')
      return
    }

    setIsLoading(true)
    setError('')
    setResult('')

    try {
      const domain = {
        name: 'DriverAppChain',
        version: '1',
        chainId: 84532, // Base Sepolia testnet
        verifyingContract:
          '0x0000000000000000000000000000000000000000' as `0x${string}`,
      }

      const types = {
        ResumeVerification: [
          { name: 'resumeHash', type: 'string' },
          { name: 'timestamp', type: 'uint256' },
          { name: 'userId', type: 'string' },
        ],
      }

      const message = {
        resumeHash: 'QmTestHash123456789',
        timestamp: Math.floor(Date.now() / 1000),
        userId: 'test-user-123',
      }

      const signature = await signTypedData()
      setResult(`Typed data signing not yet implemented with Base Account SDK`)
    } catch (err) {
      setError(
        `Failed to sign typed data: ${err instanceof Error ? err.message : 'Unknown error'}`
      )
    } finally {
      setIsLoading(false)
    }
  }

  // Test transaction (sends 0 ETH to self - just for testing)
  const handleTestTransaction = async () => {
    if (!isWalletConnected) {
      setError('No wallet connected. Please connect your Base Account first.')
      return
    }

    setIsLoading(true)
    setError('')
    setResult('')

    try {
      // Check if wallet has sufficient balance
      const hasGas = await hasSufficientBalance()
      if (!hasGas) {
        setError('Insufficient balance for gas fees. Need at least 0.001 ETH.')
        return
      }

      // Send 0 ETH to self (just to test transaction signing)
      const txHash = await sendTransaction()
      setResult(`Transaction sending not yet implemented with Base Account SDK`)
    } catch (err) {
      setError(
        `Failed to send transaction: ${err instanceof Error ? err.message : 'Unknown error'}`
      )
    } finally {
      setIsLoading(false)
    }
  }

  // Test atomic transactions (EIP-5792)
  const handleAtomicTransactions = async () => {
    if (!isWalletConnected) {
      setError('No wallet connected. Please connect your Base Account first.')
      return
    }

    setIsLoading(true)
    setError('')
    setResult('')

    try {
      // Check if wallet supports atomic transactions
      const supportsAtomic = await supportsAtomicTransactions()
      if (!supportsAtomic) {
        setError('Wallet does not support atomic transactions (EIP-5792)')
        return
      }

      // Test atomic transactions with multiple calls
      const calls = [
        {
          to: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
          value: '0.0001', // 0.0001 ETH
        },
        {
          to: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
          value: '0.0001', // 0.0001 ETH
        },
      ]

      const atomicId = await sendAtomicTransactions()
      setResult(`Atomic transactions not yet implemented with Base Account SDK`)
    } catch (err) {
      setError(
        `Failed to send atomic transactions: ${err instanceof Error ? err.message : 'Unknown error'}`
      )
    } finally {
      setIsLoading(false)
    }
  }

  // Check wallet capabilities
  const handleCheckCapabilities = async () => {
    if (!isWalletConnected) {
      setError('No wallet connected. Please connect your Base Account first.')
      return
    }

    setIsLoading(true)
    setError('')
    setResult('')

    try {
      const atomic = await supportsAtomicTransactions()
      const paymaster = await supportsPaymasterServices()

      setAtomicSupport(atomic)
      setPaymasterSupport(paymaster)

      setResult(
        `Wallet Capabilities:\nAtomic Transactions: ${atomic ? '✅ Supported' : '❌ Not Supported'}\nPaymaster Services: ${paymaster ? '✅ Supported' : '❌ Not Supported'}`
      )
    } catch (err) {
      setError(
        `Failed to check capabilities: ${err instanceof Error ? err.message : 'Unknown error'}`
      )
    } finally {
      setIsLoading(false)
    }
  }

  // Test signature verification
  const handleSignAndVerify = async () => {
    if (!isWalletConnected) {
      setError('No wallet connected. Please connect your Base Account first.')
      return
    }

    setIsLoading(true)
    setError('')
    setResult('')

    try {
      const message =
        'Hello from DriverAppChain! This is a test signature for verification.'
      const result = await signAndVerifyMessage()

      setResult(`Sign & Verify not yet implemented with Base Account SDK`)
    } catch (err) {
      setError(
        `Failed to sign and verify: ${err instanceof Error ? err.message : 'Unknown error'}`
      )
    } finally {
      setIsLoading(false)
    }
  }

  // Test signature decoding
  const handleDecodeSignature = async () => {
    if (!isWalletConnected) {
      setError('No wallet connected. Please connect your Base Account first.')
      return
    }

    setIsLoading(true)
    setError('')
    setResult('')

    try {
      // First sign a message
      const message = 'Test message for signature decoding'
      const signature = await signMessage(message, baseProvider)

      // Then decode and verify it
      const decoded = await decodeSignature()

      setResult(`Signature decoding not yet implemented with Base Account SDK`)
    } catch (err) {
      setError(
        `Failed to decode signature: ${err instanceof Error ? err.message : 'Unknown error'}`
      )
    } finally {
      setIsLoading(false)
    }
  }

  // Test enhanced EIP-5792 capabilities
  const handleGetCapabilities = async () => {
    if (!isWalletConnected) {
      setError('No wallet connected. Please connect your Base Account first.')
      return
    }

    setIsLoading(true)
    setError('')
    setResult('')

    try {
      const capabilities = await getWalletCapabilities()
      if (
        capabilities &&
        typeof capabilities === 'object' &&
        'chainId' in capabilities
      ) {
        setWalletCapabilities(capabilities)
        setResult(
          `Wallet Capabilities (EIP-5792):\n` +
            `Chain ID: ${(capabilities as any).chainId}\n` +
            `Atomic Transactions: ${(capabilities as any).capabilities?.atomic ? '✅ Supported' : '❌ Not Supported'}\n` +
            `Atomic Status: ${(capabilities as any).capabilities?.atomicStatus || 'Unknown'}\n` +
            `Paymaster Service: ${(capabilities as any).capabilities?.paymasterService ? '✅ Supported' : '❌ Not Supported'}\n` +
            `Paymaster Status: ${(capabilities as any).capabilities?.paymasterStatus || 'Unknown'}`
        )
      } else {
        setError('Failed to get wallet capabilities')
      }
    } catch (err) {
      setError(
        `Failed to get capabilities: ${err instanceof Error ? err.message : 'Unknown error'}`
      )
    } finally {
      setIsLoading(false)
    }
  }

  // Test enhanced atomic transactions with paymaster
  const handleEnhancedAtomicTransactions = async () => {
    if (!isWalletConnected) {
      setError('No wallet connected. Please connect your Base Account first.')
      return
    }

    setIsLoading(true)
    setError('')
    setResult('')

    try {
      const calls = [
        { to: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6', value: '0.0001' },
        { to: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6', value: '0.0001' },
      ]

      const result = await sendAtomicTransactionsEnhanced()

      setResult(
        `Enhanced atomic transactions not yet implemented with Base Account SDK`
      )
    } catch (err) {
      setError(
        `Failed to send enhanced atomic transactions: ${err instanceof Error ? err.message : 'Unknown error'}`
      )
    } finally {
      setIsLoading(false)
    }
  }

  if (!isWalletConnected) {
    return (
      <div className='p-4 bg-gray-50 border border-gray-200 rounded-lg'>
        <p className='text-sm text-gray-600'>
          Connect your Base Account to test transactions
        </p>
      </div>
    )
  }

  return (
    <div className='p-4 bg-white border border-gray-200 rounded-lg space-y-4'>
      <div className='flex items-center gap-2 mb-4'>
        <WalletIcon className='w-5 h-5 text-blue-600' />
        <h3 className='text-lg font-medium text-gray-900'>
          Wallet Transaction Tests
        </h3>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
        <button
          onClick={handleGetBalance}
          disabled={isLoading}
          className='flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
        >
          <CurrencyDollarIcon className='w-4 h-4' />
          Get Balance
        </button>

        <button
          onClick={handleSignMessage}
          disabled={isLoading}
          className='flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
        >
          <DocumentTextIcon className='w-4 h-4' />
          Sign Message
        </button>

        <button
          onClick={handleSignTypedData}
          disabled={isLoading}
          className='flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
        >
          <DocumentTextIcon className='w-4 h-4' />
          Sign Typed Data
        </button>

        <button
          onClick={handleTestTransaction}
          disabled={isLoading}
          className='flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
        >
          <PaperAirplaneIcon className='w-4 h-4' />
          Test Transaction
        </button>

        <button
          onClick={handleCheckCapabilities}
          disabled={isLoading}
          className='flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
        >
          <WalletIcon className='w-4 h-4' />
          Check Capabilities
        </button>

        <button
          onClick={handleAtomicTransactions}
          disabled={isLoading}
          className='flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
        >
          <PaperAirplaneIcon className='w-4 h-4' />
          Atomic Transactions
        </button>

        <button
          onClick={handleSignAndVerify}
          disabled={isLoading}
          className='flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
        >
          <DocumentTextIcon className='w-4 h-4' />
          Sign & Verify
        </button>

        <button
          onClick={handleDecodeSignature}
          disabled={isLoading}
          className='flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-md hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
        >
          <DocumentTextIcon className='w-4 h-4' />
          Decode Signature
        </button>

        <button
          onClick={handleGetCapabilities}
          disabled={isLoading}
          className='flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
        >
          <WalletIcon className='w-4 h-4' />
          Get Capabilities (EIP-5792)
        </button>

        <button
          onClick={handleEnhancedAtomicTransactions}
          disabled={isLoading}
          className='flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
        >
          <PaperAirplaneIcon className='w-4 h-4' />
          Enhanced Atomic (EIP-5792)
        </button>
      </div>

      {isLoading && (
        <div className='flex items-center gap-2 text-blue-600'>
          <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600'></div>
          <span className='text-sm'>Processing...</span>
        </div>
      )}

      {balance && (
        <div className='p-3 bg-green-50 border border-green-200 rounded-md'>
          <p className='text-sm text-green-800'>
            <strong>Current Balance:</strong> {balance} ETH
          </p>
        </div>
      )}

      {result && (
        <div className='p-3 bg-blue-50 border border-blue-200 rounded-md'>
          <p className='text-sm text-blue-800 whitespace-pre-line'>{result}</p>
        </div>
      )}

      {error && (
        <div className='p-3 bg-red-50 border border-red-200 rounded-md'>
          <p className='text-sm text-red-800'>{error}</p>
        </div>
      )}

      <div className='text-xs text-gray-500'>
        <p>
          <strong>Wallet Address:</strong> {walletAddress || 'Not connected'}
        </p>
        <p>
          <strong>Network:</strong> Base Sepolia (Testnet)
        </p>
      </div>
    </div>
  )
}
