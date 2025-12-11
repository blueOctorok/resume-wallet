'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import Navigation from '@/components/Navigation'
import AnimatedBackground from '@/components/AnimatedBackground'
import UserStatusModal from '@/components/UserStatusModal'
import WalletCard from '@/components/WalletCard'
import TLoadingModal from '@/components/TLoadingModal'
import LoadingScreen from '@/components/LoadingScreen'
import MvrOrderForm from '@/components/MvrOrderForm'
import { useTheme } from '@/contexts/ThemeContext'
import { useSendUserOperation, useSmartAccountClient } from '@account-kit/react'
import { AssistantBridgeProvider } from '@/contexts/AssistantBridgeContext'
import type {
  AssistantHelpPayload,
  AssistantHelpRequest,
  DriverJourneyState,
  JourneyStatus,
  PrimerPrompt,
  ResumeUploadEvent,
} from '@/types/assistant'

// Dynamic imports to avoid SSR issues with Alchemy hooks
const ResumeUploadWithVerification = dynamic(
  () => import('@/components/ResumeUploadWithVerification'),
  {
    ssr: false,
    loading: () => <LoadingScreen message="Loading resume upload..." fullScreen={false} />,
  }
)

const AlchemyAuth = dynamic(
  () => import('@/components/AlchemyAuth').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => <LoadingScreen message="Loading authentication..." fullScreen={false} />,
  }
)

const PersonalInfoForm1 = dynamic(
  () =>
    import('@/components/driver-application/PersonalInfoForm1').then(
      (mod) => mod.default
    ),
  {
    ssr: false,
    loading: () => <LoadingScreen message="Loading DOT application..." fullScreen={false} />,
  }
)

const PersonalInfoForm2 = dynamic(
  () =>
    import('@/components/driver-application/PersonalInfoForm2').then(
      (mod) => mod.default
    ),
  {
    ssr: false,
    loading: () => <LoadingScreen message="Loading DOT application..." fullScreen={false} />,
  }
)

const PersonalInfoForm3 = dynamic(
  () =>
    import('@/components/driver-application/PersonalInfoForm3').then(
      (mod) => mod.default
    ),
  {
    ssr: false,
    loading: () => <LoadingScreen message="Loading DOT application..." fullScreen={false} />,
  }
)

const JobListings = dynamic(
  () => import('@/components/JobListings').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => <LoadingScreen message="Loading job listings..." fullScreen={false} />,
  }
)

const MyApplications = dynamic(
  () => import('@/components/MyApplications').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => <LoadingScreen message="Loading applications..." fullScreen={false} />,
  }
)

const ApplicationSubmitted = dynamic(
  () =>
    import('@/components/driver-application/ApplicationSubmitted').then(
      (mod) => mod.default
    ),
  {
    ssr: false,
    loading: () => <LoadingScreen message="Loading application..." fullScreen={false} />,
  }
)

const DriverDashboard = dynamic(
  () =>
    import('@/components/driver-application/DriverDashboard').then(
      (mod) => mod.default
    ),
  {
    ssr: false,
    loading: () => <LoadingScreen message="Loading dashboard..." fullScreen={false} />,
  }
)

const EmploymentVerificationForm = dynamic(
  () =>
    import('@/components/driver-application/EmploymentVerificationForm').then(
      (mod) => mod.default
    ),
  {
    ssr: false,
    loading: () => <LoadingScreen message="Loading verification form..." fullScreen={false} />,
  }
)

const ResumeUploadWithPrefill = dynamic(
  () => import('@/components/ResumeUploadWithPrefill'),
  {
    ssr: false,
    loading: () => <LoadingScreen message="Loading resume upload..." fullScreen={false} />,
  }
)

const ResumeDashboard = dynamic(
  () => import('@/components/ResumeDashboard').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => <LoadingScreen message="Loading your resumes..." fullScreen={false} />,
  }
)

const WalletTransactions = dynamic(
  () =>
    import('@/components/WalletTransactions').then(
      (mod) => mod.WalletTransactions
    ),
  {
    ssr: false,
    loading: () => <LoadingScreen message="Loading transactions..." fullScreen={false} />,
  }
)

const TAssistant = dynamic(
  () => import('@/components/TAssistant').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => <LoadingScreen message="Loading AvA Assistant..." fullScreen={false} />,
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
    loading: () => <LoadingScreen message="Loading..." fullScreen={false} />,
  }
)

