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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // Stable callback to prevent infinite loops
  const handleAuthSuccess = useCallback((userData: any) => {
    console.log('✅ Multi-method authentication successful:', userData)
    setUser(userData)
  }, [])

  return (
    <div className='min-h-screen bg-brand-cream'>
      {/* Header */}
      <header className='fixed top-3 sm:top-6 left-1/2 transform -translate-x-1/2 w-full max-w-sm sm:max-w-2xl lg:max-w-5xl mx-3 sm:mx-4 z-50'>
        <nav className='bg-brand-cream/80 dark:bg-brand-sage/80 backdrop-blur-md rounded-2xl shadow-xl border border-brand-mint/30 dark:border-brand-mint/20'>
          <div className='px-3 sm:px-4 lg:px-6 py-3 sm:py-4'>
            <div className='flex items-center justify-between w-full'>
              <div className='flex-1'>
                <h1 className='text-xl sm:text-2xl lg:text-4xl font-extralight bg-gradient-to-r from-brand-sage to-brand-sage-light bg-clip-text'>
                  Veree
                </h1>
              </div>

              {/* Desktop Navigation */}
              <div className='hidden md:flex items-center space-x-4'>
                <ThemeToggle />
              </div>

              {/* Mobile Menu Button */}
              <button
                className='md:hidden p-2 rounded-lg hover:bg-brand-mint/20 transition-colors bg-brand-sage/20 dark:bg-brand-sage/30'
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                aria-label='Toggle mobile menu'
              >
                <div className='w-5 h-5 flex flex-col justify-center space-y-1'>
                  <div
                    className={`w-full h-0.5 bg-brand-sage dark:bg-brand-sage-light transition-transform duration-200 ${isMobileMenuOpen ? 'rotate-45 translate-y-1' : ''}`}
                  ></div>
                  <div
                    className={`w-full h-0.5 bg-brand-sage dark:bg-brand-sage-light transition-opacity duration-200 ${isMobileMenuOpen ? 'opacity-0' : ''}`}
                  ></div>
                  <div
                    className={`w-full h-0.5 bg-brand-sage dark:bg-brand-sage-light transition-transform duration-200 ${isMobileMenuOpen ? '-rotate-45 -translate-y-1' : ''}`}
                  ></div>
                </div>
              </button>
            </div>

            {/* Mobile Menu Dropdown */}
            {isMobileMenuOpen && (
              <div className='md:hidden mt-4 pt-4 border-t border-brand-mint/20 dark:border-brand-mint/10'>
                <div className='flex flex-col space-y-3'>
                  <div className='flex items-center justify-center'>
                    <ThemeToggle />
                  </div>
                </div>
              </div>
            )}
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8'>
        <div className='grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8'>
          {/* Left Sidebar - Stats & Quick Actions */}
          <div className='lg:col-span-1 space-y-4 sm:space-y-6 pt-16 sm:pt-20 lg:pt-32'>
            {/* Multi-Method Authentication */}
            <MultiMethodAuth mode='general' onAuthSuccess={handleAuthSuccess} />

            {/* User-specific Stats (only shown when logged in) */}
            <QuickStats userAddress={user?.address} />

            <div className='bg-brand-cream dark:bg-brand-sage p-4 sm:p-6 rounded-xl shadow-lg border border-brand-mint/20 dark:border-brand-mint/10'>
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
          <div className='lg:col-span-2 pt-16 sm:pt-20 lg:pt-32'>
            {/* Resume Upload with Full Verification */}
            <div className='mb-4 sm:mb-8'>
              <ResumeUploadWithVerification user={user} />
            </div>

            {/* Driver Application */}
            <div className='mt-4 sm:mt-8'>
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
