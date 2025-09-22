'use client'

import { useState } from 'react'
import { testAlchemyConnection, alchemyClient } from '@/lib/alchemy'

export default function AlchemyTest() {
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<{
    success: boolean
    blockNumber?: bigint
    error?: string
  } | null>(null)

  const handleTest = async () => {
    setTesting(true)
    setResult(null)

    try {
      // First try with raw fetch to debug
      console.log('🧪 Testing with raw fetch first...')
      // Use correct API key and back to Sepolia
      const rawResponse = await fetch(
        'https://base-sepolia.g.alchemy.com/v2/1EacVcYetgk_QIWCKp4hI',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_blockNumber',
            params: [],
          }),
        }
      )

      const rawData = await rawResponse.json()
      console.log('🧪 Raw fetch result:', rawData)

      if (rawData.result) {
        setResult({
          success: true,
          blockNumber: BigInt(rawData.result),
        })
        return
      }

      // If raw fetch fails, try Viem
      const testResult = await testAlchemyConnection()
      setResult(testResult)
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className='p-6 bg-white rounded-lg shadow-md'>
      <h2 className='text-2xl font-bold mb-4'>🔗 Alchemy RPC Test</h2>

      <div className='space-y-4'>
        <button
          onClick={handleTest}
          disabled={testing}
          className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50'
        >
          {testing ? 'Testing Connection...' : 'Test Alchemy Connection'}
        </button>

        {result && (
          <div
            className={`p-4 rounded-md ${
              result.success
                ? 'bg-green-100 border border-green-300'
                : 'bg-red-100 border border-red-300'
            }`}
          >
            {result.success ? (
              <div>
                <div className='text-green-800 font-semibold'>
                  ✅ Connection Successful!
                </div>
                <div className='text-green-700 mt-1'>
                  Latest Block Number: {result.blockNumber?.toString()}
                </div>
                <div className='text-sm text-green-600 mt-2'>
                  🎯 Alchemy RPC is working correctly with Base Sepolia
                </div>
              </div>
            ) : (
              <div>
                <div className='text-red-800 font-semibold'>
                  ❌ Connection Failed
                </div>
                <div className='text-red-700 mt-1'>Error: {result.error}</div>
              </div>
            )}
          </div>
        )}

        <div className='text-sm text-gray-600 bg-gray-50 p-3 rounded'>
          <strong>Testing:</strong> Base Sepolia network via Alchemy RPC
          <br />
          <strong>Chain ID:</strong> 84532
          <br />
          <strong>Purpose:</strong> Verify blockchain infrastructure layer is
          working
        </div>
      </div>
    </div>
  )
}
