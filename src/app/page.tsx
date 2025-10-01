'use client'

// Dynamic import to avoid SSR issues with Alchemy hooks
const ResumeUploadWithVerification = dynamic(
  () => import('@/components/ResumeUploadWithVerification'),
  {
    ssr: false,
    loading: () => (
      <div className='bg-white p-6 rounded-lg shadow-sm border border-gray-200'>
        <div className='animate-pulse'>
          <div className='h-6 bg-gray-200 rounded mb-4'></div>
          <div className='h-4 bg-gray-200 rounded mb-4'></div>
          <div className='h-10 bg-gray-200 rounded mb-4'></div>
          <div className='h-32 bg-gray-200 rounded'></div>
        </div>
      </div>
    ),
  }
)

import { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import DriverApplication from '@/components/DriverApplication'

// Dynamic import to avoid SSR issues with Alchemy hooks
const MultiMethodAuth = dynamic(() => import('@/components/EmailOTPAuth'), {
  ssr: false,
  loading: () => (
    <div className='bg-white p-6 rounded-lg shadow-sm border border-gray-200'>
      <div className='animate-pulse'>
        <div className='h-6 bg-gray-200 rounded mb-4'></div>
        <div className='h-4 bg-gray-200 rounded mb-4'></div>
        <div className='h-10 bg-gray-200 rounded'></div>
      </div>
    </div>
  ),
})
import { WalletTransactions } from '@/components/WalletTransactions'
import AlchemyTest from '@/components/AlchemyTest'
import TokenAPITest from '@/components/TokenAPITest'
import TransactionHistory from '@/components/TransactionHistory'
import SimulationAPITest from '@/components/SimulationAPITest'
import WebhookTest from '@/components/WebhookTest'
import QuickStats from '@/components/QuickStats'

const Home = () => {
  const [user, setUser] = useState<any>(null)

  // Stable callback to prevent infinite loops
  const handleAuthSuccess = useCallback((userData: any) => {
    console.log('✅ Multi-method authentication successful:', userData)
    setUser(userData)
  }, [])

  return (
    <div className='min-h-screen bg-gray-50'>
      {/* Header */}
      <header className='bg-white shadow-sm border-b border-gray-200'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='flex justify-between items-center py-6'>
            <div>
              <h1 className='text-3xl font-bold text-gray-900'>
                DriverAppChain
              </h1>
              <p className='text-gray-600'>
                AI-powered, blockchain-verified employment platform
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
        <div className='grid grid-cols-1 lg:grid-cols-3 gap-8'>
          {/* Left Sidebar - Stats & Quick Actions */}
          <div className='lg:col-span-1 space-y-6'>
            {/* Multi-Method Authentication */}
            <MultiMethodAuth mode='general' onAuthSuccess={handleAuthSuccess} />

            {/* User-specific Stats (only shown when logged in) */}
            <QuickStats userAddress={user?.address} />

            <div className='bg-white p-6 rounded-lg shadow-sm border border-gray-200'>
              <h3 className='text-lg font-medium text-gray-900 mb-4'>
                Quick Actions
              </h3>
              <div className='space-y-3'>
                <button className='w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md'>
                  View My Resumes
                </button>
                <button className='w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md'>
                  Update Profile
                </button>
                <button className='w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-md'>
                  Browse Jobs
                </button>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className='lg:col-span-2'>
            <div className='mb-6'>
              <h2 className='text-2xl font-bold text-gray-900 mb-2'>
                Welcome to DriverAppChain
              </h2>
              <p className='text-gray-600'>
                Upload your resume to get started with AI-powered job matching
                and blockchain verification.
              </p>
            </div>

            {/* Resume Upload with Full Verification */}
            <div className='mb-8'>
              <ResumeUploadWithVerification user={user} />
            </div>

            {/* Driver Application */}
            <div className='mt-8'>
              <DriverApplication user={user} />
            </div>

            {/* Wallet Transaction Tests */}
            <div className='mt-8'>
              <WalletTransactions walletAddress={user?.address || ''} />
            </div>

            {/* Alchemy Infrastructure Test */}
            <div className='mt-8'>
              <AlchemyTest />
            </div>

            {/* Token API Test */}
            <div className='mt-8'>
              <TokenAPITest walletAddress={user?.address} />
            </div>

            {/* Transaction History */}
            {user?.address && (
              <div className='mt-8'>
                <div className='mb-4'>
                  <h2 className='text-xl font-bold'>📊 Transaction History</h2>
                </div>
                <TransactionHistory
                  walletAddress={user.address}
                  maxTransactions={20}
                  showFilters={true}
                  autoRefresh={false}
                />
              </div>
            )}

            {/* Transaction Simulation */}
            <div className='mt-8'>
              <div className='mb-4'>
                <h2 className='text-xl font-bold'>🧪 Transaction Simulation</h2>
                <p className='text-gray-600'>
                  Preview transaction costs and asset changes before sending
                </p>
              </div>
              <SimulationAPITest />
            </div>

            {/* Alchemy Webhooks Test */}
            <div className='mt-8'>
              <div className='mb-4'>
                <h2 className='text-xl font-bold'>🔗 Alchemy Webhooks</h2>
                <p className='text-gray-600'>
                  Set up real-time notifications for transaction completion
                </p>
              </div>
              <WebhookTest />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default Home
