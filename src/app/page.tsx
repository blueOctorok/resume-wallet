'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import Navigation from '@/components/Navigation'
import AnimatedBackground from '@/components/AnimatedBackground'
import UserStatusModal from '@/components/UserStatusModal'
import WalletCard from '@/components/WalletCard'
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

const ResumeUploadWithPrefill = dynamic(
  () => import('@/components/ResumeUploadWithPrefill'),
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

const ResumeDashboard = dynamic(
  () => import('@/components/ResumeDashboard').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className='bg-brand-sage-light/10 backdrop-blur-sm border border-brand-mint/20 rounded-2xl p-8 shadow-xl'>
        <div className='space-y-4 animate-pulse'>
          <div className='h-6 bg-brand-sage-light/20 rounded w-48' />
          <div className='h-24 bg-brand-sage-light/20 rounded w-full' />
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

const TAssistant = dynamic(
  () => import('@/components/TAssistant').then((mod) => mod.default),
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
  const [formResetKey, setFormResetKey] = useState(0)

  // Track if user has used AI prefill
  const [hasPrefilled, setHasPrefilled] = useState(false)
  const [showPrefillUpload, setShowPrefillUpload] = useState(true)
  const [journeyState, setJourneyState] = useState<DriverJourneyState>(() =>
    createInitialJourneyState()
  )
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
    // Clear the event after a short delay to allow re-triggering of different events
    setTimeout(() => {
      setResumeUploadEvent(null)
    }, 100)
  }, [])

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
    (action: string) => {
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
          // If we have an existing resume IPFS hash, automatically trigger prefill
          if (latestResumeIpfsHash) {
            // Automatically trigger prefill with existing resume
            handleResumeUploadEvent({
              type: 'analysis_ready',
              step: 'prefill',
              message: 'Perfect! I\'m using your uploaded resume to prefill your DOT application forms. This will take about 20-30 seconds...',
            })
            // Navigate to forms page
            setCurrentPage('dotapp')
            setShowPrefillUpload(false) // Don't show upload component, we're using existing resume
            setShowEmploymentVerification(false)
            setShowDashboard(false)
            // Automatically trigger prefill API call
            setTimeout(async () => {
              try {
                const prefillResponse = await fetch('/api/ai/prefill-resume', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    cid: latestResumeIpfsHash,
                  }),
                })
                
                if (prefillResponse.ok) {
                  const prefillData = await prefillResponse.json()
                  handlePrefillSuccess(prefillData)
                } else {
                  const errorData = await prefillResponse.json().catch(() => ({ error: 'Unknown error' }))
                  handlePrefillError(errorData.error || 'Failed to prefill forms')
                }
              } catch (error) {
                console.error('❌ Auto-prefill error:', error)
                handlePrefillError(error instanceof Error ? error.message : 'Failed to prefill forms')
              }
            }, 500)
          } else {
            // No existing resume, show upload component
            setCurrentPage('dotapp')
            setShowPrefillUpload(true)
            setShowEmploymentVerification(false)
            setShowDashboard(false)
            // Trigger a follow-up message from T after a brief delay to ensure navigation completes
            setTimeout(() => {
              handleResumeUploadEvent({
                type: 'analysis_ready',
                step: 'prefill',
                message: 'Perfect! I\'ll help you prefill your DOT application. You can upload your resume in the form below, and I\'ll extract key information like your name, license details, and work history to automatically fill out the DOT forms. This will save you a lot of time!',
              })
            }, 300)
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

  // Handler for AI prefill success
  const handlePrefillSuccess = useCallback(
    (prefillData: {
      form1Data: any
      form2Data: any
      form3Data: any
      stats: any
    }) => {
      console.log('✅ [HOME] Prefill successful, populating forms')
      console.log(
        `   Fields extracted: ${prefillData.stats.extracted}/${prefillData.stats.total}`
      )

      // Populate form data
      setForm1Data(prefillData.form1Data)
      setForm2Data(prefillData.form2Data)
      setForm3Data(prefillData.form3Data)

      // Mark as prefilled and hide upload component
      setHasPrefilled(true)
      setShowPrefillUpload(false)
      setHasResume(true)

      // Reset submission error if any
      setSubmissionError(null)

      // Start on Form 1
      setCurrentForm(1)
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

      // Preflight with server (DB + on-chain hash)
      console.log('📝 [HOME] Preflight via API')
      const preflightRes = await fetch(
        '/api/blockchain/preflight-driver-application',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ applicationHash, userAddress: user.address }),
        }
      )
      const preflightJson = await preflightRes.json().catch(() => ({}))
      if (!preflightRes.ok || preflightJson?.error) {
        setSubmissionError(
          preflightJson?.details || preflightJson?.error || 'Preflight failed'
        )
        setIsSubmitting(false)
        return
      }

      // Submit to chain from user's Base smart wallet using Alchemy Account Kit
      console.log(
        '📝 [HOME] Submitting transaction from user smart wallet via Alchemy SDK'
      )

      if (!client) {
        setSubmissionError(
          'Wallet client not ready. Please log in with your Alchemy Smart Wallet.'
        )
        setIsSubmitting(false)
        return
      }

      const contractAddress = process.env
        .NEXT_PUBLIC_DRIVER_APP_CONTRACT_ADDRESS as string
      const { abi } = await import(
        '../../artifacts/contracts/ProductionDriverRegistry.sol/ProductionDriverRegistry.json'
      )
      const { encodeFunctionData } = await import('viem')

      // Encode the contract call
      const callData = encodeFunctionData({
        abi: abi as any,
        functionName: 'submitApplication',
        args: [applicationHash],
      })

      console.log(
        '🔍 [HOME] Sending user operation to contract:',
        contractAddress
      )
      console.log('🔍 [HOME] Client available:', !!client)
      console.log(
        '🔍 [HOME] sendUserOperationAsync available:',
        !!sendUserOperationAsync
      )

      if (!sendUserOperationAsync) {
        throw new Error(
          'sendUserOperationAsync function not available. Ensure you are logged in with Alchemy Smart Wallet.'
        )
      }

      // Send user operation via Alchemy SDK
      const result = await sendUserOperationAsync({
        uo: {
          target: contractAddress as `0x${string}`,
          data: callData as `0x${string}`,
          value: 0n,
        },
      })

      console.log('📦 [HOME] User operation result:', result)

      if (!result) {
        throw new Error('Failed to send user operation - no result returned')
      }

      // The result should be a user operation hash
      const userOpHash = typeof result === 'string' ? result : result.hash

      if (!userOpHash) {
        console.error(
          '❌ [HOME] Invalid result from sendUserOperation:',
          result
        )
        throw new Error('Failed to get user operation hash from result')
      }

      console.log(
        '⏳ [HOME] Waiting for transaction receipt for userOp:',
        userOpHash
      )

      // Wait for the transaction to be mined
      const txHash = await client.waitForUserOperationTransaction({
        hash: userOpHash as `0x${string}`,
      })

      console.log('✅ [HOME] Transaction confirmed:', txHash)

      // Get transaction receipt to parse events
      const { createPublicClient, http } = await import('viem')
      const { baseSepolia } = await import('viem/chains')
      const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(
          `https://base-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`
        ),
      })

      const receipt = await publicClient.getTransactionReceipt({ hash: txHash })

      // Parse ApplicationSubmitted event
      let applicationId: number | null = null
      try {
        const { decodeEventLog } = await import('viem')
        const submittedEvent = receipt.logs.find((log: any) => {
          try {
            const decoded = decodeEventLog({
              abi: abi as any,
              data: log.data,
              topics: log.topics,
            })
            return decoded.eventName === 'ApplicationSubmitted'
          } catch {
            return false
          }
        })

        if (submittedEvent) {
          const decoded = decodeEventLog({
            abi: abi as any,
            data: submittedEvent.data,
            topics: submittedEvent.topics,
          })
          applicationId = Number(
            (decoded.args as any).applicationId || (decoded.args as any)[0]
          )
        }
      } catch (e) {
        console.warn('⚠️ [HOME] Could not parse application ID from event:', e)
      }

      const txData = {
        transactionHash: receipt.transactionHash,
        blockNumber: Number(receipt.blockNumber),
        applicationId,
      }

      setBlockchainData(txData)

      // Save to database with application hash and blockchain data
      console.log('💾 [HOME] Saving application to database...')
      const { completeDriverApplicationClient } = await import(
        '@/lib/supabase-client-db'
      )

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
          await fetch('/api/blockchain/persist-driver-application', {
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
          console.log('✅ [HOME] Database updated with blockchain data')
        }
      }

      // Mark as completed and show the submission confirmation screen
      // User will click button to proceed to Employment Verification
      setIsDriverApplicationCompleted(true)
      setShowEmploymentVerification(false)
      setShowDashboard(false)
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
          {/* T Assistant - Centerpiece */}
          <div className='mb-8'>
            <TAssistant
              currentStep={getCurrentStep()}
              onAction={handleTAssistantAction}
              userAddress={user?.address}
              hasResume={hasResume}
              hasForms={journeyState.forms.status !== 'pending'}
              form1Data={form1Data}
              form2Data={form2Data}
              form3Data={form3Data}
              journeyState={journeyState}
              helpRequest={helpRequest}
              primerRequest={primerRequest}
              resumeUploadEvent={resumeUploadEvent}
            />
          </div>

          {/* Conditional Content Based on Navigation */}
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
                  // Trigger completion event after upload completes
                  if (payload?.resume) {
                    handleResumeUploadEvent({
                      type: 'analysis_ready',
                      step: 'upload',
                      data: payload.resume,
                      message: '🎉 Your resume is uploaded and verified! I can help you prefill your DOT application forms with information from your resume. Would you like me to do that now?',
                    })
                  }
                }}
              />
              <ResumeDashboard
                user={user}
                onResumesLoaded={(count, latestResume) => {
                  setHasResume(count > 0)
                  // Store the latest resume's IPFS hash for prefill
                  if (latestResume?.ipfs_hash) {
                    setLatestResumeIpfsHash(latestResume.ipfs_hash)
                  }
                }}
              />
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

              {/* AI Prefill Upload - Show before forms or if manually shown */}
              {showPrefillUpload && !isDriverApplicationCompleted && (
                <div className='mb-8'>
                  <ResumeUploadWithPrefill
                    onPrefillSuccess={handlePrefillSuccess}
                    onPrefillError={handlePrefillError}
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

                  {renderFormNavigation()}
                  {renderFormContent()}
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
