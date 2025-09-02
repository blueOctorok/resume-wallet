'use client'

import { useDynamicContext } from '@dynamic-labs/sdk-react-core'
import { isEthereumWallet } from '@dynamic-labs/ethereum'
import { useState } from 'react'
import {
  getWalletBalance,
  signMessage,
  sendTransaction,
  signTypedData,
  hasSufficientBalance,
} from '@/lib/wallet-transactions'
import {
  WalletIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/24/outline'

export function WalletTransactions() {
  const { primaryWallet } = useDynamicContext()
  const [balance, setBalance] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<string>('')
  const [error, setError] = useState<string>('')

  // Test message signing
  const handleSignMessage = async () => {
    if (!primaryWallet || !isEthereumWallet(primaryWallet)) {
      setError('No Ethereum wallet connected')
      return
    }

    setIsLoading(true)
    setError('')
    setResult('')

    try {
      const message = 'Hello from DriverAppChain! This is a test signature.'
      const signature = await signMessage(primaryWallet, message)
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
    if (!primaryWallet || !isEthereumWallet(primaryWallet)) {
      setError('No Ethereum wallet connected')
      return
    }

    setIsLoading(true)
    setError('')
    setResult('')

    try {
      const walletBalance = await getWalletBalance(primaryWallet)
      setBalance(walletBalance)
      setResult(`Wallet Balance: ${walletBalance} ETH`)

      // Check if sufficient for gas
      const hasGas = await hasSufficientBalance(primaryWallet)
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
    if (!primaryWallet || !isEthereumWallet(primaryWallet)) {
      setError('No Ethereum wallet connected')
      return
    }

    setIsLoading(true)
    setError('')
    setResult('')

    try {
      const domain = {
        name: 'DriverAppChain',
        version: '1',
        chainId: 80001, // Mumbai testnet
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

      const signature = await signTypedData(
        primaryWallet,
        domain,
        types,
        message
      )
      setResult(`Typed data signed successfully!\nSignature: ${signature}`)
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
    if (!primaryWallet || !isEthereumWallet(primaryWallet)) {
      setError('No Ethereum wallet connected')
      return
    }

    setIsLoading(true)
    setError('')
    setResult('')

    try {
      // Check if wallet has sufficient balance
      const hasGas = await hasSufficientBalance(primaryWallet, '0.001')
      if (!hasGas) {
        setError('Insufficient balance for gas fees. Need at least 0.001 ETH.')
        return
      }

      // Send 0 ETH to self (just to test transaction signing)
      const txHash = await sendTransaction(
        primaryWallet,
        primaryWallet.address!,
        '0'
      )
      setResult(`Transaction sent successfully!\nHash: ${txHash}`)
    } catch (err) {
      setError(
        `Failed to send transaction: ${err instanceof Error ? err.message : 'Unknown error'}`
      )
    } finally {
      setIsLoading(false)
    }
  }

  if (!primaryWallet || !isEthereumWallet(primaryWallet)) {
    return (
      <div className='p-4 bg-gray-50 border border-gray-200 rounded-lg'>
        <p className='text-sm text-gray-600'>
          Connect an Ethereum wallet to test transactions
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
          <strong>Wallet Address:</strong> {primaryWallet.address}
        </p>
        <p>
          <strong>Network:</strong> {primaryWallet.chain || 'Unknown'}
        </p>
      </div>
    </div>
  )
}