const EmployerDashboard = dynamic(
  () => import('@/components/EmployerDashboard').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => <LoadingScreen message="Loading dashboard..." fullScreen={false} />,
  }
)

const RoleSelectionModal = dynamic(
  () => import('@/components/RoleSelectionModal').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => <LoadingScreen message="Loading..." fullScreen={false} />,
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

  const [user, setUser] = useState<any>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState<
    'signin' | 'resume' | 'dotapp' | 'jobs' | 'applications' | 'mvr' | null
  >(null)
  
  // Role-based access control
  const [userRole, setUserRole] = useState<'driver' | 'employer' | null>(null)
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

  // Track if user has used AI prefill
  const [hasPrefilled, setHasPrefilled] = useState(false)
  const [showPrefillUpload, setShowPrefillUpload] = useState(true)
  const [journeyState, setJourneyState] = useState<DriverJourneyState>(() =>
    createInitialJourneyState()
  )
  
  // AvA Assistant state
  const [isAvaCollapsed, setIsAvaCollapsed] = useState(true) // Start collapsed
  const [avaHasUnread, setAvaHasUnread] = useState(false)
  const [avaIsWorking, setAvaIsWorking] = useState(false)
  const [avaWorkingMessage, setAvaWorkingMessage] = useState('AvA is thinking...')
  const [helpRequest, setHelpRequest] = useState<AssistantHelpRequest | null>(
    null
  )
  const [primerSeen, setPrimerSeen] = useState(false)
  const [primerRequest, setPrimerRequest] = useState<PrimerPrompt | null>(null)
  const [hasResume, setHasResume] = useState(false)
  const [latestResumeIpfsHash, setLatestResumeIpfsHash] = useState<string | null>(null)
  const primerTriggeredRef = useRef(false)
  const [resumeUploadEvent, setResumeUploadEvent] = useState<ResumeUploadEvent | null>(null)
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

  const handleSetPrimerSeen = useCallback(
    (value: boolean) => {
      setPrimerSeen(value)
      if (typeof window !== 'undefined' && user?.address) {
        window.localStorage.setItem(
          `journey-primer-${user.address}`,
          value ? 'seen' : 'pending'
        )
      }
    },
    [user?.address]
  )

  const handleHelpRequest = useCallback((payload: AssistantHelpPayload) => {
    const request: AssistantHelpRequest = {
      ...payload,
      id: `help-${Date.now()}`,
      createdAt: new Date().toISOString(),
    }
    setHelpRequest(request)
  }, [])

  const handleResumeUploadEvent = useCallback((event: ResumeUploadEvent) => {
    setResumeUploadEvent(event)
    
    // Store IPFS hash from analysis_ready event for later prefill use
    if (event.type === 'analysis_ready' && event.data?.ipfsHash) {
      setLatestResumeIpfsHash(event.data.ipfsHash)
      console.log('💾 [PREFILL] Stored IPFS hash from analysis event:', event.data.ipfsHash)
    }
    
    // Clear the event after a short delay to allow re-triggering of different events
    setTimeout(() => {
      setResumeUploadEvent(null)
    }, 100)
  }, [])

  const handleRoleSelection = useCallback(async (role: 'driver' | 'employer') => {
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
            console.log('[ROLE SELECTION] Role verified in database:', verifyData.profile.role)
          } else {
            console.warn('[ROLE SELECTION] Role verification failed - role may not have persisted')
          }
        }
        
        // If driver, navigate to resume page to start their journey
        if (role === 'driver') {
          setCurrentPage('resume')
        } else {
          // Employer goes to home which shows their dashboard
          setCurrentPage(null)
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error('Failed to set user role:', response.statusText, errorData)
        alert(`Failed to set role: ${errorData.error || response.statusText}. Please try again.`)
        // Keep modal open so user can retry
        setIsSettingRole(false)
      }
    } catch (error) {
      console.error('Error setting user role:', error)
      alert('An error occurred. Please try again.')
    } finally {
      setIsSettingRole(false)
    }
  }, [user])

  // Handle role switching from WalletCard
  const handleSwitchRole = useCallback(() => {
    if (!userRole) return
    
    const newRole = userRole === 'driver' ? 'employer' : 'driver'
    const confirmed = confirm(`Switch to ${newRole === 'driver' ? 'Driver' : 'Employer'} role?\n\nThis will change your account type and navigate you to the ${newRole} dashboard.`)
    
    if (confirmed) {
      handleRoleSelection(newRole)
    }
  }, [userRole, handleRoleSelection])

  const resetApplicationProgress = useCallback(() => {
    console.log('🔄 [RESET] ==================== START RESET ====================')
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
    setShowPrefillUpload(true)
    setCurrentForm(1)
    setIsDriverApplicationCompleted(false)
    setShowEmploymentVerification(false)
    setShowDashboard(false)
    setSubmissionError(null)
    setHasResume(false)
    setLatestResumeIpfsHash(null) // Clear stored IPFS hash
    setHelpRequest(null)
    setPrimerRequest(null)
    primerTriggeredRef.current = false
    analysisTriggeredRef.current = null // Reset analysis trigger
    analysisPendingRef.current = false // Reset pending flag
    
    // Clear localStorage
    if (typeof window !== 'undefined' && user?.address) {
      console.log('🔄 [RESET] Clearing localStorage for:', user.address)
      const beforeForms = window.localStorage.getItem(`forms-${user.address}`)
      const beforeJourney = window.localStorage.getItem(`journey-${user.address}`)
      console.log('🔄 [RESET] Before clear - forms:', beforeForms?.substring(0, 100))
      console.log('🔄 [RESET] Before clear - journey:', beforeJourney?.substring(0, 100))
      
      // Clear all localStorage items for this user
      window.localStorage.removeItem(`forms-${user.address}`)
      window.localStorage.removeItem(`journey-${user.address}`)
      window.localStorage.removeItem(`journey-primer-${user.address}`)
      
      const afterForms = window.localStorage.getItem(`forms-${user.address}`)
      const afterJourney = window.localStorage.getItem(`journey-${user.address}`)
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
    console.log('🔄 [RESET] Incremented formResetKey from', oldKey, 'to', oldKey + 1)
    
    // Clear the reset flag after a brief delay to allow state updates to complete
    setTimeout(() => {
      resetInProgressRef.current = false
      console.log('✅ [RESET] ==================== END RESET ====================')
      console.log('✅ [RESET] Reset flag cleared')
      console.log('✅ [RESET] form1Data should now be:', form1Data)
      console.log('✅ [RESET] form2Data should now be:', form2Data)
      console.log('✅ [RESET] form3Data should now be:', form3Data)
    }, 100)
  }, [updateJourneyStep, user?.address, formResetKey, form1Data, form2Data, form3Data])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!user?.address) {
      setJourneyState(createInitialJourneyState())
      setHelpRequest(null)
      setPrimerRequest(null)
      primerTriggeredRef.current = false
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
      }

      const storedPrimer = window.localStorage.getItem(
        `journey-primer-${user.address}`
      )
      setPrimerSeen(storedPrimer === 'seen')
      primerTriggeredRef.current = storedPrimer === 'seen'
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
      console.log('⏸️ [FORMS] Skipping localStorage save - reset in progress')
      return
    }
    
    // Only save if at least one form has data
    if (!form1Data && !form2Data && !form3Data) {
      console.log('⏸️ [FORMS] Skipping localStorage save - no form data')
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
      console.log('💾 [FORMS] Saved form data to localStorage')
    } catch (error) {
      console.warn('⚠️ Failed to persist form data', error)
    }
  }, [form1Data, form2Data, form3Data, user?.address])

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
      console.log('📢 [RESET] Received wallet-data-reset event:', detail)
      if (
        detail?.walletAddress &&
        detail.walletAddress.toLowerCase() === user.address.toLowerCase()
      ) {
        console.log('✅ [RESET] Wallet address matches, triggering reset')
        resetApplicationProgress()
      } else {
        console.log('⚠️ [RESET] Wallet address mismatch, ignoring reset')
      }
    }
    window.addEventListener('wallet-data-reset', handler)
    console.log('👂 [RESET] Listening for wallet-data-reset events')
    return () => {
      window.removeEventListener('wallet-data-reset', handler)
    }
  }, [user?.address, resetApplicationProgress])

  useEffect(() => {
    if (user?.address) {
      updateJourneyStep('wallet', 'complete')
    }
  }, [user?.address, updateJourneyStep])

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
            const normalizedRole = (roleValue === 'driver' || roleValue === 'employer') 
              ? roleValue 
              : null
            
            console.log('[ROLE FETCH] Profile found. Role:', roleValue, 'Normalized:', normalizedRole, 'Type:', typeof roleValue)
            
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
              console.log('[ROLE FETCH] No valid role found - showing role selection')
              setShowRoleSelection(true)
              // Don't navigate if no role - wait for user to select
            } else {
              console.log('[ROLE FETCH] Valid role exists:', normalizedRole, '- NOT showing role selection')
              setShowRoleSelection(false) // Explicitly hide modal if role exists
              
              // Navigate based on role (only if not already on a page)
              if (!currentPage || currentPage === 'signin') {
                if (normalizedRole === 'driver') {
                  console.log('[ROLE FETCH] Driver role - navigating to resume')
                  setCurrentPage('resume')
                } else if (normalizedRole === 'employer') {
                  console.log('[ROLE FETCH] Employer role - staying on home (dashboard)')
                  setCurrentPage(null) // null shows employer dashboard
                }
              }
            }
          } else {
            // API returned success but no profile data - treat as new user
            console.log('[ROLE FETCH] API success but no profile data - showing role selection')
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
            console.log('[ROLE FETCH] Error fetching profile - showing role selection as fallback')
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
        console.log('[ROLE FETCH] Exception caught - showing role selection as fallback')
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

  useEffect(() => {
    if (
      !primerSeen &&
      journeyState.wallet.status === 'complete' &&
      !primerTriggeredRef.current
    ) {
      setPrimerRequest({
        id: `primer-${Date.now()}`,
        message:
          'Curious why DriverAppChain uses Base smart wallets? I can explain how it keeps your records portable and gas-free.',
      })
      primerTriggeredRef.current = true
    }
  }, [journeyState.wallet.status, primerSeen])

  useEffect(() => {
    if (primerSeen) {
      setPrimerRequest(null)
    }
  }, [primerSeen])

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

  const handlePrimerAction = useCallback(
    (action: 'primer:learn_more' | 'primer:skip') => {
      handleSetPrimerSeen(true)
      setPrimerRequest(null)
      primerTriggeredRef.current = true
      console.log('🎓 [HOME] Primer action:', action)
    },
    [handleSetPrimerSeen]
  )

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
          setShowPrefillUpload(true)
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
            console.log('📥 [HOME] Using prefill data from T Assistant (no API call needed)')
            console.log('   Data received:', {
              hasForm1Data: !!data.form1Data,
              hasForm2Data: !!data.form2Data,
              hasForm3Data: !!data.form3Data,
              form1DataKeys: data.form1Data ? Object.keys(data.form1Data) : [],
              form1DataSample: data.form1Data ? {
                firstName: data.form1Data.firstName,
                lastName: data.form1Data.lastName,
                email: data.form1Data.email,
              } : null,
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
                message: '✅ Forms prefilled! I\'ve extracted and filled in your information. Please review the forms and complete any missing fields.',
              })
            }, 500)
          } else {
            // Fallback: T Assistant didn't pass data, try API (shouldn't happen)
            console.warn('⚠️ [HOME] No data from T Assistant, falling back to API call')
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
                        message: '✅ Forms prefilled! I\'ve extracted and filled in your information. Please review the forms and complete any missing fields.',
                      })
                    }, 500)
                  } else {
                    const errorData = await prefillResponse.json().catch(() => ({ error: 'Unknown error' }))
                    handlePrefillError(errorData.error || 'Failed to prefill forms')
                  }
                })
                .catch((error) => {
                  console.error('❌ Auto-prefill error:', error)
                  handlePrefillError(error instanceof Error ? error.message : 'Failed to prefill forms')
                })
            } else {
              // No resume hash available, show upload component
              setShowPrefillUpload(true)
              setTimeout(() => {
                handleResumeUploadEvent({
                  type: 'analysis_ready',
                  step: 'prefill',
                  message: 'I need your resume to prefill the forms. Please upload it below.',
                })
              }, 300)
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
  const handleAuthSuccess = useCallback(
    (userData: any) => {
      console.log('🎯 [HOME] handleAuthSuccess called with:', userData)
      setUser(userData)
      console.log('🎯 [HOME] User state updated')
      // Don't auto-navigate here - let the role fetch useEffect handle it
      // This ensures employers go to dashboard and drivers go to resume
    },
    []
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
    (page: 'signin' | 'resume' | 'dotapp' | 'jobs' | 'applications' | 'mvr' | 'home') => {
      console.log(`Navigating to: ${page}`)
      if (page === 'home') {
        // Reset to beginning screen (landing/wallet page)
        setCurrentPage(null)
      } else {
        setCurrentPage(page)
      }
    },
    []
  )

  // Handler for AI prefill success
  const handlePrefillSuccess = useCallback(
    (prefillData: {
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

      // Mark as prefilled and hide upload component
      setHasPrefilled(true)
      setShowPrefillUpload(false)
      setHasResume(true)

      // Reset submission error if any
      setSubmissionError(null)

      // Start on Form 1
      setCurrentForm(1)
      
      // Force remount forms to pick up new data
      console.log('   🔄 Incrementing formResetKey to remount forms with new data')
      setFormResetKey((prev) => prev + 1)
    },
    []
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

      // 2. SUBMIT TO BLOCKCHAIN FOR VERIFICATION (server-side with sponsored gas)
      console.log('📝 [HOME] Submitting to blockchain for verification (server-side)...')
      
      try {
        const blockchainResponse = await fetch('/api/blockchain/submit-driver-application', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            applicationHash,
            ipfsHash,
            userAddress: user.address,
          }),
        })

        if (!blockchainResponse.ok) {
          const errorData = await blockchainResponse.json().catch(() => ({}))
          console.error('⚠️ [HOME] Blockchain submission failed:', errorData)
          // Database save succeeded, so don't fail completely
          setSubmissionError(
            'Application saved to database, but blockchain verification failed. You can retry verification later.'
          )
          // Still mark as completed since data is saved
          setIsDriverApplicationCompleted(true)
          setShowEmploymentVerification(false)
          setShowDashboard(false)
          setIsSubmitting(false)
          return
        }

        const blockchainData = await blockchainResponse.json()
        console.log('✅ [HOME] Blockchain verification successful:', blockchainData)

        const txData = {
          transactionHash: blockchainData.transactionHash,
          blockNumber: blockchainData.blockNumber,
          applicationId: blockchainData.applicationId,
        }

        setBlockchainData(txData)

        // 3. UPDATE DATABASE WITH BLOCKCHAIN TRANSACTION DETAILS
        console.log('💾 [HOME] Updating database with blockchain verification details...')
        const updateResponse = await fetch('/api/blockchain/persist-driver-application', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userAddress: user.address,
            applicationHash,
            ipfsHash,
            transactionHash: txData.transactionHash,
            applicationId: txData.applicationId,
            blockNumber: txData.blockNumber,
          }),
        })

        if (updateResponse.ok) {
          console.log('✅ [HOME] Database updated with blockchain verification details')
        } else {
          console.warn('⚠️ [HOME] Failed to update database with blockchain details (non-critical)')
        }

      } catch (blockchainError) {
        console.error('⚠️ [HOME] Blockchain verification error:', blockchainError)
        // Database save succeeded, so we can continue
        setSubmissionError(
          'Application saved successfully. Blockchain verification will be retried automatically.'
        )
      }

      // Mark as completed and show the submission confirmation screen
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

  // Handler for form navigation
  const handleFormNavigation = useCallback((formNumber: number) => {
    setCurrentForm(formNumber)
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
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
      return (
        <EmploymentVerificationForm
          userAddress={user?.address}
          onComplete={() => {
            setShowEmploymentVerification(false)
            setShowDashboard(true)
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
          />
        )
      case 2:
        return (
          <PersonalInfoForm2
            key={`form2-${formResetKey}`}
            onNavigateToForm={handleFormNavigation}
            onDataChange={setForm2Data}
            initialData={form2Data}
          />
        )
      case 3:
        return (
          <PersonalInfoForm3
            key={`form3-${formResetKey}`}
            onComplete={handleDriverApplicationCompleted}
            onDataChange={setForm3Data}
            initialData={form3Data}
          />
        )
      default:
        return (
          <PersonalInfoForm1
            key={`form1-${formResetKey}`}
            onNavigateToForm={handleFormNavigation}
            onDataChange={setForm1Data}
            initialData={form1Data}
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
    <AssistantBridgeProvider
      journey={journeyState}
      requestHelp={handleHelpRequest}
      primerSeen={primerSeen}
      setPrimerSeen={handleSetPrimerSeen}
      notifyResumeUploadEvent={handleResumeUploadEvent}
    >
      <div className='min-h-screen overflow-x-hidden relative'>
        {/* Animated Background */}
        <AnimatedBackground />

        {/* Wallet Info - Top Left Corner (Desktop Only) */}
        {user?.address && (
          <div className='fixed top-4 left-4 z-[60] pointer-events-none'>
            <div className='pointer-events-auto'>
              <WalletInfo 
                walletAddress={user.address} 
                onClick={openModal}
              />
            </div>
          </div>
        )}

        {/* Admin Quick Reset Button (Development Only) */}
        {user && process.env.NODE_ENV === 'development' && (
          <div className='fixed top-4 right-4 z-50'>
            <button
              onClick={() => {
                console.log('🧹 [DEV] Quick reset triggered for:', user.address)
                resetApplicationProgress()
              }}
              className='px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg shadow-lg text-sm font-semibold'
              title='Development: Clear form data'
            >
              🧹 Clear Forms (Dev)
            </button>
          </div>
        )}

        {/* Navigation with status indicator */}
        <Navigation
          isAuthenticated={!!user}
          user={user}
          userRole={userRole}
          onStatusClick={openModal}
          onWalletClick={handleWalletClick}
          onNavigate={handleNavigation}
          onMvrClick={() => handleNavigation('mvr')}
          tHasUnread={avaHasUnread}
          onTClick={() => setIsAvaCollapsed(false)}
          onSwitchRole={handleSwitchRole}
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
          onSwitchRole={handleSwitchRole}
        />

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
              mode="sidebar"
              isCollapsed={isAvaCollapsed}
              onToggleCollapse={() => setIsAvaCollapsed(!isAvaCollapsed)}
              onUnreadChange={setAvaHasUnread}
              onLoadingChange={(isLoading, message) => {
                setAvaIsWorking(isLoading)
                if (message) setAvaWorkingMessage(message)
              }}
            />
            
            {/* AvA Loading Modal - shown when AvA is working */}
            <TLoadingModal isVisible={avaIsWorking} message={avaWorkingMessage} />
          </>
        )}

        {/* Main Content - Adjusted for sidebar (desktop only) */}
        <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 mt-8 relative z-0 transition-all duration-300 ${
          user && !isAvaCollapsed ? 'md:pr-[420px]' : ''
        }`}>
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

          {/* Role Selection Modal - Show when user needs to select a role */}
          {/* Show modal if: user is logged in, not loading, not setting role, and either showRoleSelection is true OR userRole is null/undefined */}
          {user && !isRoleLoading && !isSettingRole && (showRoleSelection || userRole === null) && (
            <RoleSelectionModal 
              onSelectRole={handleRoleSelection}
              isLoading={isSettingRole}
            />
          )}

          {/* Employer Dashboard - Show if user is an employer and on home page */}
          {user && userRole === 'employer' && !isRoleLoading && !currentPage && (
            <EmployerDashboard companyName={companyName || undefined} />
          )}

          {/* Driver Content - Show if user is a driver or has not selected role yet */}
          {(!user || userRole === 'driver' || (user && !userRole && !showRoleSelection)) && !isRoleLoading && (
            <>
              {/* Conditional Content Based on Navigation */}
              {/* Home Page - Default */}
              {!currentPage && (
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
              )}

          {currentPage === 'signin' && !user && (
            <div className='max-w-md mx-auto overflow-hidden'>
              <AlchemyAuth
                onAuthSuccess={handleAuthSuccess}
                onLogoutSuccess={() => setUser(null)}
              />
            </div>
          )}

          {currentPage === 'resume' && (
            <div className='max-w-4xl mx-auto space-y-6'>
              <ResumeUploadWithVerification
                user={user}
                onUploadComplete={(payload) => {
                  setHasResume(true)
                  // Store the IPFS hash for later prefill use
                  if (payload?.finalResult?.ipfsHash) {
                    setLatestResumeIpfsHash(payload.finalResult.ipfsHash)
                  }
                  // Note: analysis_ready event is now triggered by ResumeUploadWithVerification itself
                  // after blockchain verification completes, so we don't need to trigger it here
                }}
              />
              <ResumeDashboard
                user={user}
                onResumesLoaded={(count, latestResume) => {
                  setHasResume(count > 0)
                  // Store the latest resume's IPFS hash for prefill
                  if (latestResume?.ipfs_hash) {
                    setLatestResumeIpfsHash(latestResume.ipfs_hash)
                    
                    // If forms are empty and we have a resume, trigger analysis to prefill
                    // DISABLED: Auto-trigger removed for better UX - users should manually request prefill via T Assistant
                    // Automatic prefill was pushy and unexpected. Manual trigger (via DOT form conversation) gives users control.
                    // 
                    // if (
                    //   !form1Data &&
                    //   !form2Data &&
                    //   !form3Data &&
                    //   latestResume.ipfs_hash &&
                    //   analysisTriggeredRef.current !== latestResume.ipfs_hash && // Only trigger once per resume
                    //   !analysisPendingRef.current // Prevent simultaneous triggers
                    // ) {
                    //   console.log('📋 [HOME] Existing resume detected, triggering analysis for prefill...')
                    //   analysisPendingRef.current = true // Set flag immediately to prevent race
                    //   analysisTriggeredRef.current = latestResume.ipfs_hash
                    //   handleResumeUploadEvent({
                    //     type: 'analysis_ready',
                    //     step: 'existing_resume',
                    //     data: {
                    //       ipfsHash: latestResume.ipfs_hash,
                    //       resumeId: latestResume.id,
                    //     },
                    //     message: '🔍 I found your uploaded resume! Analyzing it to prefill your forms...',
                    //   })
                    //   // Reset pending flag after a delay (analysis will complete)
                    //   setTimeout(() => {
                    //     analysisPendingRef.current = false
                    //   }, 2000)
                    // }
                  }
                }}
              />
              {user && <WalletTransactions />}
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
                        ✨ Forms prefilled with AI! Review and complete any
                        missing fields.
                      </span>
                      <button
                        onClick={() => setShowPrefillUpload(true)}
                        className={`text-xs underline ml-4 ${
                          theme === 'dark' ? 'text-green-400' : 'text-green-600'
                        }`}
                      >
                        Upload different resume
                      </button>
                    </div>
                  )}

                  {/* Prefill option banner - show if user hasn't prefilled yet and has a resume */}
                  {!hasPrefilled && hasResume && !isDriverApplicationCompleted && (
                    <div
                      className={`max-w-4xl mx-auto mb-6 px-4 py-3 rounded-lg border flex items-center justify-between ${
                        theme === 'dark'
                          ? 'bg-brand-mint/10 border-brand-mint/30 text-brand-cream'
                          : 'bg-brand-sage/10 border-brand-sage/30 text-gray-800'
                      }`}
                    >
                      <span>
                        📄 Want to save time? You can prefill forms from your uploaded resume.
                      </span>
                      <button
                        onClick={() => {
                          console.log('🔄 [HOME] User requested prefill from forms')
                          // Trigger analysis for the existing resume
                          if (latestResumeIpfsHash) {
                            analysisPendingRef.current = true
                            analysisTriggeredRef.current = latestResumeIpfsHash
                            handleResumeUploadEvent({
                              type: 'analysis_ready',
                              step: 'manual_prefill_request',
                              data: {
                                ipfsHash: latestResumeIpfsHash,
                              },
                              message: '🔍 Analyzing your resume to prefill forms...',
                            })
                            setTimeout(() => {
                              analysisPendingRef.current = false
                            }, 2000)
                          } else {
                            // No resume hash available, go back to upload
                            setShowPrefillUpload(true)
                          }
                        }}
                        className={`px-4 py-2 text-sm font-semibold rounded-xl border transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 whitespace-nowrap ml-4 ${
                          theme === 'dark'
                            ? 'text-brand-cream bg-brand-sage-light/20 hover:bg-brand-sage-light/30 border-brand-cream/30 hover:border-brand-cream/50'
                            : 'text-white bg-brand-sage hover:bg-brand-sage-dark border-brand-sage'
                        }`}
                      >
                        Prefill from Resume
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
