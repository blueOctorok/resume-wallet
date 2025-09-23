'use client'

/**
 * Alchemy Smart Wallets Test Component
 *
 * Test the new authentication system with different modes:
 * - Driver mode (resume verification)
 * - Employer mode (access verified drivers)
 * - General mode (platform access)
 */

import { useState } from 'react'
import AlchemyAuth, { useAlchemyAuth } from '@/components/AlchemyAuth'

export default function AlchemyAuthTest() {
  const [mode, setMode] = useState<'driver' | 'employer' | 'general'>('general')
  const [authData, setAuthData] = useState<any>(null)

  const { isConnected, address, email, chain } = useAlchemyAuth()

  const handleAuthSuccess = (userData: any) => {
    setAuthData(userData)
    console.log('🎉 Authentication successful:', userData)
  }

  return (
    <div className='max-w-4xl mx-auto p-6'>
      <div className='bg-white rounded-lg shadow-lg p-6'>
        <h2 className='text-2xl font-bold mb-6 text-gray-800'>
          🔐 Alchemy Smart Wallets Authentication Test
        </h2>

        <div className='mb-6 p-4 bg-blue-50 rounded-lg'>
          <h3 className='font-semibold text-blue-800 mb-2'>What This Tests:</h3>
          <ul className='text-blue-700 space-y-1'>
            <li>• Email + OTP authentication (dead simple for users)</li>
            <li>• Automatic wallet creation (users don't know it's crypto)</li>
            <li>• Professional SaaS appearance</li>
            <li>• Different modes for drivers vs employers</li>
            <li>• Integration with existing Alchemy APIs</li>
          </ul>
        </div>

        {/* Mode Selection */}
        <div className='mb-6'>
          <h3 className='font-semibold mb-3'>Select Authentication Mode:</h3>
          <div className='flex gap-3'>
            <button
              onClick={() => setMode('driver')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                mode === 'driver'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              🚛 Driver Mode
            </button>
            <button
              onClick={() => setMode('employer')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                mode === 'employer'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              🏢 Employer Mode
            </button>
            <button
              onClick={() => setMode('general')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                mode === 'general'
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              👤 General Mode
            </button>
          </div>
        </div>

        {/* Authentication Component */}
        <div className='mb-6'>
          <AlchemyAuth mode={mode} onAuthSuccess={handleAuthSuccess} />
        </div>

        {/* Connection Status */}
        <div className='mb-6 p-4 bg-gray-50 rounded-lg'>
          <h3 className='font-semibold mb-2'>Connection Status:</h3>
          <div className='space-y-2 text-sm'>
            <div>
              <span className='font-medium'>Connected:</span>
              <span
                className={`ml-2 ${isConnected ? 'text-green-600' : 'text-red-600'}`}
              >
                {isConnected ? '✅ Yes' : '❌ No'}
              </span>
            </div>
            {address && (
              <div>
                <span className='font-medium'>Wallet Address:</span>
                <span className='ml-2 font-mono text-xs'>
                  {address.slice(0, 8)}...{address.slice(-6)}
                </span>
              </div>
            )}
            {email && (
              <div>
                <span className='font-medium'>Email:</span>
                <span className='ml-2'>{email}</span>
              </div>
            )}
            {chain && (
              <div>
                <span className='font-medium'>Network:</span>
                <span className='ml-2'>{chain.name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Authentication Data */}
        {authData && (
          <div className='mb-6'>
            <h3 className='font-semibold mb-2'>Authentication Data:</h3>
            <div className='bg-gray-100 rounded-lg p-4'>
              <pre className='text-xs overflow-auto'>
                {JSON.stringify(authData, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* Mode Descriptions */}
        <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
          <div className='p-4 border rounded-lg'>
            <h4 className='font-semibold text-blue-600 mb-2'>🚛 Driver Mode</h4>
            <p className='text-sm text-gray-600'>
              For truck drivers, delivery drivers, rideshare drivers who want to
              verify their resumes. Simple email signup, $5 USDC verification
              fee.
            </p>
          </div>
          <div className='p-4 border rounded-lg'>
            <h4 className='font-semibold text-green-600 mb-2'>
              🏢 Employer Mode
            </h4>
            <p className='text-sm text-gray-600'>
              For companies and employers who want to access verified driver
              database. Professional signup, $2 USDC per verification check.
            </p>
          </div>
          <div className='p-4 border rounded-lg'>
            <h4 className='font-semibold text-purple-600 mb-2'>
              👤 General Mode
            </h4>
            <p className='text-sm text-gray-600'>
              General platform access for testing and development. Standard
              authentication flow.
            </p>
          </div>
        </div>

        {/* Next Steps */}
        {isConnected && (
          <div className='mt-6 p-4 bg-green-50 rounded-lg'>
            <h3 className='font-semibold text-green-800 mb-2'>
              🎉 Ready for Next Steps:
            </h3>
            <ul className='text-green-700 space-y-1'>
              <li>• Test USDC balance checking with new wallet</li>
              <li>• Test transaction simulation with new address</li>
              <li>• Test webhook notifications for new wallet</li>
              <li>• Deploy ResumeRegistry contract</li>
              <li>• Test end-to-end resume verification flow</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
