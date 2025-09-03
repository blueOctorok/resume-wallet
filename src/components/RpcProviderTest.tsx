'use client'

import { useRpcProviders } from '@dynamic-labs/sdk-react-core'
import { evmProvidersSelector } from '@dynamic-labs/ethereum-core'
import { useState } from 'react'
import {
  createRpcProviderUtils,
  getBlockchainData,
  verifyAddressOnChain,
} from '@/lib/wallet-transactions'
import {
  ServerIcon,
  GlobeAltIcon,
  CurrencyDollarIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline'

export function RpcProviderTest() {
  const evmProviders = useRpcProviders(evmProvidersSelector)
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [testAddress, setTestAddress] = useState<string>('')

  // Test RPC provider availability
  const handleTestProviders = async () => {
    setIsLoading(true)
    setError('')
    setResult('')

    try {
      const rpcUtils = createRpcProviderUtils(evmProviders)
      const availableChains = rpcUtils.getAvailableChainIds()
      const defaultProvider = rpcUtils.getDefaultProvider()
      const allProviders = rpcUtils.getAllProviders()

      setResult(
        `RPC Providers Available:\n` +
          `Default Provider: ${defaultProvider ? '✅ Available' : '❌ Not Available'}\n` +
          `Total Providers: ${allProviders.length}\n` +
          `Available Chain IDs: ${availableChains.join(', ')}\n` +
          `Mainnet Provider: ${rpcUtils.hasProviderForChain(1) ? '✅ Available' : '❌ Not Available'}\n` +
          `Polygon Provider: ${rpcUtils.hasProviderForChain(137) ? '✅ Available' : '❌ Not Available'}\n` +
          `Mumbai Provider: ${rpcUtils.hasProviderForChain(80001) ? '✅ Available' : '❌ Not Available'}`
      )
    } catch (err) {
      setError(
        `Failed to test providers: ${err instanceof Error ? err.message : 'Unknown error'}`
      )
    } finally {
      setIsLoading(false)
    }
  }

  // Test blockchain data retrieval
  const handleTestBlockchainData = async () => {
    if (!testAddress) {
      setError('Please enter a test address')
      return
    }

    setIsLoading(true)
    setError('')
    setResult('')

    try {
      const rpcUtils = createRpcProviderUtils(evmProviders)

      // Test on multiple chains
      const chains = [1, 137, 80001] // Ethereum, Polygon, Mumbai
      const results = []

      for (const chainId of chains) {
        if (rpcUtils.hasProviderForChain(chainId)) {
          try {
            const data = await getBlockchainData(rpcUtils, chainId, {
              address: testAddress,
            })
            results.push(`Chain ${chainId}: Balance ${data.balance || '0'} ETH`)
          } catch (chainError) {
            results.push(`Chain ${chainId}: Error - ${chainError}`)
          }
        } else {
          results.push(`Chain ${chainId}: No provider available`)
        }
      }

      setResult(`Blockchain Data for ${testAddress}:\n` + results.join('\n'))
    } catch (err) {
      setError(
        `Failed to get blockchain data: ${err instanceof Error ? err.message : 'Unknown error'}`
      )
    } finally {
      setIsLoading(false)
    }
  }

  // Test address verification
  const handleTestAddressVerification = async () => {
    if (!testAddress) {
      setError('Please enter a test address')
      return
    }

    setIsLoading(true)
    setError('')
    setResult('')

    try {
      const rpcUtils = createRpcProviderUtils(evmProviders)

      // Test on multiple chains
      const chains = [1, 137, 80001] // Ethereum, Polygon, Mumbai
      const results = []

      for (const chainId of chains) {
        if (rpcUtils.hasProviderForChain(chainId)) {
          try {
            const verification = await verifyAddressOnChain(
              rpcUtils,
              chainId,
              testAddress
            )
            results.push(
              `Chain ${chainId}: ${verification.isValid ? '✅ Valid' : '❌ Invalid'} - Balance: ${verification.balance} ETH`
            )
          } catch (chainError) {
            results.push(`Chain ${chainId}: Error - ${chainError}`)
          }
        } else {
          results.push(`Chain ${chainId}: No provider available`)
        }
      }

      setResult(
        `Address Verification for ${testAddress}:\n` + results.join('\n')
      )
    } catch (err) {
      setError(
        `Failed to verify address: ${err instanceof Error ? err.message : 'Unknown error'}`
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className='p-6 bg-white border border-gray-200 rounded-lg shadow-sm'>
      <div className='flex items-center gap-2 mb-4'>
        <ServerIcon className='w-6 h-6 text-blue-600' />
        <h3 className='text-lg font-semibold text-gray-900'>
          RPC Provider Testing
        </h3>
      </div>

      <p className='text-sm text-gray-600 mb-4'>
        Test direct blockchain access using RPC providers without wallet
        connection.
      </p>

      <div className='mb-4'>
        <label
          htmlFor='testAddress'
          className='block text-sm font-medium text-gray-700 mb-2'
        >
          Test Address (optional)
        </label>
        <input
          type='text'
          id='testAddress'
          value={testAddress}
          onChange={(e) => setTestAddress(e.target.value)}
          placeholder='0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6'
          className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
        />
      </div>

      <div className='flex flex-wrap gap-3 mb-4'>
        <button
          onClick={handleTestProviders}
          disabled={isLoading}
          className='flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
        >
          <ServerIcon className='w-4 h-4' />
          Test Providers
        </button>

        <button
          onClick={handleTestBlockchainData}
          disabled={isLoading || !testAddress}
          className='flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
        >
          <GlobeAltIcon className='w-4 h-4' />
          Get Blockchain Data
        </button>

        <button
          onClick={handleTestAddressVerification}
          disabled={isLoading || !testAddress}
          className='flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
        >
          <CheckCircleIcon className='w-4 h-4' />
          Verify Address
        </button>
      </div>

      {isLoading && (
        <div className='flex items-center gap-2 text-blue-600'>
          <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600'></div>
          <span className='text-sm'>Processing...</span>
        </div>
      )}

      {error && (
        <div className='p-3 bg-red-50 border border-red-200 rounded-md'>
          <p className='text-sm text-red-600'>{error}</p>
        </div>
      )}

      {result && (
        <div className='p-3 bg-green-50 border border-green-200 rounded-md'>
          <pre className='text-sm text-green-800 whitespace-pre-wrap'>
            {result}
          </pre>
        </div>
      )}
    </div>
  )
}
