'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Loader2, X } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import {
  routeEvent,
  checkMilestones,
  type AvaEvent,
  type UserContext,
  type UserRole,
} from '@/lib/ava-brain'
import type {
  AssistantHelpRequest,
  DriverJourneyState,
  PrimerPrompt,
  ResumeUploadEvent,
} from '@/types/assistant'
import type { ProfileCompletenessResult } from '@/lib/profile-completeness'

interface MessageAction {
  id: string
  label: string
  value: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  step?: string
  actions?: MessageAction[]
}

interface TAssistantProps {
  currentStep?:
    | 'welcome'
    | 'wallet'
    | 'resume'
    | 'forms'
    | 'submission'
    | 'complete'
  onAction?: (action: string, data?: any) => void
  userAddress?: string | null
  userRole?: 'driver' | 'developer' | 'employer' | null
  hasResume?: boolean
  hasForms?: boolean
  form1Data?: any
  form2Data?: any
  form3Data?: any
  journeyState?: DriverJourneyState
  helpRequest?: AssistantHelpRequest | null
  primerRequest?: PrimerPrompt | null
  resumeUploadEvent?: ResumeUploadEvent | null
  profileCompleteness?: ProfileCompletenessResult | null
  isCollapsed?: boolean
  onToggleCollapse?: () => void
  onUnreadChange?: (hasUnread: boolean) => void
  onLoadingChange?: (isLoading: boolean, message?: string) => void
  mode?: 'sidebar' | 'center'
}

