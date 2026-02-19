'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { ArrowLeft } from 'lucide-react'
import Navigation from '@/components/Navigation'
import AnimatedBackground from '@/components/AnimatedBackground'
import StormBackground from '@/components/StormBackground'
import UserStatusModal from '@/components/UserStatusModal'
import WalletCard from '@/components/WalletCard'
import TLoadingModal from '@/components/TLoadingModal'
import LoadingScreen from '@/components/LoadingScreen'
import ResumeTabSelector from '@/components/ResumeTabSelector'
import StormChainView from '@/components/StormChainView'
import { useTheme } from '@/contexts/ThemeContext'
import {
  useSendUserOperation,
  useSmartAccountClient,
  useUser,
  useAccount,
  useSignerStatus,
} from '@account-kit/react'
import { AssistantBridgeProvider } from '@/contexts/AssistantBridgeContext'
import type {
  AssistantHelpPayload,
  AssistantHelpRequest,
  DriverJourneyState,
  JourneyStatus,
  PrimerPrompt,
  ResumeUploadEvent,
} from '@/types/assistant'
import {
  profileToDotApplication,
  dotApplicationToProfile,
} from '@/lib/profile-mapper'
import type { UnifiedDriverProfile } from '@/types/driver-profile'
import SyncIndicator, { useSyncIndicator } from '@/components/SyncIndicator'
import { useAvaAssistant } from '@/hooks/useAvaAssistant'

// Dynamic imports to avoid SSR issues with Alchemy hooks
const ResumeUploadWithVerification = dynamic(
  () => import('@/components/ResumeUploadWithVerification'),
  {
    ssr: false,
    loading: () => (
      <LoadingScreen message='Loading resume upload...' fullScreen={false} />
    ),
  }
)

const ResumeBuilder = dynamic(() => import('@/components/ResumeBuilder'), {
  ssr: false,
  loading: () => (
    <LoadingScreen message='Loading resume builder...' fullScreen={false} />
  ),
})

const AlchemyAuth = dynamic(
  () => import('@/components/AlchemyAuth').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <LoadingScreen message='Loading authentication...' fullScreen={false} />
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
      <LoadingScreen message='Loading DOT application...' fullScreen={false} />
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
      <LoadingScreen message='Loading DOT application...' fullScreen={false} />
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
      <LoadingScreen message='Loading DOT application...' fullScreen={false} />
    ),
  }
)

const JobListings = dynamic(
  () => import('@/components/JobListings').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <LoadingScreen message='Loading job listings...' fullScreen={false} />
    ),
  }
)

const MyApplications = dynamic(
  () => import('@/components/MyApplications').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <LoadingScreen message='Loading applications...' fullScreen={false} />
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
      <LoadingScreen message='Loading application...' fullScreen={false} />
    ),
  }
)

// DriverHub replaces the old DriverDashboard - always accessible, shows all driver data
const DriverHub = dynamic(
  () => import('@/components/DriverHub').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <LoadingScreen message='Loading Driver Hub...' fullScreen={false} />
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
      <LoadingScreen
        message='Loading verification form...'
        fullScreen={false}
      />
    ),
  }
)

const ResumeUploadWithPrefill = dynamic(
  () => import('@/components/ResumeUploadWithPrefill'),
  {
    ssr: false,
    loading: () => (
      <LoadingScreen message='Loading resume upload...' fullScreen={false} />
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
      <LoadingScreen message='Loading transactions...' fullScreen={false} />
    ),
  }
)

const TAssistant = dynamic(
  () => import('@/components/TAssistant').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <LoadingScreen message='Loading AvA Assistant...' fullScreen={false} />
    ),
  }
)

const WalletInfo = dynamic(
  () => import('@/components/WalletInfo').then((mod) => mod.default),
  {
    ssr: false,
  }
)

const HomePage = dynamic(
  () => import('@/components/HomePage').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => <LoadingScreen message='Loading...' fullScreen={false} />,
  }
)

// DriverHomePage removed - replaced by DriverHub as the default landing for drivers

// EmployerHub replaces EmployerDashboard - full employer functionality
const EmployerHub = dynamic(
  () => import('@/components/EmployerHub').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <LoadingScreen message='Loading Employer Hub...' fullScreen={false} />
    ),
  }
)

// DeveloperHub - dashboard for software engineers
const DeveloperHub = dynamic(
  () => import('@/components/DeveloperHub').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <LoadingScreen message='Loading Developer Hub...' fullScreen={false} />
    ),
  }
)

// Developer Portfolio page
const PortfolioPage = dynamic(
  () =>
    import('@/components/developer/PortfolioPage').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <LoadingScreen message='Loading Portfolio...' fullScreen={false} />
    ),
  }
)

const ApplicantsPage = dynamic(
  () =>
    import('@/components/employer/ApplicantsPage').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <LoadingScreen message='Loading applicants...' fullScreen={false} />
    ),
  }
)

const FindDriversPage = dynamic(
  () =>
    import('@/components/employer/FindDriversPage').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <LoadingScreen message='Loading driver search...' fullScreen={false} />
    ),
  }
)

const TalentSearchPage = dynamic(
  () =>
    import('@/components/employer/TalentSearchPage').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <LoadingScreen message='Loading talent search...' fullScreen={false} />
    ),
  }
)

const RoleSelectionModal = dynamic(
  () => import('@/components/RoleSelectionModal').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => <LoadingScreen message='Loading...' fullScreen={false} />,
  }
)

const MvrOrderForm = dynamic(
  () => import('@/components/MvrOrderForm').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <LoadingScreen message='Loading MVR order form...' fullScreen={false} />
    ),
  }
)

const MvrStatusIndicator = dynamic(
  () => import('@/components/MvrStatusIndicator').then((mod) => mod.default),
  {
    ssr: false,
  }
)

const MvrViewModal = dynamic(
  () => import('@/components/MvrViewModal').then((mod) => mod.default),
  {
    ssr: false,
  }
)

const MvrManagementModal = dynamic(
  () => import('@/components/MvrManagementModal').then((mod) => mod.default),
  {
    ssr: false,
  }
)

const ProfileConflictModal = dynamic(
  () => import('@/components/ProfileConflictModal').then((mod) => mod.default),
  {
    ssr: false,
  }
)

const createInitialJourneyState = (): DriverJourneyState => {
  const timestamp = new Date().toISOString()
  return {
    wallet: { status: 'pending', updatedAt: timestamp },
    resume: { status: 'pending', updatedAt: timestamp },
    forms: { status: 'pending', updatedAt: timestamp },
    submission: { status: 'pending', updatedAt: timestamp },
    currentFormStep: null,
    lastCompletedForm: null,
  }
}

type JourneyStageKey = 'wallet' | 'resume' | 'forms' | 'submission'

