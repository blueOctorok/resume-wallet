'use client'

import { useState } from 'react'
import {
  getEnabledNetworks,
  getNetworkInfo,
  isNetworkEnabled,
  getEnabledChainIds,
  getNetworkDisplayInfo,
} from '@/lib/wallet-utils'
import {
  GlobeAltIcon,
  CheckCircleIcon,
  XCircleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline'

interface NetworkDiscoveryProps {
  walletAddress?: string
}

export function NetworkDiscovery({
  walletAddress = '',
}: NetworkDiscoveryProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [testChainId, setTestChainId] = useState<string>('1')

  // Test enabled networks discovery
  const handleTestEnabledNetworks = async () => {
    if (!walletAddress) {
      setError('No wallet connected. Please connect your Base Account first.')
      return
    }

    setIsLoading(true)
    setError('')
    setResult('')

    try {
      const enabledNetworks = getEnabledNetworks()
      const enabledChainIds = getEnabledChainIds()
      const networkDisplayInfo = getNetworkDisplayInfo(84532) // Base Sepolia

      setResult(
        `Enabled Networks Discovery:\n` +
          `Total Networks: ${enabledNetworks.length}\n` +
          `Enabled Chain IDs: ${enabledChainIds.join(', ')}\n\n` +
          `Network Details:\n` +
          (networkDisplayInfo
            ? `• ${networkDisplayInfo.name} (${networkDisplayInfo.chainId}) - ETH`
            : 'No network info available')
      )
    } catch (err) {
      setError(
        `Failed to get enabled networks: ${err instanceof Error ? err.message : 'Unknown error'}`
      )
    } finally {
      setIsLoading(false)
    }
  }

  // Test specific network info
  const handleTestNetworkInfo = async () => {
    if (!walletAddress) {
      setError('No wallet connected. Please connect your Base Account first.')
      return
    }

    if (!testChainId) {
      setError('Please enter a chain ID')
      return
    }

    setIsLoading(true)
    setError('')
    setResult('')

    try {
      const chainId = parseInt(testChainId)
      const networkInfo = getNetworkInfo(chainId)
      const isEnabled = isNetworkEnabled(chainId)

      if (networkInfo) {
        setResult(
          `Network Info for Chain ID ${chainId}:\n` +
            `Name: ${networkInfo.name}\n` +
            `Symbol: ETH\n` +
            `Decimals: 18\n` +
            `RPC URL: ${networkInfo.rpcUrl}\n` +
            `Is Enabled: ${isEnabled ? '✅ Yes' : '❌ No'}`
        )
      } else {
        setResult(`Network with Chain ID ${chainId} not found or not enabled`)
      }
    } catch (err) {
      setError(
        `Failed to get network info: ${err instanceof Error ? err.message : 'Unknown error'}`
      )
    } finally {
      setIsLoading(false)
    }
  }

  // Test network status for common chains
  const handleTestCommonChains = async () => {
    if (!walletAddress) {
      setError('No wallet connected. Please connect your Base Account first.')
      return
    }

    setIsLoading(true)
    setError('')
    setResult('')

    try {
      const commonChains = [
        { chainId: 1, name: 'Ethereum Mainnet' },
        { chainId: 5, name: 'Ethereum Goerli' },
        { chainId: 8453, name: 'Base Mainnet' },
        { chainId: 84532, name: 'Base Sepolia' },
        { chainId: 10, name: 'Optimism' },
        { chainId: 42161, name: 'Arbitrum' },
        { chainId: 56, name: 'BNB Smart Chain' },
      ]

      const results = commonChains.map((chain) => {
        const isEnabled = isNetworkEnabled(chain.chainId)
        const networkInfo = getNetworkInfo(chain.chainId)
        return `${chain.name} (${chain.chainId}): ${
          isEnabled ? '✅ Enabled' : '❌ Not Enabled'
        }${networkInfo ? ` - ETH` : ''}`
      })

      setResult(`Common Chains Status:\n` + results.join('\n'))
    } catch (err) {
      setError(
        `Failed to test common chains: ${err instanceof Error ? err.message : 'Unknown error'}`
      )
    } finally {
      setIsLoading(false)
    }
  }

  if (!walletAddress) {
    return (
      <div className='p-4 bg-gray-50 border border-gray-200 rounded-lg'>
        <p className='text-sm text-gray-600'>
          Connect your Base Account to test network discovery
        </p>
      </div>
    )
  }

  return (
    <div className='p-6 bg-white border border-gray-200 rounded-lg shadow-sm'>
      <div className='flex items-center gap-2 mb-4'>
        <GlobeAltIcon className='w-6 h-6 text-blue-600' />
        <h3 className='text-lg font-semibold text-gray-900'>
          Network Discovery Testing
        </h3>
      </div>

      <p className='text-sm text-gray-600 mb-4'>
        Test network discovery and get information about enabled networks.
      </p>

      <div className='mb-4'>
        <label
          htmlFor='testChainId'
          className='block text-sm font-medium text-gray-700 mb-2'
        >
          Test Chain ID (optional)
        </label>
        <input
          type='number'
          id='testChainId'
          value={testChainId}
          onChange={(e) => setTestChainId(e.target.value)}
          placeholder='1'
          className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
        />
      </div>

      <div className='flex flex-wrap gap-3 mb-4'>
        <button
          onClick={handleTestEnabledNetworks}
          disabled={isLoading}
          className='flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
        >
          <GlobeAltIcon className='w-4 h-4' />
          Get Enabled Networks
        </button>

        <button
          onClick={handleTestNetworkInfo}
          disabled={isLoading || !testChainId}
          className='flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
        >
          <InformationCircleIcon className='w-4 h-4' />
          Get Network Info
        </button>

        <button
          onClick={handleTestCommonChains}
          disabled={isLoading}
          className='flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
        >
          <CheckCircleIcon className='w-4 h-4' />
          Test Common Chains
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
