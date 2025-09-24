'use client'

import { useState } from 'react'
import { getUSDCBalance, getAllTokenBalances } from '@/lib/alchemy-token-api'

export default function USDCDebugTest() {
  const [testAddress, setTestAddress] = useState(
    '0x7682D6a5b1F3988f85DE72A721e72c8E6279cb07'
  )
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any>(null)

  const testUSDCBalance = async () => {
    if (!testAddress) return

    setLoading(true)
    setResults(null)

    try {
      console.log('🧪 Testing USDC balance for:', testAddress)

      // Test USDC balance
      const usdcResult = await getUSDCBalance(testAddress)
      console.log('🧪 USDC Result:', usdcResult)

      // Test all token balances
      const allTokensResult = await getAllTokenBalances(testAddress)
      console.log('🧪 All Tokens Result:', allTokensResult)

      setResults({
        usdc: usdcResult,
        allTokens: allTokensResult,
      })
    } catch (error) {
      console.error('🧪 Test error:', error)
      setResults({
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='bg-white p-6 rounded-lg shadow-sm border border-gray-200'>
      <h3 className='text-lg font-medium text-gray-900 mb-4'>
        🧪 USDC Balance Debug Test
      </h3>

      <div className='space-y-4'>
        <div>
          <label className='block text-sm font-medium text-gray-700 mb-2'>
            Test Wallet Address
          </label>
          <input
            type='text'
            value={testAddress}
            onChange={(e) => setTestAddress(e.target.value)}
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            placeholder='Enter wallet address to test'
          />
        </div>

        <button
          onClick={testUSDCBalance}
          disabled={loading || !testAddress}
          className='w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
        >
          {loading ? 'Testing...' : 'Test USDC Balance'}
        </button>

        {results && (
          <div className='mt-4 space-y-4'>
            {results.error ? (
              <div className='bg-red-50 p-4 rounded-lg'>
                <h4 className='font-medium text-red-800'>Error:</h4>
                <p className='text-red-700 text-sm'>{results.error}</p>
              </div>
            ) : (
              <>
                {/* USDC Results */}
                <div className='bg-blue-50 p-4 rounded-lg'>
                  <h4 className='font-medium text-blue-800 mb-2'>
                    USDC Balance:
                  </h4>
                  <div className='text-sm space-y-1'>
                    <p>
                      <strong>Success:</strong>{' '}
                      {results.usdc?.success ? '✅' : '❌'}
                    </p>
                    <p>
                      <strong>Balance:</strong> $
                      {results.usdc?.balanceFormatted || '0.00'}
                    </p>
                    <p>
                      <strong>Raw Balance:</strong>{' '}
                      {results.usdc?.balance || '0'}
                    </p>
                    <p>
                      <strong>Decimals:</strong>{' '}
                      {results.usdc?.decimals || 'N/A'}
                    </p>
                    <p>
                      <strong>Symbol:</strong> {results.usdc?.symbol || 'N/A'}
                    </p>
                    {results.usdc?.error && (
                      <p className='text-red-600'>
                        <strong>Error:</strong> {results.usdc.error}
                      </p>
                    )}
                  </div>
                </div>

                {/* All Tokens Results */}
                <div className='bg-green-50 p-4 rounded-lg'>
                  <h4 className='font-medium text-green-800 mb-2'>
                    All Tokens:
                  </h4>
                  <div className='text-sm space-y-1'>
                    <p>
                      <strong>Success:</strong>{' '}
                      {results.allTokens?.success ? '✅' : '❌'}
                    </p>
                    <p>
                      <strong>Token Count:</strong>{' '}
                      {results.allTokens?.tokenBalances?.length || 0}
                    </p>
                    {results.allTokens?.tokenBalances?.length > 0 && (
                      <div className='mt-2'>
                        <p className='font-medium'>Found Tokens:</p>
                        <ul className='list-disc list-inside space-y-1 mt-1'>
                          {results.allTokens.tokenBalances.map(
                            (token: any, index: number) => (
                              <li key={index} className='text-xs'>
                                <strong>{token.symbol || 'Unknown'}:</strong>{' '}
                                {token.balanceFormatted || 'N/A'}
                                <span className='text-gray-500 ml-2'>
                                  ({token.contractAddress?.slice(0, 8)}...)
                                </span>
                              </li>
                            )
                          )}
                        </ul>
                      </div>
                    )}
                    {results.allTokens?.error && (
                      <p className='text-red-600'>
                        <strong>Error:</strong> {results.allTokens.error}
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        <div className='text-xs text-gray-500'>
          <p>
            <strong>Expected USDC Contract:</strong>{' '}
            0x036cbd53842c5426634e7929541ec2318f3dcf7e
          </p>
          <p>
            <strong>Network:</strong> Base Sepolia (84532)
          </p>
          <p>Check browser console for detailed logs</p>
        </div>
      </div>
    </div>
  )
}
