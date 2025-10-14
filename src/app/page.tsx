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
  const [currentPage, setCurrentPage] = useState<
    'signin' | 'resume' | 'dotapp' | null
  >(null)

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
    // This will handle both Alchemy logout AND call onLogoutSuccess which sets user to null
    if ((window as any).__alchemyLogout) {
      ;(window as any).__alchemyLogout()
    } else {
      // Fallback if Alchemy logout is not available
      setUser(null)
    }
  }, [])

  // Navigation handler
  const handleNavigation = useCallback(
    (page: 'signin' | 'resume' | 'dotapp') => {
      console.log(`Navigating to: ${page}`)
      setCurrentPage(page)
    },
    []
  )

  return (
    <div className='min-h-screen overflow-x-hidden relative'>
      {/* Animated Background */}
      <AnimatedBackground />

      {/* Navigation with status indicator */}
      <Navigation
        isAuthenticated={!!user}
        onStatusClick={openModal}
        onNavigate={handleNavigation}
      />

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
        {/* Conditional Content Based on Navigation */}
        {currentPage === 'signin' && !user && (
          <div className='max-w-md mx-auto'>
            <AlchemyAuth
              onAuthSuccess={handleAuthSuccess}
              onLogoutSuccess={() => setUser(null)}
            />
          </div>
        )}

        {currentPage === 'resume' && (
          <div className='max-w-4xl mx-auto space-y-6'>
            <ResumeUploadWithVerification />
            {user && <WalletTransactions />}
          </div>
        )}

        {currentPage === 'dotapp' && (
          <div className='max-w-4xl mx-auto'>
            <DriverApplication user={user} />
          </div>
        )}

        {/* Welcome message when no page is selected */}
        {!currentPage && (
          <div className='max-w-2xl mx-auto text-center py-16'>
            <h2 className='text-4xl sm:text-5xl font-light text-brand-cream mb-6'>
              Welcome to Veree
            </h2>
            <p className='text-brand-cream/70 text-lg mb-8'>
              Click on Veree above to get started
            </p>
            <div className='flex flex-col sm:flex-row gap-4 justify-center'>
              <div className='bg-brand-sage-light/10 backdrop-blur-sm border border-brand-mint/20 rounded-2xl p-6 text-center'>
                <h3 className='text-brand-cream font-semibold mb-2'>
                  Resume Verification
                </h3>
                <p className='text-brand-cream/60 text-sm'>
                  Upload and verify your professional resume on the blockchain
                </p>
              </div>
              <div className='bg-brand-sage-light/10 backdrop-blur-sm border border-brand-mint/20 rounded-2xl p-6 text-center'>
                <h3 className='text-brand-cream font-semibold mb-2'>
                  DOT Application
                </h3>
                <p className='text-brand-cream/60 text-sm'>
                  Complete your Department of Transportation driver application
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Home
