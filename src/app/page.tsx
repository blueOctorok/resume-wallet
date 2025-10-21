'use client'

import { useState, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Navigation from '@/components/Navigation'
import AnimatedBackground from '@/components/AnimatedBackground'
import UserStatusModal from '@/components/UserStatusModal'
import WalletCard from '@/components/WalletCard'
import { useTheme } from '@/contexts/ThemeContext'

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

const PersonalinfoForm1 = dynamic(
  () =>
    import('@/components/driver-application/PersonalinfoForm1').then(
      (mod) => mod.default
    ),
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

const PersonalInfoForm2 = dynamic(
  () =>
    import('@/components/driver-application/PersonalInfoForm2').then(
      (mod) => mod.default
    ),
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

const PersonalInfoForm3 = dynamic(
  () =>
    import('@/components/driver-application/PersonalInfoForm3').then(
      (mod) => mod.default
    ),
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
  const [currentForm, setCurrentForm] = useState(1)
  const { theme } = useTheme()

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

  // Wallet modal handler (same as status modal for now)
  const handleWalletClick = useCallback(() => {
    setIsModalOpen(true)
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

  // Form navigation handler
  const handleFormNavigation = useCallback((formNumber: number) => {
    setCurrentForm(formNumber)
  }, [])

  // Render form content based on current form
  const renderFormContent = () => {
    switch (currentForm) {
      case 1:
        return <PersonalinfoForm1 />
      case 2:
        return <PersonalInfoForm2 />
      case 3:
        return <PersonalInfoForm3 />
      default:
        return <PersonalinfoForm1 />
    }
  }

  // Render form navigation buttons
  const renderFormNavigation = () => {
    if (currentPage !== 'dotapp') return null

    return (
      <div className='flex justify-center mb-8'>
        <div className='flex space-x-4'>
          <button
            onClick={() => handleFormNavigation(1)}
            className={`px-6 py-3 rounded-md font-semibold transition-all duration-200 ${
              currentForm === 1
                ? theme === 'dark'
                  ? 'bg-brand-mint text-white shadow-lg'
                  : 'bg-brand-sage text-white shadow-lg'
                : theme === 'dark'
                  ? 'bg-gray-700 text-white hover:bg-gray-600 border-2 border-gray-600'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-2 border-gray-300'
            }`}
          >
            Form 1: Personal Info
          </button>
          <button
            onClick={() => handleFormNavigation(2)}
            className={`px-6 py-3 rounded-md font-semibold transition-all duration-200 ${
              currentForm === 2
                ? theme === 'dark'
                  ? 'bg-brand-mint text-white shadow-lg'
                  : 'bg-brand-sage text-white shadow-lg'
                : theme === 'dark'
                  ? 'bg-gray-700 text-white hover:bg-gray-600 border-2 border-gray-600'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-2 border-gray-300'
            }`}
          >
            Form 2: Driving & Records
          </button>
          <button
            onClick={() => handleFormNavigation(3)}
            className={`px-6 py-3 rounded-md font-semibold transition-all duration-200 ${
              currentForm === 3
                ? theme === 'dark'
                  ? 'bg-brand-mint text-white shadow-lg'
                  : 'bg-brand-sage text-white shadow-lg'
                : theme === 'dark'
                  ? 'bg-gray-700 text-white hover:bg-gray-600 border-2 border-gray-600'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-2 border-gray-300'
            }`}
          >
            Form 3: Employment & Signature
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className='min-h-screen overflow-x-hidden relative'>
      {/* Animated Background */}
      <AnimatedBackground />

      {/* Wallet Card - Desktop Top Left */}
      {user && (
        <div className='hidden md:block fixed top-4 left-4 z-40'>
          <WalletCard
            user={user}
            onClick={handleWalletClick}
            isMobile={false}
          />
        </div>
      )}

      {/* Navigation with status indicator */}
      <Navigation
        isAuthenticated={!!user}
        user={user}
        onStatusClick={openModal}
        onWalletClick={handleWalletClick}
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
          <>
            {renderFormNavigation()}
            {renderFormContent()}
          </>
        )}

        {/* Welcome message when no page is selected */}
        {!currentPage && (
          <div className='max-w-2xl mx-auto text-center py-16'>
            <h2
              className={`text-4xl sm:text-5xl font-light mb-6 ${
                theme === 'light' ? 'text-gray-800' : 'text-brand-cream'
              }`}
            >
              Welcome to Veree
            </h2>
            <p
              className={`text-lg mb-8 ${
                theme === 'light' ? 'text-gray-600' : 'text-brand-cream/70'
              }`}
            >
              Click on Veree above to get started
            </p>
            <div className='flex flex-col sm:flex-row gap-4 justify-center'>
              <div
                className={`backdrop-blur-sm border rounded-2xl p-6 text-center ${
                  theme === 'light'
                    ? 'bg-white/80 border-brand-sage/30'
                    : 'bg-brand-sage-light/10 border-brand-mint/20'
                }`}
              >
                <h3
                  className={`font-semibold mb-2 ${
                    theme === 'light' ? 'text-gray-800' : 'text-brand-cream'
                  }`}
                >
                  Resume Verification
                </h3>
                <p
                  className={`text-sm ${
                    theme === 'light' ? 'text-gray-600' : 'text-brand-cream/60'
                  }`}
                >
                  Upload and verify your professional resume on the blockchain
                </p>
              </div>
              <div
                className={`backdrop-blur-sm border rounded-2xl p-6 text-center ${
                  theme === 'light'
                    ? 'bg-white/80 border-brand-sage/30'
                    : 'bg-brand-sage-light/10 border-brand-mint/20'
                }`}
              >
                <h3
                  className={`font-semibold mb-2 ${
                    theme === 'light' ? 'text-gray-800' : 'text-brand-cream'
                  }`}
                >
                  DOT Application
                </h3>
                <p
                  className={`text-sm ${
                    theme === 'light' ? 'text-gray-600' : 'text-brand-cream/60'
                  }`}
                >
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