// Wrapper component that safely handles SSR
function TAssistantContent({
  currentStep = 'welcome',
  onAction,
  userAddress,
  userRole,
  hasResume,
  hasForms,
  form1Data,
  form2Data,
  form3Data,
  journeyState,
  helpRequest,
  primerRequest,
  resumeUploadEvent,
  profileCompleteness,
  isCollapsed = false,
  onToggleCollapse,
  onUnreadChange,
  onLoadingChange,
  mode = 'center',
}: TAssistantProps) {
  const { theme } = useTheme()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isProcessingHelp, setIsProcessingHelp] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisPreview, setAnalysisPreview] = useState<any>(null)
  const [sessionId, setSessionId] = useState<string>(`user-${Date.now()}`)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [mounted, setMounted] = useState(false)
  const prevJourneyRef = useRef<DriverJourneyState | null>(null)
  const helpRequestHandledRef = useRef<string | null>(null)
  const primerRequestHandledRef = useRef<string | null>(null)
  const resumeUploadEventHandledRef = useRef<string | null>(null)
  const messageCounterRef = useRef(0)
  const lastReadMessageIdRef = useRef<string | null>(null)
  const [hasUnread, setHasUnread] = useState(false)

  // Ava Brain context - tracks user state for smart routing
  const avaBrainContextRef = useRef<UserContext>({
    currentPage: null,
    currentForm: 1,
    hasResume: hasResume ?? false,
    formsCompleted: [],
    profileCompleteness: profileCompleteness?.score ?? 0,
    sessionStart: Date.now(),
    lastActivity: Date.now(),
    eventsThisSession: [],
    helpTopicsShown: new Set(),
    timeOnCurrentPage: 0,
    fieldsFilledThisForm: 0,
    errorsEncountered: 0,
  })
  const prevStepRef = useRef<string | null>(null)

  const nextMessageId = useCallback((prefix: string) => {
    messageCounterRef.current += 1
    return `${prefix}-${Date.now()}-${messageCounterRef.current}`
  }, [])

  const addAssistantMessage = useCallback(
    (
      content: string,
      options?: { actions?: MessageAction[]; step?: string }
    ) => {
      const newMessage = {
        id: nextMessageId('assistant'),
        role: 'assistant' as const,
        content,
        timestamp: new Date(),
        step: options?.step,
        actions: options?.actions,
      }
      setMessages((prev) => [...prev, newMessage])

      // Mark as unread if collapsed
      if (isCollapsed) {
        setHasUnread(true)
        onUnreadChange?.(true)
      }
    },
    [nextMessageId, isCollapsed, onUnreadChange]
  )

  // Track unread messages
  useEffect(() => {
    if (!isCollapsed && hasUnread) {
      // Mark all messages as read when expanded
      const lastMessage = messages[messages.length - 1]
      if (lastMessage) {
        lastReadMessageIdRef.current = lastMessage.id
        setHasUnread(false)
        onUnreadChange?.(false)
      }
    }
  }, [isCollapsed, hasUnread, messages, onUnreadChange])

  // Notify parent of loading state changes with detailed messages
  useEffect(() => {
    const isWorking = isLoading || isProcessingHelp || isAnalyzing
    let message = 'AvA is thinking...'

    if (isAnalyzing) {
      message = 'Analyzing your resume...'
    } else if (isProcessingHelp) {
      message = 'Finding the best answer for you...'
    } else if (isLoading) {
      message = 'AvA is thinking...'
    }

    onLoadingChange?.(isWorking, message)
  }, [isLoading, isProcessingHelp, isAnalyzing, onLoadingChange])

  // Prevent body scroll on mobile when AvA Assistant is open
  useEffect(() => {
    if (mode === 'sidebar' && !isCollapsed) {
      // Only prevent scroll on mobile (< md breakpoint)
      const isMobile = window.innerWidth < 768
      if (isMobile) {
        document.body.style.overflow = 'hidden'
        return () => {
          document.body.style.overflow = ''
        }
      }
    }
  }, [mode, isCollapsed])

  // Proactive form guidance DISABLED - wastes AI credits at scale
  // Users can ask AvA for help when they need it via "Ask AvA" buttons

  const buildApplicationSnapshot = useCallback(() => {
    const stringify = (value: unknown) => {
      try {
        const serialized = JSON.stringify(value, null, 2)
        if (!serialized || serialized === 'null') return 'Not provided'
        return serialized
      } catch {
        return 'Not provided'
      }
    }

    return [
      form1Data
        ? `Form 1 (Personal Info): ${stringify(form1Data)}`
        : 'Form 1: Not started',
      form2Data
        ? `Form 2 (Driving & Records): ${stringify(form2Data)}`
        : 'Form 2: Not started',
      form3Data
        ? `Form 3 (Employment & Signature): ${stringify(form3Data)}`
        : 'Form 3: Not started',
    ].join('\n')
  }, [form1Data, form2Data, form3Data])

  // Only access after mount (client-side only)
  useEffect(() => {
    setMounted(true)
  }, [])

  // Generate session ID based on user address if available
  useEffect(() => {
    if (!mounted) return

    if (userAddress) {
      setSessionId(`user-${userAddress.toLowerCase()}`)
    } else {
      // Try to get from localStorage
      try {
        const storedAddress = localStorage.getItem('alchemy-account-address')
        if (storedAddress) {
          setSessionId(`user-${storedAddress.toLowerCase()}`)
        }
      } catch {
        // localStorage not available
      }
    }
  }, [mounted, userAddress])

  // =====================================================
  // AVA BRAIN: Page/Step Change Tracking (simplified - no proactive AI calls)
  // =====================================================
  useEffect(() => {
    if (!mounted) return

    if (currentStep !== prevStepRef.current) {
      // Update context for tracking (no AI calls)
      avaBrainContextRef.current = {
        ...avaBrainContextRef.current,
        currentPage: currentStep,
        lastActivity: Date.now(),
        timeOnCurrentPage: 0,
        helpTopicsShown: new Set(),
      }

      console.log(
        '📍 [AVA] Page changed:',
        prevStepRef.current,
        '→',
        currentStep
      )
      prevStepRef.current = currentStep
    }
  }, [currentStep, mounted])

  // Inactivity detection DISABLED - wastes AI credits at scale
  // Users can ask AvA for help when they need it via "Ask AvA" buttons

  // =====================================================
  // AVA BRAIN: Update Context on Props Change
  // =====================================================
  useEffect(() => {
    if (!mounted) return

    const prevContext = { ...avaBrainContextRef.current }

    // Sync external state to Ava Brain context
    avaBrainContextRef.current = {
      ...avaBrainContextRef.current,
      hasResume: hasResume ?? false,
      profileCompleteness: profileCompleteness?.score ?? 0,
    }

    // Check for milestones (first resume, profile completeness)
    const milestoneEvent = checkMilestones(
      prevContext,
      avaBrainContextRef.current
    )
    if (milestoneEvent) {
      // Pass userRole for role-aware milestone messages
      const roleForBrain: UserRole =
        userRole === 'driver' || userRole === 'developer' ? userRole : null
      const response = routeEvent(
        milestoneEvent,
        avaBrainContextRef.current,
        undefined,
        roleForBrain
      )
      if ('message' in response && response.message) {
        console.log('🏆 [AVA BRAIN] State milestone:', milestoneEvent.action)
        addAssistantMessage(response.message, {
          actions: response.actions,
          step: response.metadata?.step,
        })
      }
    }
  }, [mounted, hasResume, profileCompleteness, addAssistantMessage, userRole])

  // Reset activity timer on user input
  const resetActivityTimer = useCallback(() => {
    avaBrainContextRef.current.lastActivity = Date.now()
  }, [])

  // Initialize with welcome message based on current step
  useEffect(() => {
    if (!mounted || messages.length > 0) return

    const welcomeMessages: Record<string, string> = {
      welcome:
        "👋 Hi! I'm AvA, your AI assistant. I'm here to guide you through the entire driver employment process.\n\nLet's get started! First, you'll need to:\n\n1️⃣ **Log in** to create your secure wallet\n2️⃣ **Upload your resume** (I can help prefill your application!)\n3️⃣ **Complete your driver application** (I'll guide you through each form)\n4️⃣ **Submit and verify** your application\n\nReady to begin? Click 'Sign In' to get started!",
      wallet:
        "✅ Great! You're logged in. Now let's move to the next step.\n\n2️⃣ **Upload your resume** - I can automatically extract information from your resume to prefill your application forms, saving you time!\n\nClick 'Upload Resume' when you're ready.",
      resume:
        "✅ Excellent! Your resume is uploaded. I've extracted your information and prefilled your application forms.\n\n3️⃣ **Complete your driver application** - I'll guide you through each form step by step. Let's start with Form 1: Personal Information.\n\nClick 'Start Application' to begin!",
      forms:
        "✅ You're making great progress! Continue filling out your driver application forms.\n\nI'm here to help if you have any questions about:\n• DOT compliance requirements\n• Form field explanations\n• What information is needed\n\nJust ask me anything!",
      submission:
        "🎉 Congratulations! Your application has been submitted to the blockchain.\n\n4️⃣ **Next steps:**\n• Complete employment verification\n• Wait for DOT review\n• Check your dashboard for updates\n\nI'll be here if you need help with anything else!",
      complete:
        "🎊 Amazing! You've completed the entire process!\n\nYour driver application is now:\n✅ Submitted to blockchain\n✅ Verified and secure\n✅ Ready for employer review\n\nIs there anything else I can help you with?",
    }

    const welcomeActions: Record<string, MessageAction[] | undefined> = {
      welcome: [{ id: 'welcome-signin', label: 'Sign In', value: 'signin' }],
      wallet: [
        { id: 'wallet-resume', label: 'Upload resume', value: 'resume' },
        { id: 'wallet-forms', label: 'Start application', value: 'forms' },
        {
          id: 'wallet-primer',
          label: 'Why blockchain?',
          value: 'primer:learn_more',
        },
      ],
      resume: [
        { id: 'resume-forms', label: 'Continue to forms', value: 'forms' },
      ],
      forms: [
        { id: 'forms-progress', label: 'Open DOT forms', value: 'forms' },
      ],
      submission: [
        {
          id: 'submission-dashboard',
          label: 'View dashboard',
          value: 'dashboard',
        },
      ],
      complete: [
        {
          id: 'complete-dashboard',
          label: 'Open dashboard',
          value: 'dashboard',
        },
      ],
    }

    const welcomeMessage: Message = {
      id: nextMessageId('assistant'),
      role: 'assistant',
      content: welcomeMessages[currentStep] || welcomeMessages.welcome,
      timestamp: new Date(),
      step: currentStep,
      actions: welcomeActions[currentStep],
    }

    setMessages([welcomeMessage])
  }, [mounted, currentStep, messages.length, nextMessageId])

  useEffect(() => {
    if (!mounted || !journeyState) return
    if (!prevJourneyRef.current) {
      prevJourneyRef.current = journeyState
      return
    }

    const previous = prevJourneyRef.current

    // =====================================================
    // AVA BRAIN: Update context from journey state
    // =====================================================
    // Track current form
    if (journeyState.currentFormStep) {
      avaBrainContextRef.current.currentForm = journeyState.currentFormStep
    }

    // Track completed forms (1, 2, 3 based on journey state)
    const completedForms: number[] = []
    if (journeyState.forms.status === 'complete') {
      completedForms.push(1, 2, 3) // All forms complete
    }
    avaBrainContextRef.current.formsCompleted = completedForms
    // =====================================================

    const walletChanged =
      journeyState.wallet.status === 'complete' &&
      previous.wallet.status !== 'complete'
    if (walletChanged) {
      addAssistantMessage(
        '✅ Your Base smart wallet is active. Next up, upload your resume so I can prefill the DOT forms or jump straight into the application.',
        {
          step: 'wallet',
          actions: [
            {
              id: 'journey-wallet-resume',
              label: 'Upload resume',
              value: 'resume',
            },
            {
              id: 'journey-wallet-forms',
              label: 'Start application',
              value: 'forms',
            },
            {
              id: 'journey-wallet-primer',
              label: 'Why blockchain?',
              value: 'primer:learn_more',
            },
          ],
        }
      )
    }

    const resumeChanged =
      journeyState.resume.status === 'complete' &&
      previous.resume.status !== 'complete'
    if (resumeChanged) {
      // Update Ava Brain context
      avaBrainContextRef.current.hasResume = true
      console.log('📄 [AVA BRAIN] Resume status changed to complete')

      addAssistantMessage(
        '📄 Got it—your resume is on file. I can now prefill the DOT application to save you time.',
        {
          step: 'resume',
          actions: [
            {
              id: 'journey-resume-forms',
              label: 'Continue to forms',
              value: 'forms',
            },
          ],
        }
      )
    }

    const formsStarted =
      journeyState.forms.status === 'in_progress' &&
      previous.forms.status === 'pending'
    if (formsStarted) {
      const formLabel = journeyState.currentFormStep
        ? `Form ${journeyState.currentFormStep}`
        : 'the DOT application'
      addAssistantMessage(
        `📝 I'm tracking your DOT application. You're currently working on ${formLabel}. Ask me about any section if you get stuck.`,
        { step: 'forms' }
      )
    }

    const formsCompleted =
      journeyState.forms.status === 'complete' &&
      previous.forms.status !== 'complete'
    if (formsCompleted) {
      addAssistantMessage(
        '✅ Application details captured. When you’re ready, we can submit everything to Base.',
        { step: 'forms' }
      )
    }

    const submissionStarted =
      journeyState.submission.status === 'in_progress' &&
      previous.submission.status !== 'in_progress'
    if (submissionStarted) {
      addAssistantMessage(
        '🚚 Your application is heading to the blockchain now. Keep this tab open—I’ll confirm once it’s sealed.',
        { step: 'submission' }
      )
    }

    const submissionCompleted =
      journeyState.submission.status === 'complete' &&
      previous.submission.status !== 'complete'
    if (submissionCompleted) {
      addAssistantMessage(
        '🎉 Application submitted! You can view your timeline and next steps from the dashboard whenever you like.',
        {
          step: 'complete',
          actions: [
            {
              id: 'journey-dashboard',
              label: 'Open dashboard',
              value: 'dashboard',
            },
          ],
        }
      )
    }

    prevJourneyRef.current = journeyState
  }, [journeyState, mounted, addAssistantMessage])

  useEffect(() => {
    if (!mounted || !primerRequest) return
    if (primerRequestHandledRef.current === primerRequest.id) return
    primerRequestHandledRef.current = primerRequest.id
    addAssistantMessage(primerRequest.message, {
      step: currentStep,
      actions: [
        {
          id: 'primer-learn',
          label: 'Tell me more',
          value: 'primer:learn_more',
        },
        { id: 'primer-skip', label: 'Skip for now', value: 'primer:skip' },
      ],
    })
  }, [primerRequest, mounted, addAssistantMessage, currentStep])

  // Handle resume upload events
  useEffect(() => {
    if (!mounted || !resumeUploadEvent) return

    // Create a unique key for this event to prevent duplicates
    // Use timestamp + type + step to ensure uniqueness while allowing same type/step combinations at different times
    const eventKey = `${resumeUploadEvent.type}-${resumeUploadEvent.step}-${Date.now()}`
    // Only prevent if it's the exact same event (same timestamp would be impossible, so this is just for safety)
    if (resumeUploadEventHandledRef.current === eventKey) return
    resumeUploadEventHandledRef.current = eventKey

    // Handle analysis_ready event - extract data and show preview
    if (resumeUploadEvent.type === 'analysis_ready' && resumeUploadEvent.data) {
      // Check if data is already extracted (from ResumeUploadWithPrefill)
      if (resumeUploadEvent.data.prefillData) {
        // Data already extracted, use it directly
        const data = resumeUploadEvent.data.prefillData
        setIsAnalyzing(false)
        setAnalysisPreview(data)

        // Build insights from extracted data
        const insights: string[] = []
        const stats = data.stats || { extracted: 0, total: 0 }

        if (data.form1Data) {
          if (data.form1Data.firstName || data.form1Data.lastName) {
            insights.push(
              `✓ Found name: ${data.form1Data.firstName || ''} ${data.form1Data.lastName || ''}`.trim()
            )
          }
          if (data.form1Data.email)
            insights.push(`✓ Found email: ${data.form1Data.email}`)
          if (data.form1Data.phone)
            insights.push(`✓ Found phone: ${data.form1Data.phone}`)
          if (data.form1Data.currentLicenses?.[0]?.licenseNumber) {
            const license = data.form1Data.currentLicenses[0]
            insights.push(
              `✓ Found license: ${license.licenseNumber} (${license.state || 'State'}) - ${license.typeClass || 'Class'}`
            )
          }
          if (data.form1Data.currentLicenses?.[0]?.endorsements) {
            insights.push(
              `✓ Found endorsements: ${data.form1Data.currentLicenses[0].endorsements}`
            )
          }
          if (
            data.form1Data.medicalQualification?.medicalCertificateExpiration
          ) {
            insights.push(
              `✓ Found medical cert expiration: ${data.form1Data.medicalQualification.medicalCertificateExpiration}`
            )
          }
        }

        if (
          data.form2Data?.workHistory &&
          data.form2Data.workHistory.length > 0
        ) {
          insights.push(
            `✓ Found ${data.form2Data.workHistory.length} employment record(s)`
          )
        }

        const insightsText =
          insights.length > 0
            ? `\n\n**Here's what I found:**\n${insights.join('\n')}\n\nI extracted ${stats.extracted} out of ${stats.total} fields. Would you like me to prefill your forms with this information?`
            : `\n\nI extracted ${stats.extracted} out of ${stats.total} fields. Would you like me to prefill your forms with this information?`

        // Automatically prefill after analysis - no confirmation needed
        // User already uploaded resume, so just prefill it
        console.log(
          '✅ [T ASSISTANT] Analysis complete, auto-prefilling forms...'
        )

        // Create detailed, transparent summary
        const fieldCount = stats.extracted || 0
        const successMessage =
          fieldCount > 0
            ? `🎉 Perfect! I found ${fieldCount} pieces of information from your resume.${insightsText}\n\n✨ **Filling out your forms now!**\n\n**What I filled:**\n• Form 1: Personal info, address, license basics\n• Form 3: Employment history (names, dates, roles)\n\n**What you'll need to add:**\n• Form 1: License details, years at address\n• Form 2: Driving experience, accident/traffic records (not on resumes)\n• Form 3: Employer contact info, reason for leaving\n\nI'll help guide you through the rest! 🚗`
            : `✅ I've reviewed your resume and filled in what I could. I'll guide you through the remaining fields!`

        addAssistantMessage(successMessage, {
          step: 'resume',
        })

        // Auto-prefill with the extracted data
        setTimeout(() => {
          onAction?.('resume:prefill:confirm', data)
        }, 500)
      } else if (resumeUploadEvent.data?.ipfsHash) {
        // Need to extract data via API (from ResumeUploadWithVerification)
        setIsAnalyzing(true)
        addAssistantMessage(
          "🔍 Reading your resume now...\n\nI'll automatically pull out your name, contact info, work history, licenses, and more. This usually takes 15-20 seconds.",
          {
            step: 'resume',
          }
        )

        // Call prefill API to extract data (but don't prefill yet)
        fetch('/api/ai/prefill-resume', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cid: resumeUploadEvent.data.ipfsHash }),
        })
          .then(async (res) => {
            if (!res.ok) {
              const error = await res.json()
              // Attach the full error object to the Error for detailed handling
              const err: any = new Error(error.error || 'Analysis failed')
              err.errorType = error.errorType
              err.userMessage = error.userMessage
              err.actionRequired = error.actionRequired
              err.detail = error.detail
              throw err
            }
            return res.json()
          })
          .then((data) => {
            setIsAnalyzing(false)
            setAnalysisPreview(data)
            console.log('✅ [T ASSISTANT] Analysis complete, data received:', {
              hasForm1Data: !!data.form1Data,
              hasForm2Data: !!data.form2Data,
              hasForm3Data: !!data.form3Data,
              form1DataKeys: data.form1Data ? Object.keys(data.form1Data) : [],
              stats: data.stats,
            })

            // Build insights from extracted data
            const insights: string[] = []
            const stats = data.stats || { extracted: 0, total: 0 }

            if (data.form1Data) {
              if (data.form1Data.firstName || data.form1Data.lastName) {
                insights.push(
                  `✓ Found name: ${data.form1Data.firstName || ''} ${data.form1Data.lastName || ''}`.trim()
                )
              }
              if (data.form1Data.email)
                insights.push(`✓ Found email: ${data.form1Data.email}`)
              if (data.form1Data.phone)
                insights.push(`✓ Found phone: ${data.form1Data.phone}`)
              if (data.form1Data.currentLicenses?.[0]?.licenseNumber) {
                const license = data.form1Data.currentLicenses[0]
                insights.push(
                  `✓ Found license: ${license.licenseNumber} (${license.state || 'State'}) - ${license.typeClass || 'Class'}`
                )
              }
              if (data.form1Data.currentLicenses?.[0]?.endorsements) {
                insights.push(
                  `✓ Found endorsements: ${data.form1Data.currentLicenses[0].endorsements}`
                )
              }
              if (
                data.form1Data.medicalQualification
                  ?.medicalCertificateExpiration
              ) {
                insights.push(
                  `✓ Found medical cert expiration: ${data.form1Data.medicalQualification.medicalCertificateExpiration}`
                )
              }
            }

            if (
              data.form2Data?.workHistory &&
              data.form2Data.workHistory.length > 0
            ) {
              insights.push(
                `✓ Found ${data.form2Data.workHistory.length} employment record(s)`
              )
            }

            const insightsText =
              insights.length > 0
                ? `\n\n**Here's what I found:**\n${insights.join('\n')}\n\nI extracted ${stats.extracted} out of ${stats.total} fields.`
                : `\n\nI extracted ${stats.extracted} out of ${stats.total} fields.`

            // Automatically prefill after analysis - no confirmation needed
            // User already uploaded resume, so just prefill it
            console.log(
              '✅ [T ASSISTANT] Analysis complete, auto-prefilling forms...'
            )

            // Create detailed, transparent summary
            const fieldCount = stats.extracted || 0
            const successMessage =
              fieldCount > 0
                ? `🎉 Great news! I found ${fieldCount} pieces of information from your resume.${insightsText}\n\n✨ **Filling out your forms now!**\n\n**What I filled:**\n• Form 1: Personal info, address, license basics\n• Form 3: Employment history (names, dates, roles)\n\n**What you'll need to add:**\n• Form 1: License details, years at address\n• Form 2: Driving experience, accident/traffic records (not on resumes)\n• Form 3: Employer contact info, reason for leaving\n\nI'll help guide you through the rest! 🚗`
                : `✅ I've reviewed your resume and filled in what I could. I'll guide you through the remaining fields!`

            addAssistantMessage(successMessage, {
              step: 'resume',
            })

            // Auto-prefill with the extracted data
            console.log(
              '📤 [T ASSISTANT] About to trigger prefill with data:',
              {
                hasForm1Data: !!data.form1Data,
                hasForm2Data: !!data.form2Data,
                hasForm3Data: !!data.form3Data,
                form1DataSample: data.form1Data
                  ? {
                      firstName: data.form1Data.firstName,
                      lastName: data.form1Data.lastName,
                      email: data.form1Data.email,
                    }
                  : null,
              }
            )
            setTimeout(() => {
              console.log('📤 [T ASSISTANT] Calling onAction with prefill data')
              console.log('   Action: resume:prefill:confirm')
              console.log('   Data being passed:', {
                hasForm1Data: !!data.form1Data,
                hasForm2Data: !!data.form2Data,
                hasForm3Data: !!data.form3Data,
                form1DataKeys: data.form1Data
                  ? Object.keys(data.form1Data)
                  : [],
                dataType: typeof data,
                dataKeys: Object.keys(data),
              })
              console.log('   Full data object:', data)
              onAction?.('resume:prefill:confirm', data)
              console.log('   ✅ onAction called')
            }, 500)
          })
          .catch((error) => {
            setIsAnalyzing(false)
            console.error('❌ Analysis error:', error)

            // Special handling for T Backend cache lock scenario
            if (error.errorType === 'T_BACKEND_CACHE_LOCK') {
              console.log(
                '🔒 [T ASSISTANT] Detected T Backend cache lock - providing user guidance'
              )
              addAssistantMessage(
                `⚠️ **Small hiccup!**\n\nI've seen this resume before but can't find my notes.\n\n**Quick fix (try first):**\n1. Refresh this page (F5)\n2. Upload again\n\n**If that doesn't work:**\n1. Open your resume\n2. Make a tiny edit (add a space, fix a typo)\n3. Save as new file\n4. Upload the new version\n\nOr just fill the forms manually - I'll still help!`,
                {
                  step: 'resume',
                  actions: [
                    {
                      id: 'resume-reupload',
                      label: 'I made changes',
                      value: 'resume:reupload',
                    },
                    {
                      id: 'resume-continue',
                      label: 'Fill manually',
                      value: 'forms',
                    },
                  ],
                }
              )
            } else {
              // Generic error handling - keep it simple and actionable
              const friendlyError =
                error.message.includes('504') ||
                error.message.includes('timeout')
                  ? 'The analysis is taking too long (server timeout).'
                  : error.message.includes('Failed to fetch')
                    ? "Couldn't connect to the analysis service."
                    : error.message

              addAssistantMessage(
                `⚠️ Couldn't analyze your resume: ${friendlyError}\n\n**No problem!** You can:\n• Fill out the forms manually (I'll help!)\n• Try uploading again\n• Upload a different resume`,
                {
                  step: 'resume',
                  actions: [
                    {
                      id: 'resume-continue',
                      label: 'Fill manually',
                      value: 'forms',
                    },
                    { id: 'resume-retry', label: 'Try again', value: 'resume' },
                    {
                      id: 'resume-help',
                      label: 'Get help',
                      value: 'resume:help',
                    },
                  ],
                }
              )
            }
          })
      }
      return
    }

    // Provide helpful, user-friendly messages for other events
    // Keep it simple - 99% of users don't care about blockchain details
    if (resumeUploadEvent.type === 'hash_start') {
      addAssistantMessage(
        '📋 Starting your upload... This will only take a moment!',
        { step: 'resume' }
      )
    } else if (resumeUploadEvent.type === 'hash_complete') {
      addAssistantMessage(
        '✅ Got it! Now uploading your resume to secure storage...',
        { step: 'resume' }
      )
    } else if (resumeUploadEvent.type === 'upload_start') {
      addAssistantMessage(
        '📤 Uploading your resume... (This usually takes 10-15 seconds)',
        { step: 'resume' }
      )
    } else if (resumeUploadEvent.type === 'upload_complete') {
      addAssistantMessage(
        '🎉 Resume uploaded successfully! Now making it official with verification...',
        { step: 'resume' }
      )
    } else if (resumeUploadEvent.type === 'blockchain_start') {
      addAssistantMessage(
        '⚡ Almost done! Just adding your verification stamp... (20-30 seconds)\n\nThis makes your resume tamper-proof and permanently verifiable.',
        { step: 'resume' }
      )
    } else if (resumeUploadEvent.type === 'blockchain_complete') {
      addAssistantMessage(
        "✅ Perfect! Your resume is verified and ready.\n\nI'll analyze it now to help fill out your application forms automatically. This saves you tons of time!",
        {
          step: 'resume',
          actions: [
            { id: 'resume-wait', label: 'Sounds good!', value: 'resume:wait' },
          ],
        }
      )
    } else if (resumeUploadEvent.type === 'upload_error') {
      // Show error with helpful guidance
      const errorMsg = resumeUploadEvent.error || 'Something went wrong'
      const isDuplicate =
        errorMsg.toLowerCase().includes('already') ||
        errorMsg.toLowerCase().includes('duplicate')

      if (isDuplicate) {
        addAssistantMessage(
          "📋 I see you've already uploaded this resume before.\n\nWant to use your existing resume, or upload a different one?",
          {
            step: 'resume',
            actions: [
              {
                id: 'resume-use-existing',
                label: 'Use existing',
                value: 'forms',
              },
              {
                id: 'resume-help',
                label: 'Upload different',
                value: 'resume:help',
              },
            ],
          }
        )
      } else {
        addAssistantMessage(
          `⚠️ Hmm, ran into an issue: "${errorMsg}"\n\nNo worries! Common fixes:\n• Check your internet connection\n• Make sure it's a PDF file\n• Try a smaller file size (under 10MB)\n\nNeed help troubleshooting?`,
          {
            step: 'resume',
            actions: [
              { id: 'resume-retry', label: 'Try again', value: 'resume' },
              { id: 'resume-help', label: 'Get help', value: 'resume:help' },
            ],
          }
        )
      }
    } else if (
      resumeUploadEvent.type === 'profile_conflict' &&
      resumeUploadEvent.data
    ) {
      // Profile conflict detected - explain to user and guide them
      const { conflicts, existing, incoming } = resumeUploadEvent.data

      const conflictList = conflicts.map((c: string) => `• ${c}`).join('\n')

      addAssistantMessage(
        `⚠️ **Profile Conflict Detected**\n\nI noticed this resume appears to be for a different person than your existing profile:\n\n${conflictList}\n\n**Your existing profile:**\n• Name: ${existing.name || 'Not set'}\n• CDL: ${existing.cdlNumber || 'Not set'}\n\n**This new resume:**\n• Name: ${incoming.name || 'Not set'}\n• CDL: ${incoming.cdlNumber || 'Not set'}\n\n**What should we do?**\n\nA modal will appear asking you to choose:\n• **Keep Existing** - Keep your current profile, discard this resume's data\n• **Replace** - Replace your profile with this new resume's data\n\n💡 **Tip:** If this is your resume but with updated info, choose "Replace". If you accidentally uploaded someone else's resume, choose "Keep Existing".`,
        {
          step: 'resume',
        }
      )
    } else if (resumeUploadEvent.message) {
      // Fallback for any other events with messages
      addAssistantMessage(resumeUploadEvent.message, {
        step: 'resume',
      })
    }
  }, [resumeUploadEvent, mounted, addAssistantMessage])

  // Handle profile completeness guidance
  const profileCompletenessHandledRef = useRef<number | null>(null)
  useEffect(() => {
    if (!mounted || !profileCompleteness) return
    if (!userAddress || userRole !== 'driver') return

    // Only show guidance once per score level to avoid spam
    if (profileCompletenessHandledRef.current === profileCompleteness.score)
      return
    profileCompletenessHandledRef.current = profileCompleteness.score

    // Provide contextual guidance based on profile status
    if (
      profileCompleteness.status === 'incomplete' &&
      profileCompleteness.score < 40
    ) {
      addAssistantMessage(
        `👋 Hey! I noticed your driver profile is only ${profileCompleteness.percentage} complete.\n\n` +
          `To apply for jobs on StormChain, you'll need to add some key information:\n\n` +
          `🔑 **Essential:**\n` +
          profileCompleteness.missingFields
            .slice(0, 3)
            .map((f) => `• ${f.label} (+${f.points} points)`)
            .join('\n') +
          `\n\n` +
          `Complete your DOT application to unlock job applications!`,
        {
          step: 'forms',
          actions: [
            { id: 'go-forms', label: 'Complete DOT App', value: 'forms' },
          ],
        }
      )
    } else if (
      profileCompleteness.status === 'basic' &&
      profileCompleteness.score >= 40 &&
      profileCompleteness.score < 70
    ) {
      addAssistantMessage(
        `🎯 Nice! Your profile is ${profileCompleteness.percentage} complete - you can now apply to jobs!\n\n` +
          `Want to stand out more? Here are quick wins:\n` +
          profileCompleteness.missingFields
            .slice(0, 3)
            .map((f) => `• Add ${f.label} (+${f.points} points)`)
            .join('\n') +
          `\n\n` +
          `More complete profiles get more employer views! 📈`,
        {
          step: 'profile',
        }
      )
    } else if (
      profileCompleteness.status === 'good' &&
      profileCompleteness.score >= 70 &&
      profileCompleteness.score < 90
    ) {
      addAssistantMessage(
        `✨ Great job! Your profile is ${profileCompleteness.percentage} complete.\n\n` +
          `You're almost there! Just a few more details to reach 100%:\n` +
          profileCompleteness.missingFields
            .slice(0, 2)
            .map((f) => `• ${f.label}`)
            .join('\n') +
          `\n\n` +
          `Employers love seeing complete profiles - it shows you're serious! 💼`,
        {
          step: 'profile',
        }
      )
    } else if (
      profileCompleteness.status === 'excellent' &&
      profileCompleteness.score >= 90
    ) {
      // Only congratulate on first time hitting excellent
      if (profileCompletenessHandledRef.current < 90) {
        addAssistantMessage(
          `🎉 Awesome! Your profile is ${profileCompleteness.percentage} complete!\n\n` +
            `You're all set to apply for trucking jobs. Your complete profile will make a great impression on employers.\n\n` +
            `Ready to find your next opportunity? Browse jobs and apply with one click! 🚚`,
          {
            step: 'profile',
            actions: [
              { id: 'browse-jobs', label: 'Browse Jobs', value: 'jobs' },
            ],
          }
        )
      }
    }
  }, [profileCompleteness, mounted, userAddress, userRole, addAssistantMessage])

  useEffect(() => {
    if (!mounted || !helpRequest) return
    if (helpRequestHandledRef.current === helpRequest.id) return
    helpRequestHandledRef.current = helpRequest.id

    const fetchHelp = async () => {
      setIsProcessingHelp(true)
      try {
        const snapshot =
          helpRequest.dataSnapshot !== undefined
            ? (() => {
                try {
                  const json = JSON.stringify(helpRequest.dataSnapshot, null, 2)
                  if (!json || json === 'null') return ''
                  return json.length > 2000
                    ? `${json.slice(0, 2000)}\n... (truncated)`
                    : json
                } catch {
                  return ''
                }
              })()
            : ''

        const applicationSnapshot = buildApplicationSnapshot()

        const helpPrompt = [
          `You are AvA, a friendly DOT compliance assistant helping drivers complete FMCSA-required application forms.`,
          `Current assistant step context: ${currentStep}`,
          userAddress
            ? `User wallet: ${userAddress} (Base smart wallet)`
            : 'User not logged in yet.',
          hasResume
            ? 'A resume has been uploaded and is available for reference.'
            : 'No resume data is available yet.',
          hasForms
            ? 'User has already started filling out DOT forms.'
            : 'User has not started the DOT forms yet.',
          helpRequest.context ? `User context: ${helpRequest.context}` : '',
          helpRequest.regulation
            ? `Relevant regulation to reference: ${helpRequest.regulation}`
            : '',
          snapshot ? `Section-specific data provided:\n${snapshot}` : '',
          `Current application snapshot:\n${applicationSnapshot}`,
          `User question: ${helpRequest.question}`,
          `Provide a concise, plain-language answer with actionable guidance. Reference the regulation if one was supplied. Close with a suggested next step when appropriate.`,
        ]
          .filter(Boolean)
          .join('\n\n')

        // Build headers with wallet address if available
        const helpHeaders: Record<string, string> = {
          'Content-Type': 'application/json',
        }

        // Add X-Wallet-Address header if user is logged in
        if (userAddress) {
          helpHeaders['X-Wallet-Address'] = userAddress
        }

        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: helpHeaders,
          body: JSON.stringify({
            message: helpPrompt,
            session_id: sessionId,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to fetch help response')
        }

        const data = await response.json()
        addAssistantMessage(
          data.reply ||
            "Here's what to keep in mind:\n• Provide the required details clearly\n• Make sure the statement covers the full DOT requirement\n• Let me know if you'd like to review this together."
        )
      } catch (error) {
        console.error('❌ [T ASSISTANT] Help request error:', error)
        addAssistantMessage(
          "Sorry, I couldn't pull those details just now. Try asking again or let me know what part is confusing so I can walk you through it."
        )
      } finally {
        setIsProcessingHelp(false)
      }
    }

    fetchHelp()
  }, [
    mounted,
    helpRequest,
    buildApplicationSnapshot,
    currentStep,
    userAddress,
    hasResume,
    hasForms,
    sessionId,
    addAssistantMessage,
  ])

  // Scroll to bottom when messages change within the assistant container only
  useEffect(() => {
    if (!mounted) return
    const container = messagesContainerRef.current
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth',
      })
    }
  }, [messages, mounted])

  // Focus input when component mounts
  useEffect(() => {
    if (mounted && inputRef.current) {
      inputRef.current.focus()
    }
  }, [mounted])

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: nextMessageId('user'),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    const messageText = input.trim()
    setInput('')

    // Update Ava Brain context
    avaBrainContextRef.current.lastActivity = Date.now()
    avaBrainContextRef.current.hasResume = hasResume ?? false
    avaBrainContextRef.current.profileCompleteness =
      profileCompleteness?.score ?? 0
    avaBrainContextRef.current.currentPage = currentStep

    // Create an event for the user message
    const event: AvaEvent = {
      category: 'help_request',
      action: 'user_message',
      context: { message: messageText },
      timestamp: Date.now(),
    }

    // Check with Ava Brain - does this need AI or can we use a template?
    // Pass userRole for role-aware routing (driver vs developer templates)
    const roleForBrain: UserRole =
      userRole === 'driver' || userRole === 'developer' ? userRole : null
    const routeResult = routeEvent(
      event,
      avaBrainContextRef.current,
      messageText,
      roleForBrain
    )

    // If the brain says we can use a template (no AI needed)
    if ('message' in routeResult && !routeResult.useAI && routeResult.message) {
      // Instant response from template - no loading needed!
      addAssistantMessage(routeResult.message, {
        actions: routeResult.actions,
        step: routeResult.metadata?.step,
      })
      console.log('⚡ [AVA BRAIN] Template response (instant, no AI cost)')
      return
    }

    // AI is needed - show loading and call the API
    setIsLoading(true)
    console.log('🤖 [AVA BRAIN] Escalating to AI for complex question')

    try {
      // Build context-aware prompt with application data
      const applicationSnapshot = buildApplicationSnapshot()

      // If the brain provided a pre-built prompt, use it; otherwise build our own
      const contextPrompt =
        'prompt' in routeResult
          ? routeResult.prompt
          : [
              `You are AvA, a friendly AI assistant guiding users through the driver employment application process.`,
              `Current step: ${currentStep}`,
              userAddress
                ? `User is logged in with wallet: ${userAddress}`
                : `User is not logged in yet`,
              hasResume
                ? `User has uploaded their resume`
                : `User has not uploaded their resume yet`,
              hasForms
                ? `User has started filling out forms`
                : `User has not started forms yet`,
              ``,
              `=== USER'S APPLICATION DATA ===`,
              applicationSnapshot,
              ``,
              `Be helpful, friendly, and guide them to the next step. You can reference their application data to provide personalized guidance.`,
              `Keep responses concise (2-3 paragraphs max).`,
              `User message: ${messageText}`,
            ].join('\n')

      // Build headers with wallet address if available
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }

      // Add X-Wallet-Address header if user is logged in
      if (userAddress) {
        headers['X-Wallet-Address'] = userAddress
      }

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: contextPrompt,
          session_id: sessionId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        let errorMessage = errorData?.error || 'Failed to get AI response'
        const detailMessage = errorData?.detail

        // Handle specific error codes with user-friendly messages
        if (response.status === 504) {
          // Gateway timeout - T Backend is slow or overloaded
          setIsLoading(false)
          addAssistantMessage(
            `The AI service is taking longer than expected to respond. This usually means high traffic. In the meantime, I can help with common questions:\n\n` +
              `• **"connect github"** - Link your GitHub profile\n` +
              `• **"build portfolio"** - Add projects to showcase\n` +
              `• **"career score"** - Calculate your AI career score\n` +
              `• **"share profile"** - Get your shareable Career Card link\n\n` +
              `Try one of these, or ask your question again in a moment!`
          )
          return
        }
        if (response.status === 502 || response.status === 503) {
          setIsLoading(false)
          addAssistantMessage(
            'AI service is temporarily unavailable. Please try again in a moment.'
          )
          return
        }
        const combinedMessage = detailMessage
          ? `${errorMessage}: ${detailMessage}`
          : errorMessage
        const enrichedError = new Error(combinedMessage)
        ;(enrichedError as any).status = response.status
        throw enrichedError
      }

      const data = await response.json()

      addAssistantMessage(data.reply || 'No response received')

      // Don't automatically trigger actions based on T's response
      // Actions should only be triggered by explicit user requests or buttons
      // This prevents accidental navigation when users are just asking questions
    } catch (error: any) {
      console.error('❌ [T ASSISTANT] Error sending message:', error)
      const fallback =
        error?.message ||
        `An unexpected error occurred (status: ${error?.status ?? 'unknown'})`
      addAssistantMessage(
        `Sorry, I encountered an error: ${fallback}. Please try again or check the console logs for details.`
      )
    } finally {
      setIsLoading(false)
    }
  }, [
    input,
    isLoading,
    sessionId,
    currentStep,
    userAddress,
    hasResume,
    hasForms,
    profileCompleteness,
    buildApplicationSnapshot,
    addAssistantMessage,
    nextMessageId,
    onAction,
  ])

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const buildPreviewMessage = useCallback((preview: any) => {
    const lines: string[] = ["**Here's what I'll fill in:**\n"]

    if (preview.form1Data) {
      lines.push('**Form 1 - Personal Information:**')
      if (preview.form1Data.firstName || preview.form1Data.lastName) {
        lines.push(
          `• Name: ${preview.form1Data.firstName || ''} ${preview.form1Data.lastName || ''}`.trim()
        )
      }
      if (preview.form1Data.email)
        lines.push(`• Email: ${preview.form1Data.email}`)
      if (preview.form1Data.phone)
        lines.push(`• Phone: ${preview.form1Data.phone}`)
      if (preview.form1Data.dateOfBirth)
        lines.push(`• Date of Birth: ${preview.form1Data.dateOfBirth}`)
      if (preview.form1Data.currentMailing?.street) {
        lines.push(
          `• Address: ${preview.form1Data.currentMailing.street}, ${preview.form1Data.currentMailing.city || ''}, ${preview.form1Data.currentMailing.state || ''}`
        )
      }
      if (preview.form1Data.currentLicenses?.[0]) {
        const license = preview.form1Data.currentLicenses[0]
        lines.push(
          `• License: ${license.licenseNumber || 'N/A'} (${license.state || 'State'}) - ${license.typeClass || 'Class'}`
        )
        if (license.endorsements)
          lines.push(`• Endorsements: ${license.endorsements}`)
      }
      if (
        preview.form1Data.medicalQualification?.medicalCertificateExpiration
      ) {
        lines.push(
          `• Medical Cert Expiration: ${preview.form1Data.medicalQualification.medicalCertificateExpiration}`
        )
      }
      lines.push('')
    }

    if (preview.form2Data) {
      if (
        preview.form2Data.workHistory &&
        preview.form2Data.workHistory.length > 0
      ) {
        lines.push(`**Form 2 - Employment History:**`)
        lines.push(
          `• ${preview.form2Data.workHistory.length} employment record(s) found`
        )
        lines.push('')
      }
    }

    const stats = preview.stats || { extracted: 0, total: 0 }
    lines.push(
      `**Summary:** ${stats.extracted} out of ${stats.total} fields extracted`
    )
    lines.push('\nReady to prefill your forms with this information?')

    return lines.join('\n')
  }, [])

  const handleMessageAction = useCallback(
    (action: MessageAction) => {
      switch (action.value) {
        case 'primer:learn_more':
          addAssistantMessage(
            "Here's the quick version:\n• Base smart wallets let drivers sign in with email—no seed phrases.\n• We can sponsor your gas fees so submitting DOT documents stays free for you.\n• Your resume + application live on-chain, so employers can trust they're unchanged.\nI'll keep everything guided, but shout if you want the deeper dive."
          )
          onAction?.(action.value)
          break
        case 'primer:skip':
          addAssistantMessage(
            "All good—we can revisit the blockchain basics whenever you're curious."
          )
          onAction?.(action.value)
          break
        case 'resume:prefill:preview':
          // Show preview of extracted data
          if (analysisPreview) {
            const preview = buildPreviewMessage(analysisPreview)
            addAssistantMessage(preview, {
              step: 'resume',
              actions: [
                {
                  id: 'resume-prefill-confirm',
                  label: 'Yes, use this data',
                  value: 'resume:prefill:confirm',
                },
                {
                  id: 'resume-continue',
                  label: "No, I'll fill manually",
                  value: 'forms',
                },
              ],
            })
          } else {
            addAssistantMessage(
              "Sorry, I don't have the preview data. Please try uploading your resume again."
            )
          }
          break
        case 'resume:prefill:confirm':
          // Confirm and trigger prefill
          addAssistantMessage(
            "Perfect! I'll prefill your forms now. This will take just a moment..."
          )

          // Pass the extracted data directly to the parent via the callback
          // This avoids calling the API again (which fails for duplicates)
          if (analysisPreview) {
            console.log(
              '📤 [T ASSISTANT] Passing prefill data directly:',
              analysisPreview
            )
            onAction?.(action.value, analysisPreview)
          } else {
            // No data available, let parent handle it
            onAction?.(action.value)
          }
          break
        case 'resume:reupload':
          // User needs to upload a modified resume due to cache lock
          addAssistantMessage(
            'Great! Go ahead and upload your modified resume. Remember, even a tiny change (like adding a space or updating a date) will make it a new file.'
          )
          onAction?.('resume') // Navigate to resume section
          break
        default:
          onAction?.(action.value)
          break
      }
    },
    [addAssistantMessage, onAction, analysisPreview, buildPreviewMessage]
  )

  const statusIcon = (status: string) => {
    switch (status) {
      case 'complete':
        return '✅'
      case 'in_progress':
        return '⏳'
      default:
        return '•'
    }
  }

  const journeySummary = journeyState
    ? [
        `${statusIcon(journeyState.wallet.status)} Wallet`,
        `${statusIcon(journeyState.resume.status)} Resume`,
        `${statusIcon(journeyState.forms.status)} Forms`,
        `${statusIcon(journeyState.submission.status)} Submission`,
      ].join(' • ')
    : ''

  if (!mounted) {
    return null
  }

  // Sidebar/Modal mode - only renders when not collapsed
  if (mode === 'sidebar') {
    // When collapsed, render nothing - AvA is accessed only from nav
    if (isCollapsed) {
      return null
    }

    // Desktop: Wide side panel (shorter, doesn't fill full height)
    // Mobile: Modal overlay with blur
    return (
      <>
        {/* Backdrop - mobile only */}
        <div
          className='md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]'
          onClick={(e) => {
            e.stopPropagation()
            if (onToggleCollapse) {
              onToggleCollapse()
            }
          }}
        />
        {/* 
          Mobile: Full-screen modal overlay
          Desktop: Wide panel on right, shorter height with rounded corners
        */}
        <div
          className={`fixed z-[9999] flex flex-col transition-all duration-300 pointer-events-auto
            inset-4 sm:inset-6
            md:top-24 md:bottom-6 md:left-auto md:right-6 md:w-[50vw] lg:w-[45vw] xl:w-[40vw] md:max-w-[700px]
            rounded-2xl overflow-hidden border ${
              theme === 'dark'
                ? 'bg-gray-800 border-brand-mint/20'
                : 'bg-gray-50 border-brand-sage/20'
            }`}
          style={{
            boxShadow:
              theme === 'dark'
                ? '0 8px 32px rgba(0, 0, 0, 0.3)'
                : '0 8px 32px rgba(0, 0, 0, 0.1)',
            pointerEvents: 'auto',
            zIndex: 9999,
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Header - Clean and compact */}
          <div
            className={`flex items-center justify-between px-5 py-3 ${
              theme === 'dark'
                ? 'border-b border-brand-mint/15'
                : 'border-b border-brand-sage/15'
            }`}
          >
            <div className='flex items-center gap-3'>
              {/* AvA Logo - Outline style */}
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center font-semibold text-xs border-2 ${
                  theme === 'dark'
                    ? 'border-brand-mint/50 text-brand-mint bg-transparent'
                    : 'border-brand-sage/50 text-brand-sage bg-transparent'
                }`}
              >
                AvA
              </div>
              <div>
                <h3
                  className={`font-semibold text-sm ${
                    theme === 'dark'
                      ? 'text-brand-cream'
                      : 'text-brand-sage-dark'
                  }`}
                >
                  AvA Assistant
                </h3>
                <p
                  className={`text-xs ${
                    theme === 'dark'
                      ? 'text-brand-mint/70'
                      : 'text-brand-sage/70'
                  }`}
                >
                  Your DOT application guide
                </p>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                if (onToggleCollapse) {
                  onToggleCollapse()
                }
              }}
              className={`p-2 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer ${
                theme === 'dark'
                  ? 'hover:bg-brand-mint/20 text-brand-cream/70 hover:text-brand-cream'
                  : 'hover:bg-brand-sage/10 text-brand-sage/70 hover:text-brand-sage'
              }`}
              aria-label='Close AvA Assistant'
              type='button'
              style={{ pointerEvents: 'auto', zIndex: 10000 }}
            >
              <X className='w-5 h-5' />
            </button>
          </div>

          {/* Messages - Better typography and spacing */}
          <div
            ref={messagesContainerRef}
            className={`flex-1 overflow-y-auto px-6 py-5 space-y-5 ${
              theme === 'dark' ? 'scrollbar-dark' : 'scrollbar-light'
            }`}
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-5 py-3 ${
                    message.role === 'user'
                      ? theme === 'dark'
                        ? 'bg-brand-mint text-gray-900'
                        : 'bg-brand-sage text-white'
                      : theme === 'dark'
                        ? 'bg-gray-700 text-brand-cream'
                        : 'bg-white text-gray-800 shadow-sm'
                  }`}
                >
                  <p className='text-sm leading-relaxed whitespace-pre-wrap'>
                    {message.content}
                  </p>
                  <p
                    className={`text-[10px] mt-2 ${
                      message.role === 'user'
                        ? theme === 'dark'
                          ? 'text-gray-700/80'
                          : 'text-white/60'
                        : theme === 'dark'
                          ? 'text-gray-500'
                          : 'text-gray-400'
                    }`}
                  >
                    {message.timestamp.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                  {message.role === 'assistant' &&
                    message.actions &&
                    message.actions.length > 0 && (
                      <div className='flex flex-wrap gap-2 mt-4 pt-3 border-t border-gray-200/20'>
                        {message.actions.map((action) => (
                          <button
                            key={action.id}
                            type='button'
                            onClick={() => handleMessageAction(action)}
                            className={`px-4 py-1.5 text-xs font-medium rounded-full border transition-all cursor-pointer ${
                              theme === 'dark'
                                ? 'border-brand-mint/40 text-brand-mint hover:bg-brand-mint/15 hover:border-brand-mint/60'
                                : 'border-brand-sage/30 text-brand-sage hover:bg-brand-sage/10 hover:border-brand-sage/50'
                            }`}
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    )}
                </div>
              </div>
            ))}
            {(isLoading || isProcessingHelp) && (
              <div className='flex justify-start'>
                <div
                  className={`rounded-2xl px-5 py-3 ${
                    theme === 'dark'
                      ? 'bg-gray-700 text-brand-cream'
                      : 'bg-white shadow-sm'
                  }`}
                >
                  <div className='flex items-center gap-2'>
                    <Loader2
                      className={`w-4 h-4 animate-spin ${
                        theme === 'dark' ? 'text-brand-mint' : 'text-brand-sage'
                      }`}
                    />
                    <span
                      className={`text-sm ${
                        theme === 'dark'
                          ? 'text-brand-cream/70'
                          : 'text-gray-500'
                      }`}
                    >
                      AvA is thinking...
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input - Clean and simple */}
          <div
            className={`px-5 py-4 ${
              theme === 'dark'
                ? 'border-t border-brand-mint/15'
                : 'border-t border-brand-sage/15'
            }`}
          >
            <div className='flex items-center gap-3'>
              <input
                ref={inputRef}
                type='text'
                value={input}
                onChange={(e) => {
                  setInput(e.target.value)
                  resetActivityTimer() // Track user activity
                }}
                onKeyPress={handleKeyPress}
                placeholder='Ask AvA anything...'
                disabled={isLoading}
                className={`flex-1 px-5 py-3 rounded-xl border focus:outline-none transition-all ${
                  theme === 'dark'
                    ? 'bg-gray-700 border-brand-mint/20 text-brand-cream focus:border-brand-mint/40 placeholder-brand-cream/50'
                    : 'bg-white border-brand-sage/20 text-gray-900 focus:border-brand-sage/40 placeholder-gray-400'
                }`}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className={`p-3 rounded-xl transition-all cursor-pointer ${
                  !input.trim() || isLoading
                    ? 'opacity-40 cursor-not-allowed'
                    : theme === 'dark'
                      ? 'bg-brand-mint text-gray-900 hover:bg-brand-mint/90 shadow-lg shadow-brand-mint/20 hover:shadow-brand-mint/30'
                      : 'bg-brand-sage text-white hover:bg-brand-sage/90 shadow-lg shadow-brand-sage/20 hover:shadow-brand-sage/30'
                }`}
                aria-label='Send message'
              >
                {isLoading ? (
                  <Loader2 className='w-5 h-5 animate-spin' />
                ) : (
                  <Send className='w-5 h-5' />
                )}
              </button>
            </div>
          </div>
        </div>
      </>
    )
  }

  // Center mode (original layout)
  return (
    <div
      className={`w-full max-w-4xl mx-auto rounded-lg shadow-2xl flex flex-col ${
        theme === 'dark'
          ? 'bg-brand-sage-light/20 backdrop-blur-xl border border-brand-mint'
          : 'bg-white/90 backdrop-blur-xl border border-gray-200'
      }`}
      style={{ height: '600px' }}
    >
      {/* Header */}
      <div
        className={`flex items-center justify-between p-4 border-b ${
          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
        }`}
      >
        <div className='flex items-center space-x-3'>
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg border-2 ${
              theme === 'dark'
                ? 'bg-gradient-to-br from-brand-mint to-teal-600 text-brand-cream border-brand-mint/50'
                : 'bg-gradient-to-br from-brand-sage to-brand-sage-dark text-white border-brand-sage/50'
            }`}
            style={{
              boxShadow:
                theme === 'dark'
                  ? '0 0 20px rgba(20, 184, 166, 0.4), inset 0 0 10px rgba(255, 255, 255, 0.1)'
                  : '0 0 20px rgba(107, 142, 35, 0.4), inset 0 0 10px rgba(255, 255, 255, 0.1)',
            }}
          >
            <span className='text-lg font-bold'>AvA</span>
          </div>
          <div>
            <h3
              className={`font-bold text-lg ${
                theme === 'dark' ? 'text-brand-cream' : 'text-gray-900'
              }`}
            >
              AvA Assistant
            </h3>
            <p
              className={`text-xs ${
                theme === 'dark' ? 'text-brand-cream/70' : 'text-gray-600'
              }`}
            >
              Your AI helper for the employment process
            </p>
          </div>
        </div>
        <div className='flex items-center space-x-2'>
          {currentStep === 'welcome' && (
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                theme === 'dark'
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : 'bg-yellow-100 text-yellow-800'
              }`}
            >
              Step 1: Welcome
            </span>
          )}
          {currentStep === 'wallet' && (
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                theme === 'dark'
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'bg-blue-100 text-blue-800'
              }`}
            >
              Step 2: Wallet Created
            </span>
          )}
          {currentStep === 'resume' && (
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                theme === 'dark'
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-green-100 text-green-800'
              }`}
            >
              Step 3: Resume Uploaded
            </span>
          )}
          {currentStep === 'forms' && (
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                theme === 'dark'
                  ? 'bg-purple-500/20 text-purple-400'
                  : 'bg-purple-100 text-purple-800'
              }`}
            >
              Step 4: Forms
            </span>
          )}
          {currentStep === 'submission' && (
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                theme === 'dark'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              Step 5: Submitted
            </span>
          )}
        </div>
      </div>
      {journeyState && (
        <div
          className={`px-4 pb-2 text-xs ${
            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
          }`}
        >
          Progress: {journeySummary}
        </div>
      )}

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className='flex-1 overflow-y-auto p-4 space-y-4'
      >
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                message.role === 'user'
                  ? theme === 'dark'
                    ? 'bg-brand-mint text-gray-900'
                    : 'bg-brand-sage text-white'
                  : theme === 'dark'
                    ? 'bg-gray-800 text-gray-100'
                    : 'bg-gray-100 text-gray-900'
              }`}
            >
              <p className='text-sm whitespace-pre-wrap'>{message.content}</p>
              <p
                className={`text-xs mt-1 ${
                  message.role === 'user'
                    ? theme === 'dark'
                      ? 'text-gray-700'
                      : 'text-white/70'
                    : theme === 'dark'
                      ? 'text-gray-400'
                      : 'text-gray-500'
                }`}
              >
                {message.timestamp.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
              {message.role === 'assistant' &&
                message.actions &&
                message.actions.length > 0 && (
                  <div className='flex flex-wrap gap-2 mt-3'>
                    {message.actions.map((action) => (
                      <button
                        key={action.id}
                        type='button'
                        onClick={() => handleMessageAction(action)}
                        className={`px-3 py-1 text-xs font-medium rounded-full border transition-all cursor-pointer ${
                          theme === 'dark'
                            ? 'border-brand-mint/50 text-brand-mint hover:bg-brand-mint/10'
                            : 'border-brand-sage/40 text-brand-sage hover:bg-brand-sage/10'
                        }`}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
            </div>
          </div>
        ))}
        {(isLoading || isProcessingHelp) && (
          <div className='flex justify-start'>
            <div
              className={`rounded-lg px-4 py-2 ${
                theme === 'dark'
                  ? 'bg-gray-800 text-gray-100'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              <Loader2 className='w-4 h-4 animate-spin' />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div
        className={`p-4 border-t ${
          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
        }`}
      >
        <div className='flex items-center space-x-2'>
          <input
            ref={inputRef}
            type='text'
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              resetActivityTimer() // Track user activity
            }}
            onKeyPress={handleKeyPress}
            placeholder='Ask me anything about the application process...'
            disabled={isLoading}
            className={`flex-1 px-4 py-2 rounded-lg border-2 focus:outline-none focus:ring-2 focus:border-transparent ${
              theme === 'dark'
                ? 'bg-gray-800 border-gray-700 text-white focus:ring-brand-mint placeholder-gray-500'
                : 'bg-white border-gray-300 text-gray-900 focus:ring-brand-sage placeholder-gray-400'
            }`}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className={`p-2 rounded-lg transition-colors cursor-pointer ${
              !input.trim() || isLoading
                ? 'opacity-50 cursor-not-allowed'
                : theme === 'dark'
                  ? 'bg-brand-mint text-gray-900 hover:bg-brand-mint/90'
                  : 'bg-brand-sage text-white hover:bg-brand-sage/90'
            }`}
            aria-label='Send message'
          >
            {isLoading ? (
              <Loader2 className='w-5 h-5 animate-spin' />
            ) : (
              <Send className='w-5 h-5' />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// Main component that handles SSR
export default function TAssistant(props: TAssistantProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  return <TAssistantContent {...props} />
}
