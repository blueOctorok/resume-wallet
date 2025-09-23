'use client'

import { useState } from 'react'

interface RawTransfersAPITestProps {
  walletAddress?: string
}

export default function RawTransfersAPITest({
  walletAddress,
}: RawTransfersAPITestProps) {
  const [testAddress, setTestAddress] = useState<string>(walletAddress || '')
  const [results, setResults] = useState<any>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [rawRequest, setRawRequest] = useState<string>('')
  const [rawResponse, setRawResponse] = useState<string>('')

  const testRawAPI = async () => {
    if (!testAddress) {
      alert('Please enter a wallet address')
      return
    }

    setLoading(true)
    setResults(null)
    setRawRequest('')
    setRawResponse('')

    try {
      const ALCHEMY_API_KEY =
        process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || '1EacVcYetgk_QIWCKp4hI'
      const url = `https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`

      const requestBody = {
        jsonrpc: '2.0',
        method: 'alchemy_getAssetTransfers',
        params: [
          {
            fromBlock: '0x0',
            toBlock: 'latest',
            fromAddress: testAddress,
            maxCount: 10,
            category: ['external', 'internal', 'erc20', 'erc721', 'erc1155'],
            withMetadata: true,
            order: 'desc',
          },
        ],
        id: 1,
      }

      setRawRequest(JSON.stringify(requestBody, null, 2))

      console.log('🔧 Raw API request:', requestBody)

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      setRawResponse(JSON.stringify(data, null, 2))

      if (data.error) {
        throw new Error(`Alchemy API Error: ${data.error.message}`)
      }

      console.log('✅ Raw API response:', data)
      setResults(data.result)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      console.error('❌ Raw API test failed:', errorMessage)
      setResults({ error: errorMessage })
    } finally {
      setLoading(false)
    }
  }

  const testSpecificTransfer = async () => {
    if (!testAddress) {
      alert('Please enter a wallet address')
      return
    }

    setLoading(true)
    setResults(null)

    try {
      const ALCHEMY_API_KEY =
        process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || '1EacVcYetgk_QIWCKp4hI'
      const url = `https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`

      // Test with specific parameters like the documentation example
      const requestBody = {
        jsonrpc: '2.0',
        method: 'alchemy_getAssetTransfers',
        params: [
          {
            fromBlock: '0x0',
            toBlock: 'latest',
            toAddress: testAddress,
            category: ['external'],
            maxCount: 5,
            withMetadata: true,
          },
        ],
        id: 1,
      }

      setRawRequest(JSON.stringify(requestBody, null, 2))

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      const data = await response.json()
      setRawResponse(JSON.stringify(data, null, 2))

      if (data.error) {
        throw new Error(`Alchemy API Error: ${data.error.message}`)
      }

      setResults(data.result)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      setResults({ error: errorMessage })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='p-6 bg-white rounded-lg shadow-md'>
      <h2 className='text-2xl font-bold mb-4'>
        🔧 Raw Alchemy Transfers API Test
      </h2>

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
      <div className='flex space-x-4 mb-6'>
        <button
          onClick={testRawAPI}
          disabled={loading || !testAddress}
          className={`px-4 py-2 rounded-md font-medium transition-colors ${
            loading
              ? 'bg-blue-400 text-white cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed'
          }`}
        >
          {loading ? '⏳ Testing...' : '🔧'} Test Raw API (From Address)
        </button>

        <button
          onClick={testSpecificTransfer}
          disabled={loading || !testAddress}
          className={`px-4 py-2 rounded-md font-medium transition-colors ${
            loading
              ? 'bg-green-400 text-white cursor-not-allowed'
              : 'bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed'
          }`}
        >
          {loading ? '⏳ Testing...' : '📨'} Test Raw API (To Address)
        </button>
      </div>

      {/* Raw Request/Response Display */}
      {(rawRequest || rawResponse) && (
        <div className='mb-6 space-y-4'>
          {rawRequest && (
            <div>
              <h3 className='font-semibold text-gray-900 mb-2'>
                📤 Raw Request:
              </h3>
              <pre className='bg-gray-100 p-3 rounded-md text-xs overflow-x-auto border'>
                {rawRequest}
              </pre>
            </div>
          )}

          {rawResponse && (
            <div>
              <h3 className='font-semibold text-gray-900 mb-2'>
                📥 Raw Response:
              </h3>
              <pre className='bg-gray-100 p-3 rounded-md text-xs overflow-x-auto border max-h-64'>
                {rawResponse}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Results Display */}
      {results && (
        <div className='mb-6'>
          <h3 className='text-lg font-semibold mb-3'>
            {results.error ? '❌' : '✅'} API Results:
          </h3>

          {results.error ? (
            <div className='bg-red-50 border border-red-200 rounded-lg p-4'>
              <div className='text-red-700'>
                <strong>Error:</strong> {results.error}
              </div>
            </div>
          ) : (
            <div className='bg-green-50 border border-green-200 rounded-lg p-4'>
              <div className='space-y-3'>
                <div>
                  <strong>Total Transfers:</strong>{' '}
                  {results.transfers?.length || 0}
                </div>
                <div>
                  <strong>Page Key:</strong> {results.pageKey || 'None'}
                </div>

                {results.transfers && results.transfers.length > 0 && (
                  <div className='space-y-3'>
                    <strong>Sample Transfers:</strong>
                    {results.transfers
                      .slice(0, 3)
                      .map((transfer: any, index: number) => (
                        <div
                          key={index}
                          className='bg-white p-3 rounded border text-sm'
                        >
                          <div className='grid grid-cols-2 gap-2'>
                            <div>
                              <strong>Block:</strong> {transfer.blockNum}
                            </div>
                            <div>
                              <strong>Category:</strong> {transfer.category}
                            </div>
                            <div>
                              <strong>Asset:</strong> {transfer.asset}
                            </div>
                            <div>
                              <strong>Value:</strong> {transfer.value}
                            </div>
                            <div>
                              <strong>From:</strong>{' '}
                              {transfer.from?.slice(0, 10)}...
                            </div>
                            <div>
                              <strong>To:</strong> {transfer.to?.slice(0, 10)}
                              ...
                            </div>
                            <div className='col-span-2'>
                              <strong>Hash:</strong>
                              <a
                                href={`https://sepolia.basescan.org/tx/${transfer.hash}`}
                                target='_blank'
                                rel='noopener noreferrer'
                                className='text-blue-600 hover:text-blue-800 underline ml-1'
                              >
                                {transfer.hash?.slice(0, 16)}...
                              </a>
                            </div>
                            {transfer.uniqueId && (
                              <div className='col-span-2 text-xs text-gray-500'>
                                <strong>Unique ID:</strong> {transfer.uniqueId}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* API Info */}
      <div className='text-sm text-gray-600 bg-gray-50 p-3 rounded-lg'>
        <div>
          <strong>Network:</strong> Base Sepolia
        </div>
        <div>
          <strong>Method:</strong> alchemy_getAssetTransfers
        </div>
        <div>
          <strong>Endpoint:</strong>{' '}
          https://base-sepolia.g.alchemy.com/v2/[API_KEY]
        </div>
        <div>
          <strong>Documentation:</strong>
          <a
            href='https://docs.alchemy.com/reference/alchemy-getassettransfers'
            target='_blank'
            rel='noopener noreferrer'
            className='text-blue-600 hover:text-blue-800 underline ml-1'
          >
            Alchemy Transfers API
          </a>
        </div>
      </div>
    </div>
  )
}
