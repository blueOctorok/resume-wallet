'use client'

import { useState } from 'react'
import {
  getUSDCBalance,
  getAllTokenBalances,
  getTokenMetadata,
  hasSufficientUSDC,
  BASE_SEPOLIA_USDC_ADDRESS,
} from '@/lib/alchemy-token-api'

interface TokenAPITestProps {
  walletAddress?: string
}

export default function TokenAPITest({ walletAddress }: TokenAPITestProps) {
  const [testAddress, setTestAddress] = useState<string>(walletAddress || '')
  const [results, setResults] = useState<any>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [activeTest, setActiveTest] = useState<string | null>(null)

  const runTest = async (
    testType: string,
    testFunction: () => Promise<any>
  ) => {
    setLoading(true)
    setActiveTest(testType)
    setResults(null)

    try {
      const result = await testFunction()
      setResults({ type: testType, data: result, success: true })
      console.log(`✅ ${testType} test completed:`, result)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      setResults({ type: testType, error: errorMessage, success: false })
      console.error(`❌ ${testType} test failed:`, errorMessage)
    } finally {
      setLoading(false)
      setActiveTest(null)
    }
  }

  const testUSDCBalance = () => {
    if (!testAddress) {
      alert('Please enter a wallet address')
      return
    }
    runTest('USDC Balance', () => getUSDCBalance(testAddress))
  }

  const testAllTokenBalances = () => {
    if (!testAddress) {
      alert('Please enter a wallet address')
      return
    }
    runTest('All Token Balances', () => getAllTokenBalances(testAddress))
  }

  const testTokenMetadata = () => {
    runTest('USDC Metadata', () => getTokenMetadata(BASE_SEPOLIA_USDC_ADDRESS))
  }

  const testSufficiencyCheck = () => {
    if (!testAddress) {
      alert('Please enter a wallet address')
      return
    }
    runTest('Sufficiency Check', () => hasSufficientUSDC(testAddress, '1.00'))
  }

  return (
    <div className='p-6 bg-white rounded-lg shadow-md'>
      <h2 className='text-2xl font-bold mb-4'>🪙 Alchemy Token API Test</h2>

      {/* Test Address Input */}
      <div className='mb-6'>
        <label
          htmlFor='testAddress'
          className='block text-sm font-medium text-gray-700 mb-2'
        >
          Wallet Address to Test:
        </label>
        <input
          id='testAddress'
          type='text'
          value={testAddress}
          onChange={(e) => setTestAddress(e.target.value)}
          placeholder='0x...'
          className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
        />
      </div>

      {/* Test Buttons */}
      <div className='grid grid-cols-2 gap-4 mb-6'>
        <button
          onClick={testUSDCBalance}
          disabled={loading || !testAddress}
          className={`px-4 py-2 rounded-md font-medium transition-colors ${
            loading && activeTest === 'USDC Balance'
              ? 'bg-blue-400 text-white cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed'
          }`}
        >
          {loading && activeTest === 'USDC Balance' ? '⏳' : '💰'} Get USDC
          Balance
        </button>

        <button
          onClick={testAllTokenBalances}
          disabled={loading || !testAddress}
          className={`px-4 py-2 rounded-md font-medium transition-colors ${
            loading && activeTest === 'All Token Balances'
              ? 'bg-green-400 text-white cursor-not-allowed'
              : 'bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed'
          }`}
        >
          {loading && activeTest === 'All Token Balances' ? '⏳' : '🪙'} Get All
          Tokens
        </button>

        <button
          onClick={testTokenMetadata}
          disabled={loading}
          className={`px-4 py-2 rounded-md font-medium transition-colors ${
            loading && activeTest === 'USDC Metadata'
              ? 'bg-purple-400 text-white cursor-not-allowed'
              : 'bg-purple-600 text-white hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed'
          }`}
        >
          {loading && activeTest === 'USDC Metadata' ? '⏳' : '📋'} Get USDC
          Metadata
        </button>

        <button
          onClick={testSufficiencyCheck}
          disabled={loading || !testAddress}
          className={`px-4 py-2 rounded-md font-medium transition-colors ${
            loading && activeTest === 'Sufficiency Check'
              ? 'bg-yellow-400 text-white cursor-not-allowed'
              : 'bg-yellow-600 text-white hover:bg-yellow-700 disabled:bg-gray-400 disabled:cursor-not-allowed'
          }`}
        >
          {loading && activeTest === 'Sufficiency Check' ? '⏳' : '✅'} Check $1
          USDC
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className='flex items-center justify-center p-4 bg-blue-50 border border-blue-200 rounded-lg mb-6'>
          <div className='animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3'></div>
          <span className='text-blue-700'>Running {activeTest} test...</span>
        </div>
      )}

      {/* Results Display */}
      {results && (
        <div className='mb-6'>
          <h3 className='text-lg font-semibold mb-3'>
            {results.success ? '✅' : '❌'} {results.type} Results:
          </h3>

          {results.success ? (
            <div className='bg-green-50 border border-green-200 rounded-lg p-4'>
              {/* USDC Balance Results */}
              {results.type === 'USDC Balance' && (
                <div className='space-y-2'>
                  <div>
                    <strong>Balance:</strong> ${results.data.balanceFormatted}
                  </div>
                  <div>
                    <strong>Raw Balance:</strong> {results.data.balance}
                  </div>
                  <div>
                    <strong>Decimals:</strong> {results.data.decimals}
                  </div>
                  <div>
                    <strong>Symbol:</strong> {results.data.symbol}
                  </div>
                </div>
              )}

              {/* All Token Balances Results */}
              {results.type === 'All Token Balances' && (
                <div className='space-y-3'>
                  <div>
                    <strong>Address:</strong> {results.data.address}
                  </div>
                  <div>
                    <strong>Token Count:</strong>{' '}
                    {results.data.tokenBalances.length}
                  </div>
                  <div className='space-y-2'>
                    {results.data.tokenBalances.map(
                      (token: any, index: number) => (
                        <div
                          key={index}
                          className='bg-white p-3 rounded border'
                        >
                          <div className='grid grid-cols-2 gap-2 text-sm'>
                            <div>
                              <strong>Symbol:</strong>{' '}
                              {token.symbol || 'Unknown'}
                            </div>
                            <div>
                              <strong>Balance:</strong>{' '}
                              {token.balanceFormatted || 'N/A'}
                            </div>
                            <div className='col-span-2'>
                              <strong>Contract:</strong> {token.contractAddress}
                            </div>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* Token Metadata Results */}
              {results.type === 'USDC Metadata' && (
                <div className='space-y-2'>
                  <div>
                    <strong>Name:</strong> {results.data.name}
                  </div>
                  <div>
                    <strong>Symbol:</strong> {results.data.symbol}
                  </div>
                  <div>
                    <strong>Decimals:</strong> {results.data.decimals}
                  </div>
                  <div>
                    <strong>Logo:</strong>{' '}
                    {results.data.logo ? 'Available' : 'Not available'}
                  </div>
                </div>
              )}

              {/* Sufficiency Check Results */}
              {results.type === 'Sufficiency Check' && (
                <div className='space-y-2'>
                  <div>
                    <strong>Has Sufficient:</strong>{' '}
                    {results.data.hasSufficient ? 'Yes' : 'No'}
                  </div>
                  <div>
                    <strong>Current Balance:</strong> $
                    {results.data.currentBalance}
                  </div>
                  <div>
                    <strong>Required Amount:</strong> $
                    {results.data.requiredAmount}
                  </div>
                  {results.data.shortfall && (
                    <div>
                      <strong>Shortfall:</strong> ${results.data.shortfall}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className='bg-red-50 border border-red-200 rounded-lg p-4'>
              <div className='text-red-700'>
                <strong>Error:</strong> {results.error}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Info */}
      <div className='text-sm text-gray-600 bg-gray-50 p-3 rounded-lg'>
        <div>
          <strong>Network:</strong> Base Sepolia
        </div>
        <div>
          <strong>USDC Contract:</strong> {BASE_SEPOLIA_USDC_ADDRESS}
        </div>
        <div>
          <strong>API:</strong> Alchemy Token API
        </div>
      </div>
    </div>
  )
}
