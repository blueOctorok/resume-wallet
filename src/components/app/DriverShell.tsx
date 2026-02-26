'use client'

import { useCallback, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import LoadingScreen from '@/components/LoadingScreen'
import StormChainView from '@/components/StormChainView'
import ResumeTabSelector from '@/components/ResumeTabSelector'
import DotApplicationFlow from './DotApplicationFlow'
import { useTheme } from '@/contexts/ThemeContext'
import {
  useAuthStore,
  useDotApplicationStore,
  useDriverHubStore,
  useUIStore,
  usePreferencesStore,
} from '@/stores'
import type { ResumeUploadEvent } from '@/types/assistant'

// Dynamic imports for code-splitting
const DriverHub = dynamic(
  () => import('@/components/DriverHub').then((mod) => mod.default),
  { ssr: false, loading: () => <LoadingScreen message='Loading Driver Hub...' fullScreen={false} /> }
)

const HomePage = dynamic(
  () => import('@/components/HomePage').then((mod) => mod.default),
  { ssr: false, loading: () => <LoadingScreen message='Loading...' fullScreen={false} /> }
)

const AlchemyAuth = dynamic(
  () => import('@/components/AlchemyAuth').then((mod) => mod.default),
  { ssr: false, loading: () => <LoadingScreen message='Loading authentication...' fullScreen={false} /> }
)

const ResumeBuilder = dynamic(
  () => import('@/components/ResumeBuilder'),
  { ssr: false, loading: () => <LoadingScreen message='Loading resume builder...' fullScreen={false} /> }
)

const ResumeUploadWithVerification = dynamic(
  () => import('@/components/ResumeUploadWithVerification'),
  { ssr: false, loading: () => <LoadingScreen message='Loading resume upload...' fullScreen={false} /> }
)

const JobListings = dynamic(
  () => import('@/components/JobListings').then((mod) => mod.default),
  { ssr: false, loading: () => <LoadingScreen message='Loading job listings...' fullScreen={false} /> }
)

const MyApplications = dynamic(
  () => import('@/components/MyApplications').then((mod) => mod.default),
  { ssr: false, loading: () => <LoadingScreen message='Loading applications...' fullScreen={false} /> }
)

const MvrOrderForm = dynamic(
  () => import('@/components/MvrOrderForm').then((mod) => mod.default),
  { ssr: false, loading: () => <LoadingScreen message='Loading MVR order form...' fullScreen={false} /> }
)

const MvrManagementModal = dynamic(
  () => import('@/components/MvrManagementModal').then((mod) => mod.default),
  { ssr: false }
)

const MvrViewModal = dynamic(
  () => import('@/components/MvrViewModal').then((mod) => mod.default),
  { ssr: false }
)

const WalletTransactions = dynamic(
  () => import('@/components/WalletTransactions').then((mod) => mod.WalletTransactions),
  { ssr: false, loading: () => <LoadingScreen message='Loading transactions...' fullScreen={false} /> }
)

interface DriverShellProps {
  /** Called when AlchemyAuth succeeds (new login) */
  onAuthSuccess: (userData: unknown) => void
  /** Called to report a resume upload event to AvA */
  onResumeUploadEvent: (event: ResumeUploadEvent) => void
  /** Called to set the latest IPFS hash (for AvA prefill) */
  onSetLatestResumeIpfsHash: (hash: string | null) => void
}

/**
 * DriverShell - All driver-role pages and routing in one component.
 *
 * Reads navigation state from UIStore. Updates driver journey state in UIStore
 * so the AvA Journey Guide can track progress.
 *
 * All DOT application logic lives in <DotApplicationFlow />.
 */
export default function DriverShell({
  onAuthSuccess,
  onResumeUploadEvent,
  onSetLatestResumeIpfsHash,
}: DriverShellProps) {
  const { theme } = useTheme()

  const { user, walletAddress, isCheckingSession } = useAuthStore()
  const dotApp = useDotApplicationStore()
  const hubStore = useDriverHubStore()
  const {
    currentPage,
    setCurrentPage,
    resumeTab,
    setResumeTab,
    editingResumeId,
    setEditingResumeId,
    updateJourneyStep,
    resetDriverJourneyState,
    triggerJourneyStep,
  } = useUIStore()
  
  const { hasCompletedJourneyStep, markJourneyStepComplete } = usePreferencesStore()
  // Prevent the auto-resume creation from running more than once per session
  const autoResumeAttemptedRef = useRef(false)

  const {
    isMvrModalOpen,
    isMvrManagementOpen,
    selectedMvrOrderId,
    setIsMvrModalOpen,
    setIsMvrManagementOpen,
    setSelectedMvrOrderId,
  } = hubStore

  // -------------------------------------------------------
  // Journey state updates (for AvA Journey Guide via UIStore)
  // -------------------------------------------------------
  useEffect(() => {
    if (walletAddress) updateJourneyStep('wallet', 'complete')
    else resetDriverJourneyState()
  }, [walletAddress])
  
  // First login journey modal - show welcome message for new drivers
  useEffect(() => {
    if (user && !hasCompletedJourneyStep('driver.firstLogin')) {
      // Small delay to let the UI settle after login
      const timer = setTimeout(() => {
        triggerJourneyStep('driver.firstLogin')
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [user, hasCompletedJourneyStep, triggerJourneyStep])

  useEffect(() => {
    if (hubStore.hasResume) updateJourneyStep('resume', 'complete')
  }, [hubStore.hasResume])

  useEffect(() => {
    if (dotApp.isApplicationCompleted) {
      updateJourneyStep('forms', 'complete')
      updateJourneyStep('submission', 'in_progress')
    } else if (dotApp.form1Data || dotApp.form2Data || dotApp.form3Data) {
      updateJourneyStep('forms', 'in_progress')
    }
  }, [dotApp.isApplicationCompleted, dotApp.form1Data, dotApp.form2Data, dotApp.form3Data])

  // -------------------------------------------------------
  // Auto-resume creation safety net
  //
  // DotApplicationFlow only renders when the user is on the DOT app page,
  // so if the app was completed in a previous session the inline creation
  // never fires. This effect catches that case: whenever hub data finishes
  // loading and we see a completed DOT app with no resume on file, we
  // silently create one.
  // -------------------------------------------------------
  useEffect(() => {
    const autoCreateMissingResume = async () => {
      if (!walletAddress) return
      if (hubStore.isLoading) return // wait for hub data
      if (autoResumeAttemptedRef.current) return // only once per session
      if (hubStore.resumes.length > 0) return // already has at least one resume

      const hasCompletedDotApp = hubStore.dotApplications.some((app) => app.isComplete)
      if (!hasCompletedDotApp) return

      autoResumeAttemptedRef.current = true
      console.log('🔄 [DriverShell] No resume found but DOT app is complete — auto-creating resume')

      try {
        const profileRes = await fetch('/api/driver/profile', {
          headers: { 'x-wallet-address': walletAddress },
        })
        if (!profileRes.ok) throw new Error('Failed to fetch profile')
        const { profile } = await profileRes.json()
        if (!profile) throw new Error('No profile data')

        // Dynamically import the mapper to keep the initial bundle small
        const { profileToResumeBuilder } = await import('@/lib/profile-mapper')
        const resumeData = profileToResumeBuilder(profile)

        const firstName = resumeData.personalInfo?.firstName ?? ''
        const lastName = resumeData.personalInfo?.lastName ?? ''
        const nameTitle = [firstName, lastName].filter(Boolean).join(' ')

        const createRes = await fetch('/api/resumes/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-wallet-address': walletAddress,
          },
          body: JSON.stringify({
            title: nameTitle ? `${nameTitle} - Resume` : 'My Resume',
            structuredData: {
              personalInfo: resumeData.personalInfo,
              cdlInfo: resumeData.cdlInfo,
              employments: resumeData.employments,
              educations: resumeData.educations,
              skills: resumeData.skills,
              references: resumeData.references,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              autoGenerated: true,
              source: 'dot_application',
            },
            resumeType: 'built',
          }),
        })

        if (!createRes.ok) {
          const err = await createRes.json().catch(() => ({}))
          throw new Error(err.error || 'Failed to create resume')
        }

        const { resume } = await createRes.json()
        console.log('✅ [DriverShell] Auto-resume created successfully')

        if (resume) hubStore.addResume(resume)
        hubStore.setHasResume(true)
      } catch (err) {
        console.error('❌ [DriverShell] Auto-resume creation failed:', err)
        // Non-blocking — driver can still create a resume manually
      }
    }

    autoCreateMissingResume()
  }, [walletAddress, hubStore.isLoading, hubStore.resumes.length, hubStore.dotApplications])

  // -------------------------------------------------------
  // Handlers
  // -------------------------------------------------------
  const resetApplicationProgress = useCallback(() => {
    dotApp.resetApplication()
    // Clear Zustand-persisted DOT state from localStorage
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('dot-application')
    }
  }, [dotApp])

  const handleDeleteInProgressDotApp = useCallback(async () => {
    if (!walletAddress) return
    const res = await fetch('/api/driver/profile/clear-dot-progress', {
      method: 'POST',
      headers: { 'x-wallet-address': walletAddress },
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || 'Failed to clear in-progress application')
    }
    resetApplicationProgress()
  }, [walletAddress, resetApplicationProgress])

  const handleNavigateToHub = useCallback(() => setCurrentPage(null), [setCurrentPage])

  // -------------------------------------------------------
  // Render: DOT app page (delegates to DotApplicationFlow)
  // -------------------------------------------------------
  if (currentPage === 'dotapp') {
    return (
      <DotApplicationFlow
        walletAddress={walletAddress ?? ''}
        userAddress={user?.address}
        onBack={handleNavigateToHub}
      />
    )
  }

  // -------------------------------------------------------
  // Render: Resume page
  // -------------------------------------------------------
  if (currentPage === 'resume') {
    return (
      <div className='max-w-4xl mx-auto space-y-6'>
        {user ? (
          // Drivers: Resume Builder only (upload is via hub modal)
          <>
            <ResumeBuilder
              user={user}
              existingResumeId={editingResumeId}
              onBack={() => {
                setCurrentPage(null)
                setEditingResumeId(undefined)
              }}
              onSave={(resumeId) => {
                console.log('Resume saved:', resumeId)
                hubStore.setHasResume(true)
                setEditingResumeId(undefined)
                // Trigger journey modal for resume completion
                triggerJourneyStep('driver.resumeBuilt')
              }}
            />
            <WalletTransactions />
          </>
        ) : (
          // Non-driver (no role yet): show upload + create tabs
          <>
            <ResumeTabSelector activeTab={resumeTab} onTabChange={setResumeTab} theme={theme} />
            {resumeTab === 'upload' && (
              <ResumeUploadWithVerification
                user={user}
                onBack={() => setCurrentPage(null)}
                onUploadComplete={(payload) => {
                  hubStore.setHasResume(true)
                  if (payload?.finalResult?.ipfsHash) {
                    onSetLatestResumeIpfsHash(payload.finalResult.ipfsHash)
                    onResumeUploadEvent({
                      type: 'analysis_ready',
                      step: 'upload',
                      data: { ipfsHash: payload.finalResult.ipfsHash },
                    })
                  }
                }}
              />
            )}
            {resumeTab === 'create' && (
              <ResumeBuilder
                user={user}
                existingResumeId={editingResumeId}
                onBack={() => {
                  setCurrentPage(null)
                  setEditingResumeId(undefined)
                }}
                onSave={(resumeId) => {
                  console.log('Resume saved:', resumeId)
                  hubStore.setHasResume(true)
                  setEditingResumeId(undefined)
                  triggerJourneyStep('driver.resumeBuilt')
                }}
              />
            )}
            {user && <WalletTransactions />}
          </>
        )}
      </div>
    )
  }

  if (currentPage === 'jobs') {
    return (
      <div className='max-w-7xl mx-auto relative z-0'>
        <JobListings onBack={handleNavigateToHub} userAddress={user?.address || null} />
      </div>
    )
  }

  if (currentPage === 'applications') {
    return (
      <div className='max-w-7xl mx-auto relative z-0'>
        <MyApplications onBack={handleNavigateToHub} userAddress={user?.address || null} />
      </div>
    )
  }

  if (currentPage === 'mvr') {
    return (
      <div className='max-w-2xl mx-auto'>
        <MvrOrderForm userAddress={user?.address || ''} onBack={handleNavigateToHub} />
      </div>
    )
  }

  if (currentPage === 'stormchain') {
    return <StormChainView onBack={handleNavigateToHub} />
  }

  if (currentPage === 'signin' && !user) {
    return (
      <div className='max-w-md mx-auto overflow-hidden'>
        {isCheckingSession ? (
          <div className='relative backdrop-blur-xl rounded-3xl shadow-2xl border p-8 bg-gray-800/50 border-indigo-500/30'>
            <div className='relative text-center'>
              <div
                className={`animate-spin rounded-full h-10 w-10 border-b-2 mx-auto mb-4 ${
                  theme === 'light' ? 'border-indigo-600' : 'border-indigo-400'
                }`}
              />
              <p className={theme === 'light' ? 'text-gray-600' : 'text-gray-300'}>
                Checking for existing session...
              </p>
            </div>
          </div>
        ) : (
          <AlchemyAuth
            onAuthSuccess={onAuthSuccess}
            onLogoutSuccess={() => useAuthStore.getState().setUser(null)}
          />
        )}
      </div>
    )
  }

  // -------------------------------------------------------
  // Default: Driver Hub (logged in driver) or Landing Page
  // -------------------------------------------------------
  if (!currentPage) {
    if (user) {
      return (
        <>
          <DriverHub
            userAddress={user.address}
            onNavigate={(page) => {
              if (
                page === 'resume' || page === 'dotapp' || page === 'jobs' ||
                page === 'applications' || page === 'mvr' || page === 'stormchain'
              ) {
                setCurrentPage(page)
              }
            }}
            onStartDotApp={() => {
              resetApplicationProgress()
              setCurrentPage('dotapp')
            }}
            onViewMvr={(orderId) => {
              setSelectedMvrOrderId(orderId)
              setIsMvrModalOpen(true)
            }}
            onDeleteInProgressDotApp={handleDeleteInProgressDotApp}
            onEditResume={(resumeId) => {
              setEditingResumeId(resumeId)
              setResumeTab('create')
              setCurrentPage('resume')
            }}
            onStartEmploymentVerification={() => {
              dotApp.completeApplication()
              useUIStore.getState().setShowEmploymentVerification(true)
              setCurrentPage('dotapp')
            }}
          />

          {/* Driver-specific modals */}
          <MvrManagementModal
            isOpen={isMvrManagementOpen}
            onClose={() => setIsMvrManagementOpen(false)}
            walletAddress={user.address}
            onOrderNew={() => setCurrentPage('mvr')}
            onCompleteOrder={(paymentTxHash) => {
              if (typeof window !== 'undefined') {
                localStorage.setItem('pendingMvrPayment', paymentTxHash)
              }
              setCurrentPage('mvr')
            }}
            onViewMvr={(orderId) => {
              setSelectedMvrOrderId(orderId)
              setIsMvrModalOpen(true)
            }}
          />
          <MvrViewModal
            isOpen={isMvrModalOpen}
            onClose={() => {
              setIsMvrModalOpen(false)
              setSelectedMvrOrderId(null)
            }}
            walletAddress={user.address}
          />
        </>
      )
    }

    return (
      <HomePage
        isAuthenticated={false}
        onGetStarted={() => setCurrentPage('signin')}
      />
    )
  }

  return null
}
