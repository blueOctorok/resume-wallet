'use client'

import { useState } from 'react'
import {
  getWalletTransfers,
  getResumeVerificationHistory,
  getContractFirstTransfer,
  getContractLastTransfer,
  getUSDCTransferHistory,
  getTransactionDetails,
  hasTransactionHistory,
  formatTransferForDisplay,
  BASE_SEPOLIA_USDC_ADDRESS,
} from '@/lib/alchemy-transfers-api'

interface TransfersAPITestProps {
  walletAddress?: string
  contractAddress?: string
}

export default function TransfersAPITest({
  walletAddress,
  contractAddress,
}: TransfersAPITestProps) {
  const [testAddress, setTestAddress] = useState<string>(walletAddress || '')
  const [testTxHash, setTestTxHash] = useState<string>('')
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

  const testAllTransfers = () => {
    if (!testAddress) {
      alert('Please enter a wallet address')
      return
    }
    runTest('All Transfers', () =>
      getWalletTransfers(testAddress, { maxCount: 10 })
    )
  }

  const testResumeHistory = () => {
    if (!testAddress) {
      alert('Please enter a wallet address')
      return
    }
    runTest('Resume History', () =>
      getResumeVerificationHistory(testAddress, contractAddress, {
        maxCount: 5,
      })
    )
  }

  const testUSDCHistory = () => {
    if (!testAddress) {
      alert('Please enter a wallet address')
      return
    }
    runTest('USDC History', () =>
      getUSDCTransferHistory(testAddress, BASE_SEPOLIA_USDC_ADDRESS, {
        maxCount: 5,
      })
    )
  }

  const testTransactionDetails = () => {
    if (!testTxHash) {
      alert('Please enter a transaction hash')
      return
    }
    runTest('Transaction Details', () => getTransactionDetails(testTxHash))
  }

  const testContractFirstTransfer = () => {
    if (!contractAddress) {
      alert('Please enter a contract address')
      return
    }
    runTest('Contract First Transfer', () =>
      getContractFirstTransfer(contractAddress, {
        category: ['external', 'internal', 'erc20'],
        excludeZeroValue: false, // Include all transfers for testing
      })
    )
  }

  const testContractLastTransfer = () => {
    if (!contractAddress) {
      alert('Please enter a contract address')
      return
    }
    runTest('Contract Last Transfer', () =>
      getContractLastTransfer(contractAddress, {
        category: ['external', 'internal', 'erc20'],
        excludeZeroValue: false, // Include all transfers for testing
        maxPages: 5, // Limit for testing
      })
    )
  }

  const testHasHistory = () => {
    if (!testAddress) {
      alert('Please enter a wallet address')
      return
    }
    runTest('Has History Check', () => hasTransactionHistory(testAddress))
  }

  return (
    <div className='p-6 bg-white rounded-lg shadow-md'>
      <h2 className='text-2xl font-bold mb-4'>📊 Alchemy Transfers API Test</h2>

      {/* Test Inputs */}
      <div className='space-y-4 mb-6'>
        <div>
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

        <div>
          <label
            htmlFor='testTxHash'
            className='block text-sm font-medium text-gray-700 mb-2'
          >
            Transaction Hash (for details test):
          </label>
          <input
            id='testTxHash'
            type='text'
            value={testTxHash}
            onChange={(e) => setTestTxHash(e.target.value)}
            placeholder='0x...'
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
          />
        </div>
      </div>

      {/* Test Buttons */}
      <div className='grid grid-cols-2 gap-4 mb-6'>
        <button
          onClick={testAllTransfers}
          disabled={loading || !testAddress}
          className={`px-4 py-2 rounded-md font-medium transition-colors ${
            loading && activeTest === 'All Transfers'
              ? 'bg-blue-400 text-white cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed'
          }`}
        >
          {loading && activeTest === 'All Transfers' ? '⏳' : '📊'} Get All
          Transfers
        </button>

        <button
          onClick={testResumeHistory}
          disabled={loading || !testAddress}
          className={`px-4 py-2 rounded-md font-medium transition-colors ${
            loading && activeTest === 'Resume History'
              ? 'bg-green-400 text-white cursor-not-allowed'
              : 'bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed'
          }`}
        >
          {loading && activeTest === 'Resume History' ? '⏳' : '📝'} Resume
          History
        </button>

        <button
          onClick={testUSDCHistory}
          disabled={loading || !testAddress}
          className={`px-4 py-2 rounded-md font-medium transition-colors ${
            loading && activeTest === 'USDC History'
              ? 'bg-purple-400 text-white cursor-not-allowed'
              : 'bg-purple-600 text-white hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed'
          }`}
        >
          {loading && activeTest === 'USDC History' ? '⏳' : '💰'} USDC History
        </button>

        <button
          onClick={testHasHistory}
          disabled={loading || !testAddress}
          className={`px-4 py-2 rounded-md font-medium transition-colors ${
            loading && activeTest === 'Has History Check'
              ? 'bg-orange-400 text-white cursor-not-allowed'
              : 'bg-orange-600 text-white hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed'
          }`}
        >
          {loading && activeTest === 'Has History Check' ? '⏳' : '🔍'} Check
          History
        </button>

        <button
          onClick={testTransactionDetails}
          disabled={loading || !testTxHash}
          className={`px-4 py-2 rounded-md font-medium transition-colors ${
            loading && activeTest === 'Transaction Details'
              ? 'bg-red-400 text-white cursor-not-allowed'
              : 'bg-red-600 text-white hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed'
          }`}
        >
          {loading && activeTest === 'Transaction Details' ? '⏳' : '🔎'} Get
          Transaction Details
        </button>

        <button
          onClick={testContractFirstTransfer}
          disabled={loading || !contractAddress}
          className={`px-4 py-2 rounded-md font-medium transition-colors ${
            loading && activeTest === 'Contract First Transfer'
              ? 'bg-indigo-400 text-white cursor-not-allowed'
              : 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed'
          }`}
        >
          {loading && activeTest === 'Contract First Transfer' ? '⏳' : '🎯'}{' '}
          Get First Transfer
        </button>

        <button
          onClick={testContractLastTransfer}
          disabled={loading || !contractAddress}
          className={`px-4 py-2 rounded-md font-medium transition-colors ${
            loading && activeTest === 'Contract Last Transfer'
              ? 'bg-purple-400 text-white cursor-not-allowed'
              : 'bg-purple-600 text-white hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed'
          }`}
        >
          {loading && activeTest === 'Contract Last Transfer' ? '⏳' : '🚀'} Get
          Last Transfer
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
            <div className='bg-green-50 border border-green-200 rounded-lg p-4 max-h-96 overflow-y-auto'>
              {/* All Transfers Results */}
              {results.type === 'All Transfers' && (
                <div className='space-y-3'>
                  <div>
                    <strong>Total Transfers:</strong>{' '}
                    {results.data.transfers.length}
                  </div>
                  <div>
                    <strong>Has More Pages:</strong>{' '}
                    {results.data.pageKey ? 'Yes' : 'No'}
                  </div>
                  <div className='space-y-2'>
                    <strong>Transfers:</strong>
                    {results.data.transfers.map(
                      (transfer: any, index: number) => {
                        const formatted = formatTransferForDisplay(transfer)
                        return (
                          <div
                            key={index}
                            className='bg-white p-3 rounded border text-sm'
                          >
                            <div className='grid grid-cols-2 gap-2'>
                              <div>
                                <strong>Type:</strong> {formatted.type}
                              </div>
                              <div>
                                <strong>Amount:</strong> {formatted.amount}
                              </div>
                              <div>
                                <strong>From:</strong>{' '}
                                {formatted.from.slice(0, 10)}...
                              </div>
                              <div>
                                <strong>To:</strong> {formatted.to.slice(0, 10)}
                                ...
                              </div>
                              <div>
                                <strong>Time:</strong> {formatted.timestamp}
                              </div>
                              <div>
                                <strong>Block:</strong> {formatted.blockNumber}
                              </div>
                              <div className='col-span-2'>
                                <strong>Hash:</strong>
                                <a
                                  href={`https://sepolia.basescan.org/tx/${transfer.hash}`}
                                  target='_blank'
                                  rel='noopener noreferrer'
                                  className='text-blue-600 hover:text-blue-800 underline ml-1'
                                >
                                  {transfer.hash.slice(0, 10)}...
                                </a>
                              </div>
                            </div>
                          </div>
                        )
                      }
                    )}
                  </div>
                </div>
              )}

              {/* Resume History Results */}
              {results.type === 'Resume History' && (
                <div className='space-y-3'>
                  <div>
                    <strong>Resume Transactions:</strong>{' '}
                    {results.data.transfers.length}
                  </div>
                  {results.data.transfers.length > 0 ? (
                    <div className='space-y-2'>
                      {results.data.transfers.map(
                        (transfer: any, index: number) => {
                          const formatted = formatTransferForDisplay(transfer)
                          return (
                            <div
                              key={index}
                              className='bg-white p-3 rounded border text-sm'
                            >
                              <div>
                                <strong>Type:</strong> {formatted.type}
                              </div>
                              <div>
                                <strong>Time:</strong> {formatted.timestamp}
                              </div>
                              <div>
                                <strong>Hash:</strong>{' '}
                                {transfer.hash.slice(0, 16)}...
                              </div>
                            </div>
                          )
                        }
                      )}
                    </div>
                  ) : (
                    <div className='text-gray-500'>
                      No resume verification transactions found
                    </div>
                  )}
                </div>
              )}

              {/* USDC History Results */}
              {results.type === 'USDC History' && (
                <div className='space-y-3'>
                  <div>
                    <strong>USDC Transfers:</strong>{' '}
                    {results.data.transfers.length}
                  </div>
                  {results.data.transfers.length > 0 ? (
                    <div className='space-y-2'>
                      {results.data.transfers.map(
                        (transfer: any, index: number) => (
                          <div
                            key={index}
                            className='bg-white p-3 rounded border text-sm'
                          >
                            <div>
                              <strong>Amount:</strong> {transfer.value} USDC
                            </div>
                            <div>
                              <strong>From:</strong>{' '}
                              {transfer.from.slice(0, 10)}...
                            </div>
                            <div>
                              <strong>To:</strong> {transfer.to.slice(0, 10)}...
                            </div>
                            <div>
                              <strong>Time:</strong>{' '}
                              {transfer.metadata?.blockTimestamp}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  ) : (
                    <div className='text-gray-500'>No USDC transfers found</div>
                  )}
                </div>
              )}

              {/* Has History Results */}
              {results.type === 'Has History Check' && (
                <div className='space-y-2'>
                  <div>
                    <strong>Has Transaction History:</strong>{' '}
                    {results.data.hasHistory ? 'Yes' : 'No'}
                  </div>
                  <div>
                    <strong>Transaction Count:</strong>{' '}
                    {results.data.transactionCount}
                  </div>
                </div>
              )}

              {/* Transaction Details Results */}
              {results.type === 'Transaction Details' && (
                <div className='space-y-3'>
                  <div>
                    <strong>Transaction Found:</strong>{' '}
                    {results.data.transaction ? 'Yes' : 'No'}
                  </div>
                  {results.data.transaction && (
                    <div className='space-y-2 text-sm'>
                      <div>
                        <strong>From:</strong> {results.data.transaction.from}
                      </div>
                      <div>
                        <strong>To:</strong> {results.data.transaction.to}
                      </div>
                      <div>
                        <strong>Value:</strong> {results.data.transaction.value}
                      </div>
                      <div>
                        <strong>Gas Used:</strong>{' '}
                        {results.data.receipt?.gasUsed}
                      </div>
                      <div>
                        <strong>Status:</strong>{' '}
                        {results.data.receipt?.status === 1
                          ? 'Success'
                          : 'Failed'}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Contract First Transfer Results */}
              {results.type === 'Contract First Transfer' && (
                <div className='space-y-3'>
                  <div>
                    <strong>First Transfer Found:</strong>{' '}
                    {results.data.transfers.length > 0 ? 'Yes' : 'No'}
                  </div>
                  {results.data.transfers.length > 0 && (
                    <div className='space-y-3'>
                      <strong>First Transfer Details:</strong>
                      {results.data.transfers.map(
                        (transfer: any, index: number) => {
                          const formatted = formatTransferForDisplay(transfer)
                          return (
                            <div
                              key={index}
                              className='bg-white p-3 rounded border text-sm'
                            >
                              <div className='grid grid-cols-2 gap-2'>
                                <div>
                                  <strong>Block:</strong>{' '}
                                  {formatted.blockNumber}
                                </div>
                                <div>
                                  <strong>Type:</strong> {formatted.type}
                                </div>
                                <div>
                                  <strong>Asset:</strong> {formatted.asset}
                                </div>
                                <div>
                                  <strong>Amount:</strong> {formatted.amount}
                                </div>
                                <div>
                                  <strong>From:</strong>{' '}
                                  {formatted.from.slice(0, 10)}...
                                </div>
                                <div>
                                  <strong>To:</strong>{' '}
                                  {formatted.to.slice(0, 10)}...
                                </div>
                                <div className='col-span-2'>
                                  <strong>Hash:</strong>
                                  <a
                                    href={`https://sepolia.basescan.org/tx/${formatted.hash}`}
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    className='text-blue-600 hover:text-blue-800 underline ml-1'
                                  >
                                    {formatted.hash.slice(0, 16)}...
                                  </a>
                                </div>
                                <div className='col-span-2 text-xs text-gray-500'>
                                  <strong>Timestamp:</strong>{' '}
                                  {formatted.timestamp}
                                </div>
                              </div>
                            </div>
                          )
                        }
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Contract Last Transfer Results */}
              {results.type === 'Contract Last Transfer' && (
                <div className='space-y-3'>
                  <div>
                    <strong>Last Transfer Found:</strong>{' '}
                    {results.data.transfers.length > 0 ? 'Yes' : 'No'}
                  </div>
                  {results.data.totalTransfers && (
                    <div>
                      <strong>Total Contract Transfers:</strong>{' '}
                      {results.data.totalTransfers}
                    </div>
                  )}
                  {results.data.pagesSearched && (
                    <div>
                      <strong>Pages Searched:</strong>{' '}
                      {results.data.pagesSearched}
                    </div>
                  )}
                  {results.data.transfers.length > 0 && (
                    <div className='space-y-3'>
                      <strong>Most Recent Transfer Details:</strong>
                      {results.data.transfers.map(
                        (transfer: any, index: number) => {
                          const formatted = formatTransferForDisplay(transfer)
                          return (
                            <div
                              key={index}
                              className='bg-white p-3 rounded border text-sm border-purple-200'
                            >
                              <div className='grid grid-cols-2 gap-2'>
                                <div>
                                  <strong>Block:</strong>{' '}
                                  {formatted.blockNumber}
                                </div>
                                <div>
                                  <strong>Type:</strong> {formatted.type}
                                </div>
                                <div>
                                  <strong>Asset:</strong> {formatted.asset}
                                </div>
                                <div>
                                  <strong>Amount:</strong> {formatted.amount}
                                </div>
                                <div>
                                  <strong>From:</strong>{' '}
                                  {formatted.from.slice(0, 10)}...
                                </div>
                                <div>
                                  <strong>To:</strong>{' '}
                                  {formatted.to.slice(0, 10)}...
                                </div>
                                <div className='col-span-2'>
                                  <strong>Hash:</strong>
                                  <a
                                    href={`https://sepolia.basescan.org/tx/${formatted.hash}`}
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    className='text-purple-600 hover:text-purple-800 underline ml-1'
                                  >
                                    {formatted.hash.slice(0, 16)}...
                                  </a>
                                </div>
                                <div className='col-span-2 text-xs text-gray-500'>
                                  <strong>Timestamp:</strong>{' '}
                                  {formatted.timestamp}
                                </div>
                              </div>
                            </div>
                          )
                        }
                      )}
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
          <strong>API:</strong> Alchemy Transfers API
        </div>
        {contractAddress && (
          <div>
            <strong>Resume Contract:</strong> {contractAddress}
          </div>
        )}
      </div>
    </div>
  )
}
