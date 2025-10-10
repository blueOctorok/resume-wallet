'use client'

import { useState, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Navigation from '@/components/Navigation'
import AnimatedBackground from '@/components/AnimatedBackground'
import UserStatusModal from '@/components/UserStatusModal'

// Dynamic imports to avoid SSR issues with Alchemy hooks
const ResumeUploadWithVerification = dynamic(
  () => import('@/components/ResumeUploadWithVerification'),
  {
    ssr: false,
    loading: () => (
      <div className='bg-brand-sage-light/10 backdrop-blur-sm border border-brand-mint/20 rounded-2xl p-8 shadow-xl'>
        <div className='space-y-4 animate-pulse'>
          <div className='h-6 bg-brand-sage-light/20 rounded w-48' />
          <div className='h-4 bg-brand-sage-light/20 rounded w-full' />
          <div className='h-4 bg-brand-sage-light/20 rounded w-3/4' />
        </div>
      </div>
    ),
  }
)

const AlchemyAuth = dynamic(
  () => import('@/components/AlchemyAuth').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className='bg-brand-sage-light/10 backdrop-blur-sm border border-brand-mint/20 rounded-2xl p-8 shadow-xl'>
        <div className='space-y-4 animate-pulse'>
          <div className='h-6 bg-brand-sage-light/20 rounded w-32' />
          <div className='h-10 bg-brand-sage-light/20 rounded w-full' />
        </div>
      </div>
    ),
  }
)

const DriverApplication = dynamic(
  () => import('@/components/DriverApplication').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className='bg-brand-sage-light/10 backdrop-blur-sm border border-brand-mint/20 rounded-2xl p-8 shadow-xl'>
        <div className='space-y-4 animate-pulse'>
          <div className='h-6 bg-brand-sage-light/20 rounded w-40' />
          <div className='h-4 bg-brand-sage-light/20 rounded w-full' />
        </div>
      </div>
    ),
  }
)

const WalletTransactions = dynamic(
  () =>
    import('@/components/WalletTransactions').then(
      (mod) => mod.WalletTransactions
    ),
  {
    ssr: false,
    loading: () => (
      <div className='bg-brand-sage-light/10 backdrop-blur-sm border border-brand-mint/20 rounded-2xl p-8 shadow-xl'>
        <div className='space-y-4 animate-pulse'>
          <div className='h-6 bg-brand-sage-light/20 rounded w-48' />
          <div className='h-20 bg-brand-sage-light/20 rounded w-full' />
        </div>
      </div>
    ),
  }
)

const Home = () => {
  const [user, setUser] = useState<any>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Debug: Log user state changes
  useEffect(() => {
    console.log('🎯 [HOME] User state changed:', user)
  }, [user])

  // Stable callback to prevent infinite loops
  const handleAuthSuccess = useCallback((userData: any) => {
    console.log('🎯 [HOME] handleAuthSuccess called with:', userData)
    setUser(userData)
    console.log('🎯 [HOME] User state updated')
  }, [])

  // Modal handlers
  const openModal = useCallback(() => {
    setIsModalOpen(true)
  }, [])

  const closeModal = useCallback(() => {
    setIsModalOpen(false)
  }, [])

  // Logout handler
  const handleLogout = useCallback(() => {
    // Call the Alchemy logout function if available
    if ((window as any).__alchemyLogout) {
      ;(window as any).__alchemyLogout()
    }
    setUser(null)
  }, [])

  // Quick action handlers
  const handleQuickAction = (action: string) => {
    console.log(`Quick action: ${action}`)
    // TODO: Implement navigation to respective pages
  }

  return (
    <div className='min-h-screen bg-brand-sage overflow-x-hidden relative'>
      {/* Animated Background */}
      <AnimatedBackground />

      {/* Navigation with status indicator */}
      <Navigation isAuthenticated={!!user} onStatusClick={openModal} />

      {/* User Status Modal */}
      <UserStatusModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onLogout={handleLogout}
        user={{
          email: user?.email,
          address: user?.address,
          chain: user?.chain,
        }}
      />

      {/* Main Content */}
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 mt-3'>
        {/* Main Grid */}
        <div className='grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8'>
          {/* Left Column - Auth (only when not signed in) */}
          {!user && (
            <div className='lg:col-span-1 space-y-6'>
              <AlchemyAuth
                onAuthSuccess={handleAuthSuccess}
                onLogoutSuccess={() => setUser(null)}
              />
            </div>
          )}

          {/* Right Column - Main Content */}
          <div
            className={`${!user ? 'lg:col-span-2' : 'lg:col-span-3'} space-y-6`}
          >
            {/* Resume Upload */}
            <ResumeUploadWithVerification />

            {/* Driver Application */}
            <DriverApplication user={user} />

            {/* Wallet Transactions */}
            {user && <WalletTransactions />}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Home