// Inner component that uses Alchemy hooks (must be inside provider)
const HomeContent = () => {
  // Alchemy Account Kit hooks for sending transactions
  const { client } = useSmartAccountClient({ type: 'LightAccount' })
  const { sendUserOperationAsync, isSendingUserOperation } =
    useSendUserOperation({ client })

  // Alchemy authentication hooks to check for existing session
  const { isConnected, isInitializing } = useSignerStatus()
  const alchemyUser = useUser()
  const account = useAccount({ type: 'LightAccount' })

  const [user, setUser] = useState<any>(null)
  const [isCheckingSession, setIsCheckingSession] = useState(true) // Track if we're still checking for a session
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isMvrModalOpen, setIsMvrModalOpen] = useState(false)
  const [isMvrManagementOpen, setIsMvrManagementOpen] = useState(false)
  const [selectedMvrOrderId, setSelectedMvrOrderId] = useState<string | null>(
    null
  )
  const [currentPage, setCurrentPage] = useState<
    | 'signin'
    | 'resume'
    | 'dotapp'
    | 'jobs'
    | 'applications'
    | 'mvr'
    | 'hub'
    | null
  >(null)
  const [resumeTab, setResumeTab] = useState<'upload' | 'create'>('upload')
  const [editingResumeId, setEditingResumeId] = useState<string | undefined>(
    undefined
  )

  // Role-based access control
  const [userRole, setUserRole] = useState<
    'driver' | 'developer' | 'employer' | null
  >(null)
  const [isRoleLoading, setIsRoleLoading] = useState(true)
  const [showRoleSelection, setShowRoleSelection] = useState(false)
  const [isSettingRole, setIsSettingRole] = useState(false)
  const [companyName, setCompanyName] = useState<string | null>(null)
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
  const [formResetKey, setFormResetKey] = useState(0)

  // Sync indicator for save feedback
  const { startSync, syncSuccess, syncError, indicatorProps } =
    useSyncIndicator()

  // Track unsaved changes (dirty state)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const lastSavedDataRef = useRef<{ form1: any; form2: any; form3: any }>({
    form1: null,
    form2: null,
    form3: null,
  })

  // Track if data was loaded from unified profile
  const [profileDataLoaded, setProfileDataLoaded] = useState(false)
  const [profileSource, setProfileSource] = useState<string | null>(null)
  const [showProfileConflictModal, setShowProfileConflictModal] =
    useState(false)
  const [profileConflict, setProfileConflict] = useState<{
    conflicts: string[]
    existing: {
      name: string
      cdlNumber?: string
      email?: string
      lastUpdatedFrom?: string
    }
    incoming: {
      name: string
      cdlNumber?: string
      email?: string
      source?: string
    }
    profileData: any
  } | null>(null)
  const profileLoadAttemptedRef = useRef(false)
  const [profileLoadTrigger, setProfileLoadTrigger] = useState(0) // Increment to force profile reload
  const forceProfileLoadRef = useRef(false) // When true, load from profile even if forms have data

  // Track if user has used AI prefill
  const [hasPrefilled, setHasPrefilled] = useState(false)
  const [showPrefillUpload, setShowPrefillUpload] = useState(false) // Start with forms, prefill is in Form 1
  const [journeyState, setJourneyState] = useState<DriverJourneyState>(() =>
    createInitialJourneyState()
  )

  // AvA Assistant state (extracted to custom hook)
  const {
    isAvaCollapsed,
    setIsAvaCollapsed,
    toggleAvaCollapse,
    avaHasUnread,
    setAvaHasUnread,
    avaIsWorking,
    avaWorkingMessage,
    setAvaWorking,
    helpRequest,
    handleHelpRequest,
    clearHelpRequest,
    primerSeen,
    primerRequest,
    setPrimerSeen,
    triggerPrimer,
    handlePrimerAction,
    isPrimerTriggered,
    resetAvaState,
  } = useAvaAssistant({ userAddress: user?.address })

  const [hasResume, setHasResume] = useState(false)
  const [latestResumeIpfsHash, setLatestResumeIpfsHash] = useState<
    string | null
  >(null)
  const [resumeUploadEvent, setResumeUploadEvent] =
    useState<ResumeUploadEvent | null>(null)
  const resetInProgressRef = useRef(false)
  const analysisTriggeredRef = useRef<string | null>(null) // Track which IPFS hash we've already triggered analysis for
  const analysisPendingRef = useRef(false) // Prevent simultaneous analysis triggers

  const updateJourneyStep = useCallback(
    (step: JourneyStageKey, status: JourneyStatus) => {
      setJourneyState((prev) => {
        if (prev[step].status === status) {
          return prev
        }
        const timestamp = new Date().toISOString()
        return {
          ...prev,
          [step]: { status, updatedAt: timestamp },
        }
      })
    },
    []
  )

  const handleResumeUploadEvent = useCallback((event: ResumeUploadEvent) => {
    setResumeUploadEvent(event)

    // Store IPFS hash from analysis_ready event for later prefill use
    if (event.type === 'analysis_ready' && event.data?.ipfsHash) {
      setLatestResumeIpfsHash(event.data.ipfsHash)
      console.log(
        '💾 [PREFILL] Stored IPFS hash from analysis event:',
        event.data.ipfsHash
      )
    }

    // Clear the event after a short delay to allow re-triggering of different events
    setTimeout(() => {
      setResumeUploadEvent(null)
    }, 100)
  }, [])

  const handleRoleSelection = useCallback(
    async (role: 'driver' | 'developer' | 'employer', companyName?: string, dotNumber?: string) => {
      if (!user?.address) {
        console.error('No user address available')
        return
      }

      setIsSettingRole(true)
      try {
        const response = await fetch('/api/user/set-role', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            role,
            walletAddress: user.address,
            // Pass company info for employers (prevents orphan "My Company" records)
            ...(role === 'employer' && companyName && { companyName, dotNumber }),
          }),
        })

        if (response.ok) {
          const data = await response.json()
          console.log('[ROLE SELECTION] Role saved successfully:', data)

          // Update state immediately
          setUserRole(role)
          setShowRoleSelection(false)

          // Verify the role was actually saved by refetching
          // This ensures persistence and prevents the modal from showing again
          const verifyResponse = await fetch('/api/user/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress: user.address }),
          })

          if (verifyResponse.ok) {
            const verifyData = await verifyResponse.json()
            if (verifyData.success && verifyData.profile?.role === role) {
              console.log(
                '[ROLE SELECTION] Role verified in database:',
                verifyData.profile.role
              )
            } else {
              console.warn(
                '[ROLE SELECTION] Role verification failed - role may not have persisted'
              )
            }
          }

          // Both drivers and employers start at home page
          // Drivers see DriverHub, employers see EmployerHub
          setCurrentPage(null)
        } else {
          const errorData = await response.json().catch(() => ({}))
          console.error(
            'Failed to set user role:',
            response.statusText,
            errorData
          )
          alert(
            `Failed to set role: ${errorData.error || response.statusText}. Please try again.`
          )
          // Keep modal open so user can retry
          setIsSettingRole(false)
        }
      } catch (error) {
        console.error('Error setting user role:', error)
        alert('An error occurred. Please try again.')
      } finally {
        setIsSettingRole(false)
      }
    },
    [user]
  )


  const resetApplicationProgress = useCallback(() => {
    console.log(
      '🔄 [RESET] ==================== START RESET ===================='
    )
    console.log('🔄 [RESET] User address:', user?.address)
    console.log('🔄 [RESET] Current form1Data:', form1Data)
    console.log('🔄 [RESET] Current form2Data:', form2Data)
    console.log('🔄 [RESET] Current form3Data:', form3Data)

    // Set flag to prevent localStorage from reloading stale data
    resetInProgressRef.current = true
    console.log('🔄 [RESET] Set resetInProgressRef to true')

    // Clear state first
    console.log('🔄 [RESET] Setting form data to null...')
    setForm1Data(null)
    setForm2Data(null)
    setForm3Data(null)
    console.log('🔄 [RESET] Form data set to null')
    setHasPrefilled(false)
    setShowPrefillUpload(false) // Go straight to forms, prefill is in Form 1
    setCurrentForm(1)
    setIsDriverApplicationCompleted(false)
    setShowEmploymentVerification(false)
    setShowDashboard(false)
    setSubmissionError(null)
    setHasResume(false)
    setLatestResumeIpfsHash(null) // Clear stored IPFS hash
    resetAvaState() // Clear AvA assistant state
    analysisTriggeredRef.current = null // Reset analysis trigger
    analysisPendingRef.current = false // Reset pending flag

    // Clear localStorage
    if (typeof window !== 'undefined' && user?.address) {
      console.log('🔄 [RESET] Clearing localStorage for:', user.address)
      const beforeForms = window.localStorage.getItem(`forms-${user.address}`)
      const beforeJourney = window.localStorage.getItem(
        `journey-${user.address}`
      )
      console.log(
        '🔄 [RESET] Before clear - forms:',
        beforeForms?.substring(0, 100)
      )
      console.log(
        '🔄 [RESET] Before clear - journey:',
        beforeJourney?.substring(0, 100)
      )

      // Clear all localStorage items for this user
      window.localStorage.removeItem(`forms-${user.address}`)
      window.localStorage.removeItem(`journey-${user.address}`)
      window.localStorage.removeItem(`journey-primer-${user.address}`)

      const afterForms = window.localStorage.getItem(`forms-${user.address}`)
      const afterJourney = window.localStorage.getItem(
        `journey-${user.address}`
      )
      console.log('✅ [RESET] After clear - forms:', afterForms)
      console.log('✅ [RESET] After clear - journey:', afterJourney)
      console.log('✅ [RESET] Cleared localStorage for user:', user.address)
    }

    console.log('🔄 [RESET] Resetting journey state...')
    setJourneyState(createInitialJourneyState())
    updateJourneyStep('wallet', 'complete')

    // Force form components to remount with fresh state
    const oldKey = formResetKey
    setFormResetKey((key) => key + 1)
    console.log(
      '🔄 [RESET] Incremented formResetKey from',
      oldKey,
      'to',
      oldKey + 1
    )

    // Clear the reset flag after a brief delay to allow state updates to complete
    setTimeout(() => {
      resetInProgressRef.current = false
      console.log(
        '✅ [RESET] ==================== END RESET ===================='
      )
      console.log('✅ [RESET] Reset flag cleared')
      console.log('✅ [RESET] form1Data should now be:', form1Data)
      console.log('✅ [RESET] form2Data should now be:', form2Data)
      console.log('✅ [RESET] form3Data should now be:', form3Data)
    }, 100)
  }, [
    updateJourneyStep,
    user?.address,
    formResetKey,
    form1Data,
    form2Data,
    form3Data,
  ])

  const handleDeleteInProgressDotApp = useCallback(async () => {
    if (!user?.address) return
    const res = await fetch('/api/driver/profile/clear-dot-progress', {
      method: 'POST',
      headers: { 'x-wallet-address': user.address },
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || 'Failed to clear in-progress application')
    }
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(`forms-${user.address}`)
      window.localStorage.removeItem(`journey-${user.address}`)
      window.localStorage.removeItem(`journey-primer-${user.address}`)
    }
    resetApplicationProgress()
  }, [user?.address, resetApplicationProgress])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!user?.address) {
      setJourneyState(createInitialJourneyState())
      resetAvaState() // Clear AvA assistant state
      setHasResume(false)
      return
    }

    try {
      const storedJourney = window.localStorage.getItem(
        `journey-${user.address}`
      )
      if (storedJourney) {
        const parsed = JSON.parse(storedJourney) as DriverJourneyState
        setJourneyState({
          ...createInitialJourneyState(),
          ...parsed,
        })
        if (typeof parsed.currentFormStep === 'number') {
          setCurrentForm(parsed.currentFormStep || 1)
        }
        if (parsed.resume?.status === 'complete') {
          setHasResume(true)
        }
      } else {
        setJourneyState(createInitialJourneyState())
      }

      // Don't load from localStorage if a reset is in progress
      if (resetInProgressRef.current) {
        console.log('⏸️ [RESET] Skipping localStorage load - reset in progress')
        return
      }

      const storedForms = window.localStorage.getItem(`forms-${user.address}`)
      if (storedForms) {
        const parsedForms = JSON.parse(storedForms) as {
          form1Data?: unknown
          form2Data?: unknown
          form3Data?: unknown
          currentForm?: number
          isDriverApplicationCompleted?: boolean
          hasPrefilled?: boolean
          showPrefillUpload?: boolean
        }
        if (parsedForms.form1Data) setForm1Data(parsedForms.form1Data)
        if (parsedForms.form2Data) setForm2Data(parsedForms.form2Data)
        if (parsedForms.form3Data) setForm3Data(parsedForms.form3Data)
        if (typeof parsedForms.currentForm === 'number') {
          setCurrentForm(parsedForms.currentForm || 1)
        }
        if (typeof parsedForms.isDriverApplicationCompleted === 'boolean') {
          setIsDriverApplicationCompleted(
            parsedForms.isDriverApplicationCompleted
          )
        }
        if (typeof parsedForms.hasPrefilled === 'boolean') {
          setHasPrefilled(parsedForms.hasPrefilled)
        }
        if (typeof parsedForms.showPrefillUpload === 'boolean') {
          setShowPrefillUpload(parsedForms.showPrefillUpload)
        } else if (
          parsedForms.form1Data ||
          parsedForms.form2Data ||
          parsedForms.form3Data
        ) {
          setShowPrefillUpload(false)
        }
      } else {
        // No localStorage data - try loading from database
        console.log('📦 [LOAD] No localStorage data, checking database...')
        // Wrap async code in IIFE since useEffect callback can't be async
        ;(async () => {
          try {
            const { getDriverApplicationClient } = await import(
              '@/lib/supabase-client-db'
            )
            const dbApp = await getDriverApplicationClient(user.address)

            if (dbApp && !dbApp.is_complete && dbApp.application_data) {
              console.log(
                '✅ [LOAD] Found in-progress application in database, loading...'
              )
              const appData = dbApp.application_data as {
                form1?: unknown
                form2?: unknown
                form3?: unknown
              }

              if (appData.form1) setForm1Data(appData.form1)
              if (appData.form2) setForm2Data(appData.form2)
              if (appData.form3) setForm3Data(appData.form3)
              if (dbApp.current_step) {
                setCurrentForm(dbApp.current_step)
              }
              setShowPrefillUpload(false)

              // Also save to localStorage for faster future loads
              try {
                window.localStorage.setItem(
                  `forms-${user.address}`,
                  JSON.stringify({
                    form1Data: appData.form1,
                    form2Data: appData.form2,
                    form3Data: appData.form3,
                    currentForm: dbApp.current_step,
                  })
                )
                console.log('✅ [LOAD] Synced database data to localStorage')
              } catch (lsError) {
                console.warn(
                  '⚠️ [LOAD] Failed to sync to localStorage:',
                  lsError
                )
              }
            } else {
              console.log('📭 [LOAD] No in-progress application in database')
            }
          } catch (dbError) {
            console.warn('⚠️ [LOAD] Failed to load from database:', dbError)
            // Continue - user can start fresh
          }
        })()
      }

      const storedPrimer = window.localStorage.getItem(
        `journey-primer-${user.address}`
      )
      setPrimerSeen(storedPrimer === 'seen') // Also sets primerTriggered internally
    } catch (error) {
      console.error('⚠️ Failed to restore journey state from storage', error)
    }
  }, [user?.address])

  useEffect(() => {
    if (typeof window === 'undefined' || !user?.address) return
    try {
      window.localStorage.setItem(
        `journey-${user.address}`,
        JSON.stringify(journeyState)
      )
    } catch (error) {
      console.warn('⚠️ Failed to persist journey state', error)
    }
  }, [journeyState, user?.address])

  // Persist form data to localStorage
  useEffect(() => {
    if (typeof window === 'undefined' || !user?.address) return

    // Don't save during reset
    if (resetInProgressRef.current) {
      // Skipping save during reset
      return
    }

    // Only save if at least one form has data
    if (!form1Data && !form2Data && !form3Data) {
      // No form data to save
      return
    }

    try {
      const formsToSave = {
        form1Data,
        form2Data,
        form3Data,
      }
      window.localStorage.setItem(
        `forms-${user.address}`,
        JSON.stringify(formsToSave)
      )
      // Saved to localStorage silently
    } catch (error) {
      console.warn('⚠️ Failed to persist form data', error)
    }
  }, [form1Data, form2Data, form3Data, user?.address])

  // Load from unified profile if no meaningful localStorage form data exists
  // This enables DOT form prefill from Resume Builder data. Only for drivers or when on DOT app.
  useEffect(() => {
    const loadFromProfile = async () => {
      // Only attempt once per session (set early to prevent race conditions)
      if (profileLoadAttemptedRef.current) {
        console.log('📋 [DOT APP] Profile load already attempted, skipping')
        return
      }
      if (!user?.address) return
      // Don't run driver/DOT profile prefill for developers (or before role is known)
      if (userRole !== 'driver' && currentPage !== 'dotapp') return

      // Mark as attempted EARLY to prevent race conditions from concurrent effect runs
      profileLoadAttemptedRef.current = true

      // Wait a tick to let localStorage load complete first
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Check if forms have MEANINGFUL data (not just empty objects)
      // Skip this check if forceProfileLoadRef is true (navigating from Resume Builder)
      if (!forceProfileLoadRef.current) {
        const hasMeaningfulForm1 =
          form1Data &&
          (form1Data.firstName ||
            form1Data.lastName ||
            form1Data.cdlNumber ||
            (form1Data.currentLicenses?.length > 0 &&
              form1Data.currentLicenses[0]?.licenseNumber))
        const hasMeaningfulForm3 =
          form3Data &&
          form3Data.employers?.length > 0 &&
          form3Data.employers[0]?.name

        if (hasMeaningfulForm1 || hasMeaningfulForm3) {
          console.log(
            '📋 [DOT APP] Forms already have meaningful data, skipping profile load'
          )
          return
        }
      } else {
        console.log(
          '🔄 [DOT APP] Force load enabled - will check profile regardless of form data'
        )
      }

      // Don't load during reset - reset the attempted flag so we can retry
      if (resetInProgressRef.current) {
        console.log(
          '🔄 [DOT APP] Reset in progress, skipping profile load (will retry)'
        )
        profileLoadAttemptedRef.current = false // Allow retry after reset completes
        return
      }

      // Reset force flag after use (only after we've passed the reset check)
      forceProfileLoadRef.current = false

      try {
        console.log('📦 [DOT APP] Checking unified profile for prefill data...')
        const response = await fetch('/api/driver/profile', {
          headers: {
            'x-wallet-address': user.address,
          },
        })

        if (!response.ok) return

        const { profile } = await response.json()

        if (!profile) {
          console.log('📭 [DOT APP] No profile found')
          return
        }

        // Check if profile has meaningful data
        const hasProfileData =
          profile.firstName ||
          profile.lastName ||
          profile.cdlNumber ||
          profile.employmentHistory?.length > 0

        if (!hasProfileData) {
          console.log('📭 [DOT APP] Profile exists but has no data')
          return
        }

        // IMPORTANT: Only prefill from profile if data came from a RESUME, not a deleted DOT app
        // If the profile was only updated from a DOT app (which might now be deleted),
        // we should NOT prefill - the user wants to start fresh
        const profileSource = profile.lastUpdatedFrom || 'unknown'
        const isFromResume =
          profileSource === 'resume_builder' ||
          profileSource === 'uploaded_resume' ||
          profileSource === 'resume'

        if (!isFromResume) {
          console.log(
            '📭 [DOT APP] Profile data is from DOT app, not resume - starting fresh'
          )
          console.log('   Source was:', profileSource)
          return
        }

        console.log(
          '✅ [DOT APP] Profile found with RESUME data, prefilling forms...'
        )
        console.log('   Source:', profileSource)
        console.log('   Profile data:', {
          firstName: profile.firstName,
          lastName: profile.lastName,
          email: profile.email,
          cdlNumber: profile.cdlNumber,
          employmentCount: profile.employmentHistory?.length || 0,
        })

        // Convert profile to DOT application format
        const dotData = profileToDotApplication(profile as UnifiedDriverProfile)
        console.log('   Converted DOT data:', {
          hasPersonalInfo: !!dotData.personalInfo,
          hasCdlInfo: !!dotData.cdlInfo,
          employmentHistoryLength: dotData.employmentHistory?.length || 0,
        })

        // Set form data - only set forms that have data
        if (dotData.personalInfo || dotData.cdlInfo) {
          // Form 1: Personal info, residency, license
          setForm1Data({
            firstName: dotData.personalInfo?.firstName || '',
            middleName: dotData.personalInfo?.middleName || '',
            lastName: dotData.personalInfo?.lastName || '',
            phone: dotData.personalInfo?.phone || '',
            email: dotData.personalInfo?.email || '',
            dateOfBirth: dotData.personalInfo?.dateOfBirth || '',
            currentMailing: {
              street: dotData.personalInfo?.address || '',
              city: dotData.personalInfo?.city || '',
              state: dotData.personalInfo?.state || '',
              zipCode: dotData.personalInfo?.zipCode || '',
              yearsAtAddress: '',
            },
            currentLicenses: dotData.cdlInfo
              ? [
                  {
                    state: dotData.cdlInfo.cdlState || '',
                    licenseNumber: dotData.cdlInfo.cdlNumber || '',
                    typeClass: dotData.cdlInfo.cdlClass || '',
                    endorsements:
                      dotData.cdlInfo.endorsements?.join(', ') || '',
                    expirationDate: dotData.cdlInfo.cdlExpiration || '',
                  },
                ]
              : [],
          })
        }

        if (dotData.employmentHistory && dotData.employmentHistory.length > 0) {
          // Form 3: Employment history - map to employers array format
          setForm3Data((prev: Record<string, unknown>) => ({
            ...prev,
            employers: dotData.employmentHistory.map(
              (emp: Record<string, unknown>) => ({
                name: emp.company || emp.companyName || '',
                phone: emp.supervisorPhone || '',
                email: emp.supervisorEmail || '',
                address: (emp.location as string) || '',
                positionHeld: emp.position || '',
                fromDate: emp.startDate || '',
                toDate: emp.endDate || 'Present',
                reasonForLeaving: emp.reasonForLeaving || '',
                salary: '',
                gapsInEmployment: '',
                subjectToFMCSR: 'no',
                safetySensitiveFunction: 'no',
                isUnemployment: false,
              })
            ),
          }))
        }

        if (
          dotData.drivingRecord &&
          (dotData.drivingRecord.violations?.length > 0 ||
            dotData.drivingRecord.accidents?.length > 0)
        ) {
          // Form 2: Driving record (accidents, violations)
          setForm2Data((prev: Record<string, unknown>) => ({
            ...prev,
            accidents:
              dotData.drivingRecord.accidents?.map(
                (acc: Record<string, unknown>) => ({
                  date: acc.date || '',
                  nature: acc.description || '',
                  fatalities: acc.fatalities || '',
                  injuries: acc.injuries || '',
                  atFault: '',
                })
              ) || [],
            hasNoAccidents: !dotData.drivingRecord.accidents?.length,
            convictions:
              dotData.drivingRecord.violations?.map(
                (viol: Record<string, unknown>) => ({
                  dateConvicted: viol.date || '',
                  violation: viol.violation || '',
                  stateOfViolation: viol.location || '',
                  penalty: viol.fine || '',
                })
              ) || [],
            hasNoConvictions: !dotData.drivingRecord.violations?.length,
          }))
        }

        setProfileDataLoaded(true)
        setProfileSource(profile.lastUpdatedFrom || 'profile')
        setShowPrefillUpload(false) // Hide the upload since we have data

        console.log('✅ [DOT APP] Forms prefilled from unified profile')
      } catch (error) {
        console.error('❌ [DOT APP] Failed to load from profile:', error)
      }
    }

    loadFromProfile()
  }, [user?.address, userRole, currentPage, form1Data, form2Data, form3Data, profileLoadTrigger])

  // Reset profile load attempt when navigating TO DOT app (enables fresh profile check)
  // This handles: User builds resume → saves → navigates to DOT app → should see prefilled data
  // BUT: We should NOT force profile load if localStorage already has form data
  //      (profile data is incomplete - missing SSN, dates, etc.)
  const prevPageRef = useRef<string | null>(null)
  useEffect(() => {
    if (currentPage === 'dotapp' && prevPageRef.current !== 'dotapp') {
      console.log(
        '🔄 [DOT APP] Entering DOT app view, checking for existing data...'
      )

      // Check if localStorage already has form data
      // If so, DON'T force profile load - localStorage has complete data, profile doesn't
      const storedForms = window.localStorage.getItem(`forms-${user?.address}`)
      const hasLocalStorageData =
        storedForms &&
        (() => {
          try {
            const parsed = JSON.parse(storedForms)
            // Check for meaningful form1 data (any field filled)
            return (
              parsed.form1Data &&
              (parsed.form1Data.firstName ||
                parsed.form1Data.lastName ||
                parsed.form1Data.socialSecurity ||
                parsed.form1Data.dateOfApplication ||
                parsed.form1Data.dateOfBirth)
            )
          } catch {
            return false
          }
        })()

      if (hasLocalStorageData) {
        console.log(
          '📋 [DOT APP] localStorage has form data - preserving it (not forcing profile load)'
        )
        // Don't trigger profile load - let localStorage data persist
        prevPageRef.current = currentPage
        return
      }

      // No localStorage data - trigger profile load for prefill from Resume Builder
      const triggerProfileLoad = () => {
        profileLoadAttemptedRef.current = false
        forceProfileLoadRef.current = true // Force load even if forms have data
        setProfileLoadTrigger((prev) => prev + 1) // Trigger the profile load effect
        console.log(
          '🔄 [DOT APP] No localStorage data - FORCING profile check for prefill'
        )
      }

      if (resetInProgressRef.current) {
        // Wait for reset to complete (reset clears after 100ms)
        console.log(
          '🔄 [DOT APP] Reset in progress, waiting before profile load...'
        )
        setTimeout(() => {
          triggerProfileLoad()
        }, 150) // Wait slightly longer than the reset timeout (100ms)
      } else {
        triggerProfileLoad()
      }
    }
    prevPageRef.current = currentPage
  }, [currentPage, user?.address])

  useEffect(() => {
    if (journeyState.resume.status === 'complete' && !hasResume) {
      setHasResume(true)
    }
  }, [journeyState.resume.status, hasResume])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = (event: Event) => {
      if (!user?.address) return
      const detail = (event as CustomEvent).detail as {
        walletAddress?: string
      }
      if (
        detail?.walletAddress &&
        detail.walletAddress.toLowerCase() === user.address.toLowerCase()
      ) {
        resetApplicationProgress()
      }
    }
    window.addEventListener('wallet-data-reset', handler)
    // Listening for reset events
    return () => {
      window.removeEventListener('wallet-data-reset', handler)
    }
  }, [user?.address, resetApplicationProgress])

  useEffect(() => {
    if (user?.address) {
      updateJourneyStep('wallet', 'complete')
    }
  }, [user?.address, updateJourneyStep])

  // Track dirty state - detect when form data changes from last saved version
  useEffect(() => {
    // Only track dirty state when on DOT app page
    if (currentPage !== 'dotapp') return

    // Skip during reset
    if (resetInProgressRef.current) return

    // Check if any form data exists and differs from last saved
    const hasData = form1Data || form2Data || form3Data
    if (!hasData) {
      setHasUnsavedChanges(false)
      return
    }

    // Simple comparison - if we have data and it's different from what was last saved, it's dirty
    const isDifferent =
      JSON.stringify(form1Data) !==
        JSON.stringify(lastSavedDataRef.current.form1) ||
      JSON.stringify(form2Data) !==
        JSON.stringify(lastSavedDataRef.current.form2) ||
      JSON.stringify(form3Data) !==
        JSON.stringify(lastSavedDataRef.current.form3)

    setHasUnsavedChanges(isDifferent)
  }, [form1Data, form2Data, form3Data, currentPage])

  // Warn user before leaving page with unsaved changes (browser close/refresh)
  useEffect(() => {
    if (!hasUnsavedChanges) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      // Modern browsers show their own message, but we need to return a string for older ones
      e.returnValue =
        'You have unsaved changes. Are you sure you want to leave?'
      return e.returnValue
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  // Fetch user role when they log in
  useEffect(() => {
    if (!user?.address) {
      setUserRole(null)
      setIsRoleLoading(false)
      setShowRoleSelection(false)
      return
    }

    // Reset role state when user changes (but don't show modal yet - wait for API response)
    setUserRole(null)
    setShowRoleSelection(false)
    setIsRoleLoading(true) // Show loading while we fetch

    const fetchUserRole = async () => {
      setIsRoleLoading(true)
      try {
        const response = await fetch('/api/user/profile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            walletAddress: user.address,
          }),
        })
        if (response.ok) {
          const data = await response.json()
          console.log('[ROLE FETCH] API response:', data)
          if (data.success && data.profile) {
            // Normalize role value - handle null, undefined, empty string, or invalid values
            const roleValue = data.profile.role
            const normalizedRole =
              roleValue === 'driver' || roleValue === 'employer'
                ? roleValue
                : null

            console.log(
              '[ROLE FETCH] Profile found. Role:',
              roleValue,
              'Normalized:',
              normalizedRole,
              'Type:',
              typeof roleValue
            )

            setUserRole(normalizedRole)

            if (data.profile.company) {
              console.log('[ROLE FETCH] Company data:', data.profile.company)
              setCompanyName(data.profile.company.company_name)
            } else {
              console.log('[ROLE FETCH] No company data found for employer')
              setCompanyName(null)
            }

            // Show role selection if role is missing or invalid
            if (!normalizedRole) {
              console.log(
                '[ROLE FETCH] No valid role found - showing role selection'
              )
              setShowRoleSelection(true)
              // Don't navigate if no role - wait for user to select
            } else {
              console.log(
                '[ROLE FETCH] Valid role exists:',
                normalizedRole,
                '- NOT showing role selection'
              )
              setShowRoleSelection(false) // Explicitly hide modal if role exists

              // Navigate based on role (only if not already on a page)
              // Both drivers and employers start at home page
              if (!currentPage || currentPage === 'signin') {
                if (normalizedRole === 'driver') {
                  console.log('[ROLE FETCH] Driver role - showing DriverHub')
                  setCurrentPage(null) // null shows DriverHub for drivers
                } else if (normalizedRole === 'employer') {
                  console.log(
                    '[ROLE FETCH] Employer role - showing EmployerHub'
                  )
                  setCurrentPage(null) // null shows EmployerHub
                }
              }
            }
          } else {
            // API returned success but no profile data - treat as new user
            console.log(
              '[ROLE FETCH] API success but no profile data - showing role selection'
            )
            setUserRole(null)
            setShowRoleSelection(true)
          }
        } else {
          const errorData = await response.json().catch(() => ({}))
          console.error('Failed to fetch user profile:', response.statusText)
          console.error('Error details:', errorData)

          // If user not found (404) or any error, they're new or need role selection
          if (response.status === 404) {
            console.log('[ROLE FETCH] New user (404) - showing role selection')
            setUserRole(null)
            setShowRoleSelection(true)
          } else {
            // For other errors, still show role selection as fallback
            console.log(
              '[ROLE FETCH] Error fetching profile - showing role selection as fallback'
            )
            setUserRole(null)
            setShowRoleSelection(true)
          }

          // Show alert if migration is needed
          if (errorData.error === 'Database migration required') {
            alert('⚠️ Database Migration Required\n\n' + errorData.details)
          }
        }
      } catch (error) {
        console.error('Error fetching user role:', error)
        // On any error, show role selection as fallback
        console.log(
          '[ROLE FETCH] Exception caught - showing role selection as fallback'
        )
        setUserRole(null)
        setShowRoleSelection(true)
      } finally {
        setIsRoleLoading(false)
      }
    }

    fetchUserRole()
  }, [user?.address])

  useEffect(() => {
    if (hasResume) {
      updateJourneyStep('resume', 'complete')
    } else if (user?.address && journeyState.resume.status !== 'pending') {
      updateJourneyStep('resume', 'pending')
    }
  }, [hasResume, journeyState.resume.status, updateJourneyStep, user?.address])

  useEffect(() => {
    if (isDriverApplicationCompleted) {
      updateJourneyStep('forms', 'complete')
    } else if (
      !showPrefillUpload ||
      hasPrefilled ||
      form1Data ||
      form2Data ||
      form3Data
    ) {
      updateJourneyStep('forms', 'in_progress')
    }
  }, [
    isDriverApplicationCompleted,
    showPrefillUpload,
    hasPrefilled,
    form1Data,
    form2Data,
    form3Data,
    updateJourneyStep,
  ])

  useEffect(() => {
    if (showDashboard && isDriverApplicationCompleted) {
      updateJourneyStep('submission', 'complete')
    } else if (isDriverApplicationCompleted) {
      updateJourneyStep('submission', 'in_progress')
    } else if (
      !isDriverApplicationCompleted &&
      journeyState.submission.status !== 'pending'
    ) {
      updateJourneyStep('submission', 'pending')
    }
  }, [
    isDriverApplicationCompleted,
    showDashboard,
    journeyState.submission.status,
    updateJourneyStep,
  ])

  useEffect(() => {
    const nextStep = currentPage === 'dotapp' ? currentForm : null
    setJourneyState((prev) =>
      prev.currentFormStep === nextStep
        ? prev
        : {
            ...prev,
            currentFormStep: nextStep,
          }
    )
  }, [currentForm, currentPage])

  useEffect(() => {
    if (isDriverApplicationCompleted) {
      setJourneyState((prev) =>
        prev.lastCompletedForm === 3
          ? prev
          : {
              ...prev,
              lastCompletedForm: 3,
            }
      )
    } else {
      setJourneyState((prev) => {
        const completed = currentForm > 1 ? currentForm - 1 : null
        if (!completed) return prev
        if ((prev.lastCompletedForm ?? 0) >= completed) return prev
        return {
          ...prev,
          lastCompletedForm: completed,
        }
      })
    }
  }, [currentForm, isDriverApplicationCompleted])

  // Trigger primer when wallet is connected and primer hasn't been shown
  useEffect(() => {
    if (
      !primerSeen &&
      journeyState.wallet.status === 'complete' &&
      !isPrimerTriggered()
    ) {
      triggerPrimer()
    }
  }, [journeyState.wallet.status, primerSeen, isPrimerTriggered, triggerPrimer])

  // Determine current step for T Assistant
  const getCurrentStep = useCallback(():
    | 'welcome'
    | 'wallet'
    | 'resume'
    | 'forms'
    | 'submission'
    | 'complete' => {
    if (showDashboard) return 'complete'
    if (isDriverApplicationCompleted) return 'submission'
    if (currentPage === 'dotapp' && !showPrefillUpload) return 'forms'
    if (currentPage === 'resume' || hasPrefilled || hasResume) return 'resume'
    if (user) return 'wallet'
    return 'welcome'
  }, [
    user,
    currentPage,
    hasPrefilled,
    hasResume,
    showPrefillUpload,
    isDriverApplicationCompleted,
    showDashboard,
  ])

  // DISABLED: Auto-trigger removed for better UX - users should manually request prefill via T Assistant
  // Automatic prefill was pushy and unexpected. Manual trigger (via DOT form conversation) gives users control.
  //
  // useEffect(() => {
  //   if (
  //     currentPage === 'dotapp' &&
  //     latestResumeIpfsHash &&
  //     !form1Data &&
  //     !form2Data &&
  //     !form3Data &&
  //     user &&
  //     analysisTriggeredRef.current !== latestResumeIpfsHash && // Only trigger once per resume
  //     !analysisPendingRef.current // Prevent simultaneous triggers
  //   ) {
  //     console.log('📋 [HOME] User navigated to forms with existing resume, triggering analysis...')
  //     analysisPendingRef.current = true // Set flag immediately to prevent race
  //     analysisTriggeredRef.current = latestResumeIpfsHash
  //     handleResumeUploadEvent({
  //       type: 'analysis_ready',
  //       step: 'navigate_to_forms',
  //       data: {
  //         ipfsHash: latestResumeIpfsHash,
  //       },
  //       message: '🔍 I found your uploaded resume! Analyzing it to prefill your forms...',
  //     })
  //     // Reset pending flag after a delay (analysis will complete)
  //     setTimeout(() => {
  //       analysisPendingRef.current = false
  //     }, 2000)
  //   }
  // }, [currentPage, latestResumeIpfsHash, form1Data, form2Data, form3Data, user, handleResumeUploadEvent])

  // T Assistant action handler
  const handleTAssistantAction = useCallback(
    (action: string, data?: any) => {
      console.log('🎯 [HOME] T Assistant action:', action)
      switch (action) {
        case 'signin':
          setCurrentPage('signin')
          break
        case 'resume':
          setCurrentPage('resume')
          break
        case 'forms':
          setCurrentPage('dotapp')
          setShowPrefillUpload(false)
          break
        case 'resume:prefill':
          // Legacy action - navigate to forms (analysis should have already happened)
          setCurrentPage('dotapp')
          setShowPrefillUpload(false) // Go straight to forms, prefill is in Form 1
          setShowEmploymentVerification(false)
          setShowDashboard(false)
          break
        case 'resume:prefill:confirm':
          // T Assistant already extracted data - use it directly (no API call needed)
          console.log('🎯 [HOME] resume:prefill:confirm action received')
          console.log('   Data parameter:', data)
          console.log('   Data type:', typeof data)
          console.log('   Data keys:', data ? Object.keys(data) : 'null')

          setCurrentPage('dotapp')
          setShowPrefillUpload(false)
          setShowEmploymentVerification(false)
          setShowDashboard(false)

          if (data) {
            // T Assistant passed the extracted data directly - use it!
            console.log(
              '📥 [HOME] Using prefill data from T Assistant (no API call needed)'
            )
            console.log('   Data received:', {
              hasForm1Data: !!data.form1Data,
              hasForm2Data: !!data.form2Data,
              hasForm3Data: !!data.form3Data,
              form1DataKeys: data.form1Data ? Object.keys(data.form1Data) : [],
              form1DataSample: data.form1Data
                ? {
                    firstName: data.form1Data.firstName,
                    lastName: data.form1Data.lastName,
                    email: data.form1Data.email,
                  }
                : null,
            })
            console.log('   Calling handlePrefillSuccess with:', data)

            // Ensure data has the expected structure (API might return { success: true, form1Data, ... })
            const prefillData = {
              form1Data: data.form1Data,
              form2Data: data.form2Data,
              form3Data: data.form3Data,
              stats: data.stats,
            }
            console.log('   Normalized prefill data:', prefillData)
            handlePrefillSuccess(prefillData)

            // Trigger success message from T
            setTimeout(() => {
              handleResumeUploadEvent({
                type: 'analysis_ready',
                step: 'prefill',
                message:
                  "✅ Forms prefilled! I've extracted and filled in your information. Please review the forms and complete any missing fields.",
              })
            }, 500)
          } else {
            // Fallback: T Assistant didn't pass data, try API (shouldn't happen)
            console.warn(
              '⚠️ [HOME] No data from T Assistant, falling back to API call'
            )
            if (latestResumeIpfsHash) {
              fetch('/api/ai/prefill-resume', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  cid: latestResumeIpfsHash,
                }),
              })
                .then(async (prefillResponse) => {
                  if (prefillResponse.ok) {
                    const prefillData = await prefillResponse.json()
                    handlePrefillSuccess(prefillData)
                    setTimeout(() => {
                      handleResumeUploadEvent({
                        type: 'analysis_ready',
                        step: 'prefill',
                        message:
                          "✅ Forms prefilled! I've extracted and filled in your information. Please review the forms and complete any missing fields.",
                      })
                    }, 500)
                  } else {
                    const errorData = await prefillResponse
                      .json()
                      .catch(() => ({ error: 'Unknown error' }))
                    handlePrefillError(
                      errorData.error || 'Failed to prefill forms'
                    )
                  }
                })
                .catch((error) => {
                  console.error('❌ Auto-prefill error:', error)
                  handlePrefillError(
                    error instanceof Error
                      ? error.message
                      : 'Failed to prefill forms'
                  )
                })
            } else {
              // No resume hash available - go straight to forms (prefill is in Form 1)
              setShowPrefillUpload(false)
              // Note: User can still use prefill from Form 1 if they want
            }
          }
          break
        case 'resume:help':
          // Stay on resume page, T will provide help via chat
          setCurrentPage('resume')
          break
        case 'dashboard':
          setCurrentPage('dotapp')
          setShowPrefillUpload(false)
          setShowEmploymentVerification(false)
          setShowDashboard(true)
          break
        case 'primer:learn_more':
        case 'primer:skip':
          handlePrimerAction(action as 'primer:learn_more' | 'primer:skip')
          break
        default:
          break
      }
    },
    [handlePrimerAction]
  )

  // Debug: Log user state changes
  useEffect(() => {
    console.log('🎯 [HOME] User state changed:', user)
  }, [user])

  // Stable callback to prevent infinite loops
  const handleAuthSuccess = useCallback((userData: any) => {
    console.log('🎯 [HOME] handleAuthSuccess called with:', userData)
    setUser(userData)
    setIsCheckingSession(false) // Session check complete
    // Reset currentPage to null so user goes to home/dashboard instead of staying on signin page
    setCurrentPage(null)
    console.log('🎯 [HOME] User state updated and currentPage reset to home')
    // Don't auto-navigate here - let the role fetch useEffect handle it
    // This ensures employers go to dashboard and drivers go to resume
  }, [])

  // Give Alchemy time to check for existing session before showing sign-in
  useEffect(() => {
    // Wait 1.5 seconds for Alchemy to detect existing session
    // If no session is found by then, show the sign-in form
    const timeout = setTimeout(() => {
      if (!user) {
        console.log(
          '🔓 [AUTH] No existing session found after timeout, showing sign-in'
        )
        setIsCheckingSession(false)
      }
    }, 1500)

    return () => clearTimeout(timeout)
  }, [user])

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

  // Navigation handler - warns user if there are unsaved changes
  const handleNavigation = useCallback(
    (
      page:
        | 'signin'
        | 'resume'
        | 'dotapp'
        | 'jobs'
        | 'applications'
        | 'mvr'
        | 'home'
        | 'hub'
        | 'stormchain'
    ) => {
      console.log(`Navigating to: ${page}`)

      // Check for unsaved changes when leaving DOT app
      if (currentPage === 'dotapp' && page !== 'dotapp' && hasUnsavedChanges) {
        const confirmed = window.confirm(
          'You have unsaved changes in your DOT application. Are you sure you want to leave?\n\nYour changes will be lost.'
        )
        if (!confirmed) {
          return // Cancel navigation
        }
        // User confirmed - clear dirty state
        setHasUnsavedChanges(false)
      }

      if (page === 'home' || page === 'hub') {
        // Reset to beginning screen (Driver Hub for drivers, landing for others)
        setCurrentPage(null)
      } else {
        setCurrentPage(page)
      }
    },
    [currentPage, hasUnsavedChanges]
  )

  // Handler for AI prefill success
  const handlePrefillSuccess = useCallback(
    async (prefillData: {
      form1Data: any
      form2Data: any
      form3Data: any
      stats: any
    }) => {
      console.log('✅ [HOME] Prefill successful, populating forms')
      console.log('   Full prefill data:', JSON.stringify(prefillData, null, 2))
      console.log(
        `   Fields extracted: ${prefillData.stats?.extracted || 0}/${prefillData.stats?.total || 0}`
      )
      console.log('   Form1Data:', prefillData.form1Data)
      console.log('   Form2Data:', prefillData.form2Data)
      console.log('   Form3Data:', prefillData.form3Data)

      // Populate form data
      if (prefillData.form1Data) {
        console.log('   ✅ Setting form1Data:', prefillData.form1Data)
        setForm1Data(prefillData.form1Data)
      } else {
        console.warn('   ⚠️ No form1Data in prefill response')
      }
      if (prefillData.form2Data) {
        console.log('   ✅ Setting form2Data:', prefillData.form2Data)
        setForm2Data(prefillData.form2Data)
      }
      if (prefillData.form3Data) {
        console.log('   ✅ Setting form3Data:', prefillData.form3Data)
        setForm3Data(prefillData.form3Data)
      }

      // Sync extracted data to unified profile (fire-and-forget)
      // Uses form mappers: Form 1 → personal/CDL, Form 2 → driving, Form 3 → employment
      if (
        user?.address &&
        (prefillData.form1Data ||
          prefillData.form2Data ||
          prefillData.form3Data)
      ) {
        try {
          const { form1ToProfile, form2ToProfile, form3ToProfile } =
            await import('@/lib/dot-form-mapper')
          const profileData = {
            ...(prefillData.form1Data
              ? form1ToProfile(prefillData.form1Data)
              : {}),
            ...(prefillData.form2Data
              ? form2ToProfile(prefillData.form2Data)
              : {}),
            ...(prefillData.form3Data
              ? form3ToProfile(prefillData.form3Data)
              : {}),
          }
          fetch('/api/driver/profile', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'x-wallet-address': user.address,
            },
            body: JSON.stringify({
              profileData,
              source: 'uploaded_resume',
            }),
          })
            .then(async (response) => {
              if (response.status === 409) {
                // Conflict detected - notify Ava and show modal to user
                const conflictData = await response.json()
                console.warn(
                  '⚠️ [HOME] Profile conflict detected:',
                  conflictData.conflicts
                )

                // Notify Ava about the conflict
                handleResumeUploadEvent({
                  type: 'profile_conflict',
                  step: 'profile_sync',
                  data: {
                    conflicts: conflictData.conflicts,
                    existing: conflictData.existingProfile,
                    incoming: conflictData.incomingProfile,
                  },
                  message: `⚠️ I noticed this resume is for a different person than your existing profile. Let me help you decide what to do.`,
                })

                // Store conflict data for modal
                setProfileConflict({
                  conflicts: conflictData.conflicts,
                  existing: conflictData.existingProfile,
                  incoming: conflictData.incomingProfile,
                  profileData, // Store so we can retry if user chooses to replace
                })
                setShowProfileConflictModal(true)
              } else if (response.ok) {
                console.log('✅ [HOME] Profile synced from AI prefill')
              }
            })
            .catch((err) => {
              console.warn('⚠️ [HOME] Profile sync failed (non-fatal):', err)
            })
        } catch (profileError) {
          console.warn(
            '⚠️ [HOME] Profile sync error (non-fatal):',
            profileError
          )
        }
      }

      // Mark as prefilled and hide upload component (unless conflict modal is showing)
      if (!showProfileConflictModal) {
        setHasPrefilled(true)
        setShowPrefillUpload(false)
        setHasResume(true)
      }

      // Reset submission error if any
      setSubmissionError(null)

      // Start on Form 1
      setCurrentForm(1)

      // Force remount forms to pick up new data
      console.log(
        '   🔄 Incrementing formResetKey to remount forms with new data'
      )
      setFormResetKey((prev) => prev + 1)
    },
    [user?.address]
  )

  // Handler for AI prefill error
  const handlePrefillError = useCallback((error: string) => {
    console.error('❌ [HOME] Prefill error:', error)
    setSubmissionError(`AI Prefill Error: ${error}`)
  }, [])

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
      console.log('📝 [HOME] Form 3 completed, starting submission...')

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

      // Check for duplicate in database BEFORE submitting
      console.log('🔍 [HOME] Checking database for duplicate hash...')
      const { checkDuplicateApplicationHash } = await import(
        '@/lib/supabase-client-db'
      )

      const duplicateCheck = await checkDuplicateApplicationHash(
        user.address,
        applicationHash
      )

      if (duplicateCheck.exists) {
        console.warn('⚠️ [HOME] Duplicate application hash found in database')
        setSubmissionError(
          'This application has already been submitted. Please modify your application data before resubmitting.'
        )
        setCurrentForm(1)
        if (typeof window !== 'undefined') {
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }
        setIsSubmitting(false)
        return
      }

      console.log('✅ [HOME] No duplicate found, proceeding with submission')

      // For now, use a placeholder IPFS hash (we can add IPFS upload later)
      const ipfsHash = 'placeholder_ipfs_hash_' + Date.now()

      // 1. SAVE TO DATABASE FIRST (all form data)
      console.log('💾 [HOME] Saving application to database...')
      const { completeDriverApplicationClient } = await import(
        '@/lib/supabase-client-db'
      )

      const dbResult = await completeDriverApplicationClient(
        user.address,
        combinedData,
        ipfsHash,
        applicationHash // Pass application hash so persist endpoint can find the record
      )

      if (!dbResult.success) {
        console.error('❌ [HOME] Failed to save to database:', dbResult.error)
        setSubmissionError(
          'Failed to save application to database: ' + dbResult.error
        )
        setIsSubmitting(false)
        return
      }

      console.log('✅ [HOME] Application saved to database successfully')

      // Sync to unified profile (fire-and-forget, non-blocking)
      // Uses same form mappers as Save Progress: Form 1 → personal/CDL, Form 2 → driving, Form 3 → employment
      try {
        const { form1ToProfile, form2ToProfile, form3ToProfile } = await import(
          '@/lib/dot-form-mapper'
        )
        const profileData = {
          ...(form1Data ? form1ToProfile(form1Data) : {}),
          ...(form2Data ? form2ToProfile(form2Data) : {}),
          ...(form3Data ? form3ToProfile(form3Data) : {}),
        }
        fetch('/api/driver/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-wallet-address': user.address,
          },
          body: JSON.stringify({
            profileData,
            source: 'dot_application',
          }),
        })
          .then(() => {
            console.log('✅ [HOME] Unified profile synced from DOT application')
          })
          .catch((err) => {
            console.warn('⚠️ [HOME] Profile sync failed (non-fatal):', err)
          })
      } catch (profileError) {
        console.warn('⚠️ [HOME] Profile sync error (non-fatal):', profileError)
      }

      // Clear the in-progress DOT application state from profile
      // This prevents showing both "in-progress" and "submitted" in the Hub
      try {
        await fetch('/api/driver/profile/clear-dot-progress', {
          method: 'POST',
          headers: { 'x-wallet-address': user.address },
        })
        console.log('✅ [HOME] Cleared in-progress DOT state from profile')
      } catch (clearError) {
        console.warn(
          '⚠️ [HOME] Failed to clear DOT progress (non-fatal):',
          clearError
        )
      }

      // Mark as completed and show the submission confirmation screen
      // Note: Blockchain verification is now manual - user can verify from the Hub
      setIsDriverApplicationCompleted(true)
      setShowEmploymentVerification(false)
      setShowDashboard(false)

      console.log('✅ [HOME] Application submission complete')
    } catch (error: any) {
      console.error('❌ [HOME] Application submission failed:', error)
      setSubmissionError(error?.message || 'Failed to submit application')
    } finally {
      setIsSubmitting(false)
    }
  }, [form1Data, form2Data, form3Data, isSubmitting, user])

  // Save ALL forms to driver profile AND database - called on navigation and save button
  const saveAllFormsToProfile = useCallback(
    async (showIndicator = true) => {
      if (!user?.address) {
        console.log('⚠️ [SAVE] No wallet address, skipping save')
        return
      }

      try {
        if (showIndicator) startSync()
        console.log(
          '💾 [SAVE] Saving all forms to driver profile and database...'
        )

        // Import mappers dynamically
        const { form1ToProfile, form2ToProfile, form3ToProfile } = await import(
          '@/lib/dot-form-mapper'
        )

        // Combine all form data into profile format
        const profileData = {
          ...(form1Data ? form1ToProfile(form1Data) : {}),
          ...(form2Data ? form2ToProfile(form2Data) : {}),
          ...(form3Data ? form3ToProfile(form3Data) : {}),
        }

        console.log('💾 [SAVE] Combined profile data:', profileData)

        // 1. Save to unified driver profile (for cross-feature sharing)
        const profileResponse = await fetch('/api/driver/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-wallet-address': user.address,
          },
          body: JSON.stringify({
            profileData,
            source: 'dot_application',
          }),
        })

        if (!profileResponse.ok) {
          const errorData = await profileResponse.json()
          throw new Error(errorData.error || 'Failed to save to profile')
        }

        // 2. Save full form data to database (for cross-device persistence)
        // This ensures data persists even if localStorage is cleared
        try {
          const progressResponse = await fetch(
            '/api/driver-applications/save-progress',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-wallet-address': user.address,
              },
              body: JSON.stringify({
                form1Data,
                form2Data,
                form3Data,
                currentStep: currentForm,
              }),
            }
          )

          if (!progressResponse.ok) {
            // Log but don't fail - profile save succeeded, database save is bonus
            const errorData = await progressResponse.json().catch(() => ({}))
            console.warn(
              '⚠️ [SAVE] Failed to save progress to database (non-fatal):',
              errorData.error || 'Unknown error'
            )
          } else {
            console.log('✅ [SAVE] Progress saved to database')
          }
        } catch (dbError) {
          // Database save failed, but profile save succeeded - log and continue
          console.warn('⚠️ [SAVE] Database save error (non-fatal):', dbError)
        }

        console.log('✅ [SAVE] All forms saved to driver profile')
        if (showIndicator) syncSuccess()
        // Mark data as saved (no longer dirty)
        lastSavedDataRef.current = {
          form1: form1Data,
          form2: form2Data,
          form3: form3Data,
        }
        setHasUnsavedChanges(false)
        return true
      } catch (error) {
        console.error('❌ [SAVE] Failed to save forms:', error)
        if (showIndicator) syncError()
        return false
      }
    },
    [
      user?.address,
      form1Data,
      form2Data,
      form3Data,
      currentForm,
      startSync,
      syncSuccess,
      syncError,
    ]
  )

  // Handler for form navigation - auto-saves before navigating
  const handleFormNavigation = useCallback(
    async (formNumber: number) => {
      // Auto-save all forms before navigation
      await saveAllFormsToProfile()

      setCurrentForm(formNumber)
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    },
    [saveAllFormsToProfile]
  )

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

  // Render loading screen during application save
  const renderSubmissionLoading = () => (
    <div
      className={`max-w-4xl mx-auto p-6 ${
        theme === 'dark'
          ? 'bg-gray-800/50 backdrop-blur-xl'
          : 'bg-white/80 backdrop-blur-xl'
      } rounded-2xl shadow-2xl relative z-10 border-t-4 ${
        theme === 'dark' ? 'border-indigo-500' : 'border-indigo-600'
      }`}
    >
      <div className='text-center py-12'>
        <div className='mb-6'>
          <div className='flex justify-center mb-4'>
            <div className='animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-500'></div>
          </div>
        </div>

        <h1
          className={`text-3xl font-bold mb-4 ${
            theme === 'dark' ? 'text-white' : 'text-gray-900'
          }`}
        >
          Saving Application...
        </h1>

        <p
          className={`text-lg mb-6 ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
          }`}
        >
          Your driver application is being saved to your profile. This will only
          take a moment.
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
    // Show loading screen during application save
    if (isSubmitting) {
      return renderSubmissionLoading()
    }

    // If driver application is completed, show success page then redirect to Hub
    if (isDriverApplicationCompleted && !showEmploymentVerification) {
      return (
        <ApplicationSubmitted
          onNavigateToSafetyForm={handleNavigateToEmploymentVerification}
          onNavigateToDashboard={() => {
            // Navigate to Driver Hub (home for drivers)
            setCurrentPage(null)
            setIsDriverApplicationCompleted(false)
            setShowDashboard(false)
          }}
          blockchainData={blockchainData}
        />
      )
    }

    // If employment verification is requested, show the form
    if (isDriverApplicationCompleted && showEmploymentVerification) {
      return (
        <EmploymentVerificationForm
          userAddress={user?.address}
          onComplete={() => {
            // After employment verification, go back to Hub
            setShowEmploymentVerification(false)
            setCurrentPage(null)
            setIsDriverApplicationCompleted(false)
          }}
        />
      )
    }

    // Otherwise show the driver application forms
    switch (currentForm) {
      case 1:
        return (
          <PersonalInfoForm1
            key={`form1-${formResetKey}`}
            onNavigateToForm={handleFormNavigation}
            onDataChange={setForm1Data}
            initialData={form1Data}
            walletAddress={user?.address}
            onSaveProgress={saveAllFormsToProfile}
          />
        )
      case 2:
        return (
          <PersonalInfoForm2
            key={`form2-${formResetKey}`}
            onNavigateToForm={handleFormNavigation}
            onDataChange={setForm2Data}
            initialData={form2Data}
            walletAddress={user?.address}
            onSaveProgress={saveAllFormsToProfile}
          />
        )
      case 3:
        return (
          <PersonalInfoForm3
            key={`form3-${formResetKey}`}
            onComplete={handleDriverApplicationCompleted}
            onDataChange={setForm3Data}
            initialData={form3Data}
            walletAddress={user?.address}
            onSaveProgress={saveAllFormsToProfile}
          />
        )
      default:
        return (
          <PersonalInfoForm1
            key={`form1-${formResetKey}`}
            onNavigateToForm={handleFormNavigation}
            onDataChange={setForm1Data}
            initialData={form1Data}
            walletAddress={user?.address}
            onSaveProgress={saveAllFormsToProfile}
          />
        )
    }
  }

  // Render form navigation buttons
  const renderFormNavigation = () => {
    if (currentPage !== 'dotapp') return null

    // Hide navigation when driver application is completed or employment verification is shown
    if (isDriverApplicationCompleted || showEmploymentVerification) return null

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
    <AssistantBridgeProvider
      journey={journeyState}
      requestHelp={handleHelpRequest}
      primerSeen={primerSeen}
      setPrimerSeen={setPrimerSeen}
      notifyResumeUploadEvent={handleResumeUploadEvent}
    >
      <div className='min-h-screen overflow-x-hidden relative'>
        {/* Animated Background - swap between themes:
            <AnimatedBackground /> = original bubbles (Veree style)
            <StormBackground />   = storm clouds + rain + lightning (StormChain style)
        */}
        <StormBackground />

        {/* Sync Status Indicator - Fixed position toast */}
        {indicatorProps.status !== 'idle' && (
          <div className='fixed top-20 left-1/2 -translate-x-1/2 z-[70]'>
            <SyncIndicator {...indicatorProps} />
          </div>
        )}

        {/* Wallet Info - Top Left Corner (Desktop Only) */}
        {user?.address && (
          <div className='fixed top-4 left-4 z-[60] pointer-events-none'>
            <div className='pointer-events-auto'>
              <WalletInfo walletAddress={user.address} onClick={openModal} />
            </div>
          </div>
        )}

        {/* MVR Management Modal */}
        {user?.address && (
          <MvrManagementModal
            isOpen={isMvrManagementOpen}
            onClose={() => setIsMvrManagementOpen(false)}
            walletAddress={user.address}
            onOrderNew={() => setCurrentPage('mvr')}
            onCompleteOrder={(paymentTxHash) => {
              // Store payment hash for form to pick up
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
        )}

        {/* MVR View Modal */}
        {user?.address && (
          <MvrViewModal
            isOpen={isMvrModalOpen}
            onClose={() => {
              setIsMvrModalOpen(false)
              setSelectedMvrOrderId(null)
            }}
            walletAddress={user.address}
          />
        )}

        {/* Navigation with Hub button */}
        <Navigation
          isAuthenticated={!!user}
          userRole={userRole}
          onStatusClick={openModal}
          onNavigate={handleNavigation}
          mvrWalletAddress={user?.address || null}
          tHasUnread={avaHasUnread}
          onTClick={() => setIsAvaCollapsed(false)}
          stormTokens={0} // TODO: Replace with actual token balance when implemented
          onSwitchRole={() => setShowRoleSelection(true)}
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
          userRole={userRole}
        />

        {/* Role Selection Modal - rendered here so z-[80] sits above nav (z-50); was overlapping when inside main content (z-0) */}
        {user &&
          !isRoleLoading &&
          !isSettingRole &&
          (showRoleSelection || userRole === null) && (
            <RoleSelectionModal
              onSelectRole={handleRoleSelection}
              isLoading={isSettingRole}
              userEmail={user?.email}
            />
          )}

        {/* T Assistant - Sidebar (only when logged in) */}
        {user && (
          <>
            <TAssistant
              currentStep={getCurrentStep()}
              onAction={handleTAssistantAction}
              userAddress={user?.address}
              userRole={userRole}
              hasResume={hasResume}
              hasForms={journeyState.forms.status !== 'pending'}
              form1Data={form1Data}
              form2Data={form2Data}
              form3Data={form3Data}
              journeyState={journeyState}
              helpRequest={helpRequest}
              primerRequest={primerRequest}
              resumeUploadEvent={resumeUploadEvent}
              mode='sidebar'
              isCollapsed={isAvaCollapsed}
              onToggleCollapse={toggleAvaCollapse}
              onUnreadChange={setAvaHasUnread}
              onLoadingChange={(isLoading, message) => {
                setAvaWorking(isLoading, message)
              }}
            />

            {/* AvA Loading Modal - shown when AvA is working */}
            <TLoadingModal
              isVisible={avaIsWorking}
              message={avaWorkingMessage}
            />
          </>
        )}

        {/* Main Content */}
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 mt-8 relative z-0'>
          {/* Loading Screen - Show while fetching user role/data or switching roles */}
          {user && (isRoleLoading || isSettingRole) && !showRoleSelection && (
            <LoadingScreen
              message={
                isSettingRole
                  ? 'Switching roles...'
                  : 'Loading your dashboard...'
              }
            />
          )}

          {/* Employer Hub - Show if user is an employer and on home page */}
          {user &&
            userRole === 'employer' &&
            !isRoleLoading &&
            !currentPage && (
              <EmployerHub
                walletAddress={user.address}
                onNavigate={(page) => {
                  // Map hub navigation to page navigation
                  if (
                    page === 'post-job' ||
                    page === 'jobs' ||
                    page === 'applicants' ||
                    page === 'find-drivers' ||
                    page === 'talent-search' ||
                    page === 'company-profile' ||
                    page === 'reports'
                  ) {
                    setCurrentPage(page)
                  }
                }}
              />
            )}

          {/* Employer Pages */}
          {user &&
            userRole === 'employer' &&
            !isRoleLoading &&
            currentPage === 'applicants' && (
              <ApplicantsPage
                walletAddress={user.address}
                onBack={() => setCurrentPage(null)}
              />
            )}

          {user &&
            userRole === 'employer' &&
            !isRoleLoading &&
            currentPage === 'find-drivers' && (
              <FindDriversPage
                walletAddress={user.address}
                onBack={() => setCurrentPage(null)}
              />
            )}

          {user &&
            userRole === 'employer' &&
            !isRoleLoading &&
            currentPage === 'talent-search' && (
              <TalentSearchPage
                walletAddress={user.address}
                onBack={() => setCurrentPage(null)}
              />
            )}

          {/* Developer Hub - Show if user is a software engineer and on home page */}
          {user &&
            userRole === 'developer' &&
            !isRoleLoading &&
            !currentPage && (
              <DeveloperHub
                userAddress={user.address}
                onNavigate={(page) => {
                  // Map hub navigation to page navigation
                  if (
                    page === 'portfolio' ||
                    page === 'resume' ||
                    page === 'github' ||
                    page === 'jobs' ||
                    page === 'applications'
                  ) {
                    setCurrentPage(page)
                  }
                }}
              />
            )}

          {/* Developer Pages */}
          {user &&
            userRole === 'developer' &&
            !isRoleLoading &&
            currentPage === 'portfolio' && (
              <PortfolioPage
                userAddress={user.address}
                onBack={() => setCurrentPage(null)}
              />
            )}

          {/* Driver Content - Show if user is a driver or has not selected role yet */}
          {(!user ||
            userRole === 'driver' ||
            (user && !userRole && !showRoleSelection)) &&
            !isRoleLoading && (
              <>
                {/* Conditional Content Based on Navigation */}
                {/* Home Page / Driver Hub - Default */}
                {!currentPage &&
                  (user && userRole === 'driver' ? (
                    // Driver Hub is the default landing for logged-in drivers
                    <DriverHub
                      userAddress={user.address}
                      onNavigate={(page) => {
                        if (
                          page === 'resume' ||
                          page === 'dotapp' ||
                          page === 'jobs' ||
                          page === 'applications' ||
                          page === 'mvr' ||
                          page === 'stormchain'
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
                        // Navigate to DOT app page and show employment verification
                        setIsDriverApplicationCompleted(true)
                        setShowEmploymentVerification(true)
                        setCurrentPage('dotapp')
                      }}
                    />
                  ) : (
                    <HomePage
                      isAuthenticated={!!user}
                      onGetStarted={() => {
                        if (user) {
                          setCurrentPage('resume')
                        } else {
                          setCurrentPage('signin')
                        }
                      }}
                    />
                  ))}

                {currentPage === 'signin' && !user && (
                  <div className='max-w-md mx-auto overflow-hidden'>
                    {isCheckingSession ? (
                      <div className='relative backdrop-blur-xl rounded-3xl shadow-2xl border p-8 bg-gray-800/50 border-indigo-500/30'>
                        <div className='relative text-center'>
                          <div
                            className={`animate-spin rounded-full h-10 w-10 border-b-2 mx-auto mb-4 ${
                              theme === 'light'
                                ? 'border-indigo-600'
                                : 'border-indigo-400'
                            }`}
                          ></div>
                          <p
                            className={`${
                              theme === 'light'
                                ? 'text-gray-600'
                                : 'text-gray-300'
                            }`}
                          >
                            Checking for existing session...
                          </p>
                        </div>
                      </div>
                    ) : (
                      <AlchemyAuth
                        onAuthSuccess={handleAuthSuccess}
                        onLogoutSuccess={() => setUser(null)}
                      />
                    )}
                  </div>
                )}

                {currentPage === 'resume' && (
                  <div className='max-w-4xl mx-auto space-y-6'>
                    {/* Drivers use Upload via hub modal; this page is Create only. Others get Upload + Create tabs. */}
                    {userRole === 'driver' ? (
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
                            setHasResume(true)
                            setEditingResumeId(undefined)
                          }}
                        />
                        {user && <WalletTransactions />}
                      </>
                    ) : (
                      <>
                        <ResumeTabSelector
                          activeTab={resumeTab}
                          onTabChange={setResumeTab}
                          theme={theme}
                        />
                        {resumeTab === 'upload' && (
                          <ResumeUploadWithVerification
                            user={user}
                            onBack={() => setCurrentPage(null)}
                            onUploadComplete={(payload) => {
                              setHasResume(true)
                              if (payload?.finalResult?.ipfsHash) {
                                setLatestResumeIpfsHash(
                                  payload.finalResult.ipfsHash
                                )
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
                              setHasResume(true)
                              setEditingResumeId(undefined)
                            }}
                          />
                        )}
                        {user && <WalletTransactions />}
                      </>
                    )}
                  </div>
                )}

                {currentPage === 'jobs' && (
                  <div className='max-w-7xl mx-auto relative z-0'>
                    <JobListings
                      onBack={() => setCurrentPage(null)}
                      userAddress={user?.address || null}
                    />
                  </div>
                )}

                {currentPage === 'applications' && (
                  <div className='max-w-7xl mx-auto relative z-0'>
                    <MyApplications
                      onBack={() => setCurrentPage(null)}
                      userAddress={user?.address || null}
                    />
                  </div>
                )}

                {currentPage === 'mvr' && (
                  <div className='max-w-2xl mx-auto'>
                    <MvrOrderForm
                      userAddress={user?.address || ''}
                      onBack={() => setCurrentPage(null)}
                    />
                  </div>
                )}

                {currentPage === 'stormchain' && (
                  <StormChainView onBack={() => handleNavigation('hub')} />
                )}

                {currentPage === 'dotapp' && (
                  <>
                    <div className='max-w-4xl mx-auto mb-4'>
                      <button
                        onClick={() => handleNavigation('hub')}
                        className='inline-flex items-center gap-2 px-3 py-2 sm:px-4 text-sm sm:text-base text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer'
                      >
                        <ArrowLeft className='w-4 h-4 sm:w-5 sm:h-5' />
                        Back
                      </button>
                    </div>
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

                    {/* AI Prefill Upload - Show before forms or if manually shown */}
                    {showPrefillUpload && !isDriverApplicationCompleted && (
                      <div className='mb-8'>
                        <ResumeUploadWithPrefill
                          onPrefillSuccess={handlePrefillSuccess}
                          onPrefillError={handlePrefillError}
                          onIpfsHashReady={(ipfsHash) => {
                            // Store IPFS hash for later prefill confirmation
                            setLatestResumeIpfsHash(ipfsHash)
                          }}
                        />

                        {/* Option to skip prefill */}
                        <div className='text-center mt-6'>
                          <button
                            onClick={() => {
                              setShowPrefillUpload(false)
                              setCurrentForm(1)
                            }}
                            className={`text-sm underline transition-colors ${
                              theme === 'dark'
                                ? 'text-gray-400 hover:text-gray-300'
                                : 'text-gray-600 hover:text-gray-800'
                            }`}
                          >
                            Skip AI prefill and fill manually
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Show forms and navigation after prefill or skip */}
                    {!showPrefillUpload && (
                      <>
                        {/* Success banner if prefilled */}
                        {hasPrefilled && !isDriverApplicationCompleted && (
                          <div
                            className={`max-w-4xl mx-auto mb-6 px-4 py-3 rounded-lg border flex items-center justify-between ${
                              theme === 'dark'
                                ? 'bg-green-900/20 border-green-500/50 text-green-300'
                                : 'bg-green-50 border-green-200 text-green-800'
                            }`}
                          >
                            <span>
                              ✨ Forms prefilled with AI! Review and complete
                              any missing fields.
                            </span>
                            <button
                              onClick={() => setShowPrefillUpload(true)}
                              className={`text-xs underline ml-4 ${
                                theme === 'dark'
                                  ? 'text-green-400'
                                  : 'text-green-600'
                              }`}
                            >
                              Upload different resume
                            </button>
                          </div>
                        )}

                        {renderFormNavigation()}
                        {renderFormContent()}
                      </>
                    )}
                  </>
                )}
              </>
            )}
        </div>
      </div>

      {/* Profile Conflict Modal */}
      <ProfileConflictModal
        isOpen={showProfileConflictModal}
        conflict={profileConflict}
        userAddress={user?.address ?? null}
        onKeepExisting={() => {
          setShowProfileConflictModal(false)
          setProfileConflict(null)
          setHasPrefilled(true)
          setShowPrefillUpload(false)
          setHasResume(true)
        }}
        onReplaceWithNew={() => {
          setShowProfileConflictModal(false)
          setProfileConflict(null)
          setHasPrefilled(true)
          setShowPrefillUpload(false)
          setHasResume(true)
        }}
      />
    </AssistantBridgeProvider>
  )
}

// Wrapper component to ensure Alchemy provider is mounted
const Home = () => {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Don't render content until client-side provider is ready
  if (!mounted) {
    return (
      <div className='min-h-screen bg-gradient-to-br from-brand-sage to-brand-mint flex items-center justify-center'>
        <div className='text-white text-xl'>Loading...</div>
      </div>
    )
  }

  return <HomeContent />
}

export default Home
