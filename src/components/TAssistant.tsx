'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { MessageCircle, Send, Loader2 } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import type {
  AssistantHelpRequest,
  DriverJourneyState,
  PrimerPrompt,
  ResumeUploadEvent,
} from '@/types/assistant'

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
  currentStep?: 'welcome' | 'wallet' | 'resume' | 'forms' | 'submission' | 'complete'
  onAction?: (action: string) => void
  userAddress?: string | null
  hasResume?: boolean
  hasForms?: boolean
  form1Data?: any
  form2Data?: any
  form3Data?: any
  journeyState?: DriverJourneyState
  helpRequest?: AssistantHelpRequest | null
  primerRequest?: PrimerPrompt | null
  resumeUploadEvent?: ResumeUploadEvent | null
}

// Wrapper component that safely handles SSR
function TAssistantContent({
  currentStep = 'welcome',
  onAction,
  userAddress,
  hasResume,
  hasForms,
  form1Data,
  form2Data,
  form3Data,
  journeyState,
  helpRequest,
  primerRequest,
  resumeUploadEvent,
}: TAssistantProps) {
  const { theme } = useTheme()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isProcessingHelp, setIsProcessingHelp] = useState(false)
  const [sessionId, setSessionId] = useState<string>(`user-${Date.now()}`)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [mounted, setMounted] = useState(false)
  const prevJourneyRef = useRef<DriverJourneyState | null>(null)
  const helpRequestHandledRef = useRef<string | null>(null)
  const primerRequestHandledRef = useRef<string | null>(null)
  const resumeUploadEventHandledRef = useRef<string | null>(null)
  const messageCounterRef = useRef(0)

  const nextMessageId = useCallback((prefix: string) => {
    messageCounterRef.current += 1
    return `${prefix}-${Date.now()}-${messageCounterRef.current}`
  }, [])

  const addAssistantMessage = useCallback(
    (content: string, options?: { actions?: MessageAction[]; step?: string }) => {
      setMessages((prev) => [
        ...prev,
        {
          id: nextMessageId('assistant'),
          role: 'assistant',
          content,
          timestamp: new Date(),
          step: options?.step,
          actions: options?.actions,
        },
      ])
    },
    [nextMessageId]
  )

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

  // Initialize with welcome message based on current step
  useEffect(() => {
    if (!mounted || messages.length > 0) return

    const welcomeMessages: Record<string, string> = {
      welcome: "👋 Hi! I'm T, your AI assistant. I'm here to guide you through the entire driver employment process.\n\nLet's get started! First, you'll need to:\n\n1️⃣ **Log in** to create your secure wallet\n2️⃣ **Upload your resume** (I can help prefill your application!)\n3️⃣ **Complete your driver application** (I'll guide you through each form)\n4️⃣ **Submit and verify** your application\n\nReady to begin? Click 'Sign In' to get started!",
      wallet: "✅ Great! You're logged in. Now let's move to the next step.\n\n2️⃣ **Upload your resume** - I can automatically extract information from your resume to prefill your application forms, saving you time!\n\nClick 'Upload Resume' when you're ready.",
      resume: "✅ Excellent! Your resume is uploaded. I've extracted your information and prefilled your application forms.\n\n3️⃣ **Complete your driver application** - I'll guide you through each form step by step. Let's start with Form 1: Personal Information.\n\nClick 'Start Application' to begin!",
      forms: "✅ You're making great progress! Continue filling out your driver application forms.\n\nI'm here to help if you have any questions about:\n• DOT compliance requirements\n• Form field explanations\n• What information is needed\n\nJust ask me anything!",
      submission: "🎉 Congratulations! Your application has been submitted to the blockchain.\n\n4️⃣ **Next steps:**\n• Complete employment verification\n• Wait for DOT review\n• Check your dashboard for updates\n\nI'll be here if you need help with anything else!",
      complete: "🎊 Amazing! You've completed the entire process!\n\nYour driver application is now:\n✅ Submitted to blockchain\n✅ Verified and secure\n✅ Ready for employer review\n\nIs there anything else I can help you with?",
    }

    const welcomeActions: Record<string, MessageAction[] | undefined> = {
      welcome: [
        { id: 'welcome-signin', label: 'Sign In', value: 'signin' },
      ],
      wallet: [
        { id: 'wallet-resume', label: 'Upload resume', value: 'resume' },
        { id: 'wallet-forms', label: 'Start application', value: 'forms' },
        { id: 'wallet-primer', label: 'Why blockchain?', value: 'primer:learn_more' },
      ],
      resume: [
        { id: 'resume-forms', label: 'Continue to forms', value: 'forms' },
      ],
      forms: [
        { id: 'forms-progress', label: 'Open DOT forms', value: 'forms' },
      ],
      submission: [
        { id: 'submission-dashboard', label: 'View dashboard', value: 'dashboard' },
      ],
      complete: [
        { id: 'complete-dashboard', label: 'Open dashboard', value: 'dashboard' },
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
    const walletChanged =
      journeyState.wallet.status === 'complete' &&
      previous.wallet.status !== 'complete'
    if (walletChanged) {
      addAssistantMessage(
        '✅ Your Base smart wallet is active. Next up, upload your resume so I can prefill the DOT forms or jump straight into the application.',
        {
          step: 'wallet',
          actions: [
            { id: 'journey-wallet-resume', label: 'Upload resume', value: 'resume' },
            { id: 'journey-wallet-forms', label: 'Start application', value: 'forms' },
            { id: 'journey-wallet-primer', label: 'Why blockchain?', value: 'primer:learn_more' },
          ],
        }
      )
    }

    const resumeChanged =
      journeyState.resume.status === 'complete' &&
      previous.resume.status !== 'complete'
    if (resumeChanged) {
      addAssistantMessage(
        '📄 Got it—your resume is on file. I can now prefill the DOT application to save you time.',
        {
          step: 'resume',
          actions: [
            { id: 'journey-resume-forms', label: 'Continue to forms', value: 'forms' },
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
            { id: 'journey-dashboard', label: 'Open dashboard', value: 'dashboard' },
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
        { id: 'primer-learn', label: 'Tell me more', value: 'primer:learn_more' },
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

    // Display the message from the event
    if (resumeUploadEvent.message) {
      addAssistantMessage(resumeUploadEvent.message, {
        step: 'resume',
        actions: resumeUploadEvent.type === 'blockchain_complete' || resumeUploadEvent.type === 'analysis_ready'
          ? [
              { id: 'resume-prefill', label: 'Yes, prefill my forms', value: 'resume:prefill' },
              { id: 'resume-continue', label: 'No, I\'ll fill manually', value: 'forms' },
            ]
          : resumeUploadEvent.type === 'upload_error'
          ? [
              { id: 'resume-help', label: 'Get help', value: 'resume:help' },
            ]
          : undefined,
      })
    }
  }, [resumeUploadEvent, mounted, addAssistantMessage])

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
          `You are T, a friendly DOT compliance assistant helping drivers complete FMCSA-required application forms.`,
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

        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
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
    setInput('')
    setIsLoading(true)

    try {
      // Build context-aware prompt with application data
      const applicationSnapshot = buildApplicationSnapshot()
      const contextPrompt = [
        `You are T, a friendly AI assistant guiding users through the driver employment application process.`,
        `Current step: ${currentStep}`,
        userAddress ? `User is logged in with wallet: ${userAddress}` : `User is not logged in yet`,
        hasResume ? `User has uploaded their resume` : `User has not uploaded their resume yet`,
        hasForms ? `User has started filling out forms` : `User has not started forms yet`,
        ``,
        `=== USER'S APPLICATION DATA ===`,
        applicationSnapshot,
        ``,
        `Be helpful, friendly, and guide them to the next step. You can reference their application data to provide personalized guidance.`,
        `User message: ${userMessage.content}`,
      ].join('\n')

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: contextPrompt,
          session_id: sessionId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData?.error || 'Failed to get AI response'
        const detailMessage = errorData?.detail
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

  const handleMessageAction = useCallback(
    (action: MessageAction) => {
      switch (action.value) {
        case 'primer:learn_more':
          addAssistantMessage(
            "Here’s the quick version:\n• Base smart wallets let drivers sign in with email—no seed phrases.\n• We can sponsor your gas fees so submitting DOT documents stays free for you.\n• Your resume + application live on-chain, so employers can trust they’re unchanged.\nI’ll keep everything guided, but shout if you want the deeper dive."
          )
          onAction?.(action.value)
          break
        case 'primer:skip':
          addAssistantMessage(
            'All good—we can revisit the blockchain basics whenever you’re curious.'
          )
          onAction?.(action.value)
          break
        default:
          onAction?.(action.value)
          break
      }
    },
    [addAssistantMessage, onAction]
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
        <div className="flex items-center space-x-3">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center ${
              theme === 'dark'
                ? 'bg-brand-mint text-gray-900'
                : 'bg-brand-sage text-white'
            }`}
          >
            <MessageCircle className="w-6 h-6" />
          </div>
          <div>
            <h3
              className={`font-semibold ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}
            >
              T - Your AI Guide
            </h3>
            <p
              className={`text-xs ${
                theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
              }`}
            >
              Step-by-step employment process guide
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
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
        className="flex-1 overflow-y-auto p-4 space-y-4"
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
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
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
                  <div className="flex flex-wrap gap-2 mt-3">
                    {message.actions.map((action) => (
                      <button
                        key={action.id}
                        type="button"
                        onClick={() => handleMessageAction(action)}
                        className={`px-3 py-1 text-xs font-medium rounded-full border transition-all ${
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
          <div className="flex justify-start">
            <div
              className={`rounded-lg px-4 py-2 ${
                theme === 'dark'
                  ? 'bg-gray-800 text-gray-100'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              <Loader2 className="w-4 h-4 animate-spin" />
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
        <div className="flex items-center space-x-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me anything about the application process..."
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
            className={`p-2 rounded-lg transition-colors ${
              !input.trim() || isLoading
                ? 'opacity-50 cursor-not-allowed'
                : theme === 'dark'
                  ? 'bg-brand-mint text-gray-900 hover:bg-brand-mint/90'
                  : 'bg-brand-sage text-white hover:bg-brand-sage/90'
            }`}
            aria-label="Send message"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
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

