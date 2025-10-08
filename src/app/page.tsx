'use client'

// Dynamic import to avoid SSR issues with Alchemy hooks
const ResumeUploadWithVerification = dynamic(
  () => import('@/components/ResumeUploadWithVerification'),
  {
    ssr: false,
    loading: () => (
      <div className='bg-brand-cream p-6 rounded-xl shadow-lg border border-brand-mint/20'>
        <div className='animate-pulse'>
          <div className='h-6 bg-brand-mint/20 rounded mb-4'></div>
          <div className='h-4 bg-brand-mint/20 rounded mb-4'></div>
          <div className='h-10 bg-brand-mint/20 rounded mb-4'></div>
          <div className='h-32 bg-brand-mint/20 rounded'></div>
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
    <div className='bg-brand-cream p-6 rounded-xl shadow-lg border border-brand-mint/20'>
      <div className='animate-pulse'>
        <div className='h-6 bg-brand-mint/20 rounded mb-4'></div>
        <div className='h-4 bg-brand-mint/20 rounded mb-4'></div>
        <div className='h-10 bg-brand-mint/20 rounded'></div>
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
import ThemeToggle from '@/components/ThemeToggle'

const Home = () => {
  const [user, setUser] = useState<any>(null)

  // Stable callback to prevent infinite loops
  const handleAuthSuccess = useCallback((userData: any) => {
    console.log('✅ Multi-method authentication successful:', userData)
    setUser(userData)
  }, [])

  return (
    <div className='min-h-screen bg-brand-cream'>
      {/* Header */}
      <header className='bg-brand-cream dark:bg-brand-sage shadow-lg border-b-2 border-brand-mint dark:border-brand-mint/50'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='flex justify-between items-center py-8'>
            <div>
              <h1 className='text-4xl font-bold bg-gradient-to-r from-brand-sage to-brand-sage-light bg-clip-text text-transparent'>
                DriverAppChain
              </h1>
              <p className='text-brand-sage-light dark:text-brand-sage-light text-lg font-medium'>
                AI-powered, blockchain-verified employment platform
              </p>
            </div>
            <div className='hidden md:flex items-center space-x-4'>
              <ThemeToggle />
              <div className='w-12 h-12 bg-gradient-to-br from-brand-mint to-brand-sage-light rounded-full flex items-center justify-center'>
                <span className='text-white font-bold text-xl'>DA</span>
              </div>
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

            <div className='bg-brand-cream dark:bg-brand-sage p-6 rounded-xl shadow-lg border border-brand-mint/20 dark:border-brand-mint/10'>
              <h3 className='text-lg font-semibold text-brand-sage dark:text-brand-sage mb-4 flex items-center'>
                <span className='w-2 h-2 bg-brand-mint rounded-full mr-2'></span>
                Quick Actions
              </h3>
              <div className='space-y-3'>
                <button className='w-full text-left px-4 py-3 text-sm text-brand-sage dark:text-brand-sage hover:bg-brand-cream dark:hover:bg-brand-cream rounded-lg transition-colors duration-200 border border-transparent hover:border-brand-mint/30 dark:hover:border-brand-mint/20'>
                  📄 View My Resumes
                </button>
                <button className='w-full text-left px-4 py-3 text-sm text-brand-sage dark:text-brand-sage hover:bg-brand-cream dark:hover:bg-brand-cream rounded-lg transition-colors duration-200 border border-transparent hover:border-brand-mint/30 dark:hover:border-brand-mint/20'>
                  👤 Update Profile
                </button>
                <button className='w-full text-left px-4 py-3 text-sm text-brand-sage dark:text-brand-sage hover:bg-brand-cream dark:hover:bg-brand-cream rounded-lg transition-colors duration-200 border border-transparent hover:border-brand-mint/30 dark:hover:border-brand-mint/20'>
                  🔍 Browse Jobs
                </button>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className='lg:col-span-2'>
            <div className='mb-8 p-6 bg-gradient-to-r from-brand-cream/90 to-brand-sage-light/80 dark:from-brand-mint/5 dark:to-brand-cream/10 rounded-xl border border-brand-cream/50 dark:border-brand-mint/10'>
              <h2 className='text-3xl font-bold text-brand-sage dark:text-brand-sage mb-3'>
                Welcome to DriverAppChain 🚛
              </h2>
              <p className='text-brand-sage-light dark:text-brand-sage-light text-lg'>
                Upload your resume to get started with AI-powered job matching
                and blockchain verification.
              </p>
              <div className='mt-4 flex items-center space-x-4 text-sm text-brand-sage-light dark:text-brand-sage-light'>
                <span className='flex items-center'>
                  <span className='w-2 h-2 bg-brand-mint rounded-full mr-2'></span>
                  AI-Powered Matching
                </span>
                <span className='flex items-center'>
                  <span className='w-2 h-2 bg-brand-mint rounded-full mr-2'></span>
                  Blockchain Verified
                </span>
                <span className='flex items-center'>
                  <span className='w-2 h-2 bg-brand-mint rounded-full mr-2'></span>
                  Secure & Private
                </span>
              </div>
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
