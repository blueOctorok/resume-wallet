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

const PersonalInfoForm1 = dynamic(
  () =>
    import('@/components/driver-application/PersonalInfoForm1').then(
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

const ApplicationSubmitted = dynamic(
  () =>
    import('@/components/driver-application/ApplicationSubmitted').then(
      (mod) => mod.default
    ),
  {
    ssr: false,
    loading: () => (
      <div className='bg-brand-sage-light/10 backdrop-blur-sm border border-brand-mint/20 rounded-2xl p-8 shadow-xl'>
        <div className='space-y-4 animate-pulse'>
          <div className='h-6 bg-brand-sage-light/20 rounded w-48' />
          <div className='h-4 bg-brand-sage-light/20 rounded w-full' />
        </div>
      </div>
    ),
  }
)

const DriverDashboard = dynamic(
  () =>
    import('@/components/driver-application/DriverDashboard').then(
      (mod) => mod.default
    ),
  {
    ssr: false,
    loading: () => (
      <div className='bg-brand-sage-light/10 backdrop-blur-sm border border-brand-mint/20 rounded-2xl p-8 shadow-xl'>
        <div className='space-y-4 animate-pulse'>
          <div className='h-6 bg-brand-sage-light/20 rounded w-48' />
          <div className='h-4 bg-brand-sage-light/20 rounded w-full' />
        </div>
      </div>
    ),
  }
)

const EmploymentVerificationForm = dynamic(
  () =>
    import('@/components/driver-application/EmploymentVerificationForm').then(
      (mod) => mod.default
    ),
  {
    ssr: false,
    loading: () => (
      <div className='bg-brand-sage-light/10 backdrop-blur-sm border border-brand-mint/20 rounded-2xl p-8 shadow-xl'>
        <div className='space-y-4 animate-pulse'>
          <div className='h-6 bg-brand-sage-light/20 rounded w-48' />
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
  const [isDriverApplicationCompleted, setIsDriverApplicationCompleted] =
    useState(false)
  const [showEmploymentVerification, setShowEmploymentVerification] =
    useState(false)
  const [showDashboard, setShowDashboard] = useState(false)
  const [blockchainData, setBlockchainData] = useState<{
    transactionHash: string
    blockNumber: number
    applicationId: number | null
  } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const { theme } = useTheme()

  // Store form data from all three forms
  const [form1Data, setForm1Data] = useState<any>(null)
  const [form2Data, setForm2Data] = useState<any>(null)
  const [form3Data, setForm3Data] = useState<any>(null)

  // Debug: Log user state changes
  useEffect(() => {
    console.log('🎯 [HOME] User state changed:', user)
  }, [user])

  // Stable callback to prevent infinite loops
  const handleAuthSuccess = useCallback(
    (userData: any) => {
      console.log('🎯 [HOME] handleAuthSuccess called with:', userData)
      setUser(userData)
      console.log('🎯 [HOME] User state updated')
      // Auto-navigate to resume page after login
      if (!currentPage || currentPage === 'signin') {
        console.log('🎯 [HOME] Auto-navigating to resume page after login')
        setCurrentPage('resume')
      }
    },
    [currentPage]
  )

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

  // Handler for when driver application is completed
  const handleDriverApplicationCompleted = useCallback(async () => {
    // Prevent duplicate submissions
    if (isSubmitting) {
      console.log('⏸️ [HOME] Already submitting, ignoring duplicate call')
      return
    }

    try {
      setSubmissionError(null)
      setIsSubmitting(true)
      console.log('📝 [HOME] Form 3 completed, submitting to blockchain...')

      // Check if user is authenticated
      if (!user?.address) {
        console.error('❌ [HOME] User not authenticated')
        alert('Please sign in to submit your application.')
        setIsSubmitting(false)
        return
      }

      // Collect all form data
      if (!form1Data || !form2Data || !form3Data) {
        console.error('❌ [HOME] Missing form data:', {
          form1Data: !!form1Data,
          form2Data: !!form2Data,
          form3Data: !!form3Data,
        })
        alert('Please complete all forms before submitting.')
        setIsSubmitting(false)
        return
      }

      const combinedData = {
        form1: form1Data,
        form2: form2Data,
        form3: form3Data,
      }

      // Hash the combined data
      const { hashJson } = await import('@/lib/hash-utils')
      const applicationHash = await hashJson(combinedData)

      // Check for duplicate in database BEFORE submitting to blockchain
      console.log('🔍 [HOME] Checking database for duplicate hash...')
      const { checkDuplicateApplicationHash } = await import('@/lib/supabase-client-db')

      const duplicateCheck = await checkDuplicateApplicationHash(
        user.address,
        applicationHash
      )

      if (duplicateCheck.exists) {
        console.error('❌ [HOME] Duplicate application hash found in database')
        setIsSubmitting(false)
        alert(
          'This application has already been submitted. Please modify your application data before resubmitting.'
        )
        return
      }

      console.log('✅ [HOME] No duplicate found, proceeding with submission')

      // For now, use a placeholder IPFS hash (we can add IPFS upload later)
      const ipfsHash = 'placeholder_ipfs_hash_' + Date.now()

      console.log('📝 [HOME] Submitting to blockchain:', {
        applicationHash,
        ipfsHash,
      })

      // Submit to blockchain
      const response = await fetch(
        '/api/blockchain/submit-driver-application',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            applicationHash,
            ipfsHash,
            userAddress: user.address, // Pass user address for server-side duplicate check
          }),
        }
      )

      // Robust parse of response body
      let result: any = null
      let rawBody = ''
      try {
        rawBody = await response.text()
        result = rawBody ? JSON.parse(rawBody) : null
      } catch {
        // Non-JSON body; keep rawBody for logging
      }

      // Better error handling - check status code first, then result.success
      if (!response.ok) {
        console.warn('⚠️ [HOME] API Error Response:', {
          status: response.status,
          statusText: response.statusText,
          result,
          rawBody,
        })

        // Friendly duplicate message for 409 Conflict
        if (response.status === 409) {
          setSubmissionError(
            (result && (result.error || result.details)) ||
              'Duplicate application detected. This hash has already been submitted.'
          )
          setIsSubmitting(false)
          return
        }

        // For other errors, show UI message and stop without throwing
        setSubmissionError(
          (result && (result.error || result.details)) ||
            `Blockchain submission failed (${response.status}: ${response.statusText})`
        )
        setIsSubmitting(false)
        return
      }

      // Check for success field only if response was OK
      if (result.success === false) {
        console.warn('⚠️ [HOME] API returned success: false:', result)
        setSubmissionError(result.error || result.details || 'Blockchain submission failed')
        setIsSubmitting(false)
        return
      }

      console.log('✅ [HOME] Blockchain submission successful:', result)

      // Store blockchain data
      setBlockchainData({
        transactionHash: result.transactionHash,
        blockNumber: result.blockNumber,
        applicationId: result.applicationId,
      })

      // Save to database with application hash and blockchain data
      console.log('💾 [HOME] Saving application to database...')
      const { completeDriverApplicationClient } = await import('@/lib/supabase-client-db')
      
      const dbResult = await completeDriverApplicationClient(
        user.address,
        combinedData,
        ipfsHash
      )

      if (!dbResult.success) {
        console.error('❌ [HOME] Failed to save to database:', dbResult.error)
        // Don't fail the whole submission, but log it
      } else {
        // Update database with blockchain transaction hash and application ID
        const { createClient } = await import('@/utils/supabase/client')
        const supabase = createClient()
        
        // Get user_id
        const { data: userData } = await supabase
          .from('users')
          .select('id')
          .eq('wallet_address', user.address)
          .single()

        if (userData && dbResult.application) {
          await supabase
            .from('driver_applications')
            .update({
              application_hash: applicationHash,
              blockchain_tx_hash: result.transactionHash,
              blockchain_application_id: result.applicationId?.toString() || null,
              verification_status: 'VERIFIED',
              updated_at: new Date().toISOString(),
            })
            .eq('id', dbResult.application.id)
          
          console.log('✅ [HOME] Database updated with blockchain data')
        }
      }

      // Mark as completed
      setIsDriverApplicationCompleted(true)
    } catch (error: any) {
      console.warn('⚠️ [HOME] Failed to submit to blockchain:', error)
      setSubmissionError(error?.message || 'Failed to submit application')
    } finally {
      setIsSubmitting(false)
    }
  }, [form1Data, form2Data, form3Data, isSubmitting, user])

  // Handler for form navigation
  const handleFormNavigation = useCallback((formNumber: number) => {
    setCurrentForm(formNumber)
  }, [])

  // Handler for navigating to employment verification
  const handleNavigateToEmploymentVerification = useCallback(() => {
    console.log('🎯 [HOME] Navigating to employment verification')
    setShowEmploymentVerification(true)
  }, [])

  // Handler for navigating to dashboard
  const handleNavigateToDashboard = useCallback(() => {
    console.log('🎯 [HOME] Navigating to dashboard')
    setShowDashboard(true)
    setShowEmploymentVerification(false)
  }, [])

  // Handler for navigating back from dashboard
  const handleBackFromDashboard = useCallback(() => {
    console.log('🎯 [HOME] Going back from dashboard')
    setShowDashboard(false)
  }, [])

  // Render loading screen during blockchain submission
  const renderSubmissionLoading = () => (
    <div
      className={`max-w-4xl mx-auto p-6 ${
        theme === 'dark'
          ? 'bg-brand-sage-light/20 backdrop-blur-xl'
          : 'bg-white/80 backdrop-blur-xl'
      } rounded-2xl shadow-2xl relative z-10 border-t-4 ${
        theme === 'dark' ? 'border-brand-mint' : 'border-brand-sage'
      }`}
    >
      <div className='text-center py-12'>
        <div className='mb-6'>
          <div className='flex justify-center mb-4'>
            <div className='animate-spin rounded-full h-16 w-16 border-b-2 border-brand-mint'></div>
          </div>
        </div>

        <h1
          className={`text-3xl font-bold mb-4 ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}
        >
          Submitting Application to Blockchain...
        </h1>

        <p
          className={`text-lg mb-6 ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
          }`}
        >
          Your driver application is being submitted to Base Sepolia for
          verification. This may take a few moments.
        </p>

        <div
          className={`inline-block px-6 py-2 rounded-full text-sm font-medium ${
            theme === 'dark'
              ? 'bg-brand-mint/20 text-brand-mint'
              : 'bg-brand-sage/20 text-brand-sage'
          }`}
        >
          Please wait...
        </div>
      </div>
    </div>
  )

  // Render form content based on current form
  const renderFormContent = () => {
    // Show loading screen during blockchain submission
    if (isSubmitting) {
      return renderSubmissionLoading()
    }

    // If dashboard is shown, show dashboard
    if (showDashboard && isDriverApplicationCompleted) {
      return (
        <DriverDashboard
          onCompleteEmploymentVerification={
            handleNavigateToEmploymentVerification
          }
          userAddress={user?.address}
          blockchainData={blockchainData}
        />
      )
    }

    // If driver application is completed, show application submitted page
    if (
      isDriverApplicationCompleted &&
      !showEmploymentVerification &&
      !showDashboard
    ) {
      return (
        <ApplicationSubmitted
          onNavigateToSafetyForm={handleNavigateToEmploymentVerification}
          onNavigateToDashboard={handleNavigateToDashboard}
          blockchainData={blockchainData}
        />
      )
    }

    // If employment verification is requested, show the form
    if (isDriverApplicationCompleted && showEmploymentVerification) {
      return <EmploymentVerificationForm />
    }

    // Otherwise show the driver application forms
    switch (currentForm) {
      case 1:
        return (
          <PersonalInfoForm1
            onNavigateToForm={handleFormNavigation}
            onDataChange={setForm1Data}
          />
        )
      case 2:
        return (
          <PersonalInfoForm2
            onNavigateToForm={handleFormNavigation}
            onDataChange={setForm2Data}
          />
        )
      case 3:
        return (
          <PersonalInfoForm3
            onComplete={handleDriverApplicationCompleted}
            onDataChange={setForm3Data}
          />
        )
      default:
        return (
          <PersonalInfoForm1
            onNavigateToForm={handleFormNavigation}
            onDataChange={setForm1Data}
          />
        )
    }
  }

  // Render form navigation buttons
  const renderFormNavigation = () => {
    if (currentPage !== 'dotapp') return null

    // Hide navigation when driver application is completed or employment verification is shown
    if (
      isDriverApplicationCompleted ||
      showEmploymentVerification ||
      showDashboard
    )
      return null

    return (
      <div className='flex justify-center mb-8 px-4'>
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
            <div className='text-center'>
              <div className='font-bold text-base'>Form 1</div>
              <div className='text-sm opacity-90'>Personal Info</div>
            </div>
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
            <div className='text-center'>
              <div className='font-bold text-base'>Form 2</div>
              <div className='text-sm opacity-90'>Driving & Records</div>
            </div>
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
            <div className='text-center'>
              <div className='font-bold text-base'>Form 3</div>
              <div className='text-sm opacity-90'>Employment & Signature</div>
            </div>
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
            <ResumeUploadWithVerification user={user} />
            {user && <WalletTransactions />}
          </div>
        )}

        {currentPage === 'dotapp' && (
          <>
            {submissionError && (
              <div
                className={`max-w-4xl mx-auto mb-6 px-4 py-3 rounded-lg border ${
                  theme === 'dark'
                    ? 'bg-red-900/20 border-red-500/50 text-red-300'
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}
              >
                {submissionError}
              </div>
            )}
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
