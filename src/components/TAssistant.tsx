'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { MessageCircle, Send, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  step?: string
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
}: TAssistantProps) {
  const { theme } = useTheme()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string>(`user-${Date.now()}`)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [mounted, setMounted] = useState(false)

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

    const welcomeMessage: Message = {
      id: 'welcome',
      role: 'assistant',
      content: welcomeMessages[currentStep] || welcomeMessages.welcome,
      timestamp: new Date(),
      step: currentStep,
    }

    setMessages([welcomeMessage])
  }, [mounted, currentStep, messages.length])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when component mounts
  useEffect(() => {
    if (mounted && inputRef.current) {
      inputRef.current.focus()
    }
  }, [mounted])

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      // Build context-aware prompt with application data
      const contextPrompt = [
        `You are T, a friendly AI assistant guiding users through the driver employment application process.`,
        `Current step: ${currentStep}`,
        userAddress ? `User is logged in with wallet: ${userAddress}` : `User is not logged in yet`,
        hasResume ? `User has uploaded their resume` : `User has not uploaded their resume yet`,
        hasForms ? `User has started filling out forms` : `User has not started forms yet`,
        ``,
        `=== USER'S APPLICATION DATA ===`,
        form1Data ? `Form 1 (Personal Info): ${JSON.stringify(form1Data, null, 2)}` : `Form 1: Not started`,
        form2Data ? `Form 2 (Driving & Records): ${JSON.stringify(form2Data, null, 2)}` : `Form 2: Not started`,
        form3Data ? `Form 3 (Employment & Signature): ${JSON.stringify(form3Data, null, 2)}` : `Form 3: Not started`,
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
        throw new Error(errorData.error || 'Failed to get AI response')
      }

      const data = await response.json()
      
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.reply || 'No response received',
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, assistantMessage])

      // Don't automatically trigger actions based on T's response
      // Actions should only be triggered by explicit user requests or buttons
      // This prevents accidental navigation when users are just asking questions
    } catch (error: any) {
      console.error('❌ [T ASSISTANT] Error sending message:', error)
      
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error.message || 'Unknown error'}. Please try again.`,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, sessionId, currentStep, userAddress, hasResume, hasForms, form1Data, form2Data, form3Data, onAction])

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
            </div>
          </div>
        ))}
        {isLoading && (
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
        <div ref={messagesEndRef} />
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

