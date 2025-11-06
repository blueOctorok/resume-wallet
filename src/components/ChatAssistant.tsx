'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { MessageCircle, X, Send, Loader2 } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

// Wrapper component that safely uses Alchemy context
function ChatAssistantContent() {
  const { theme } = useTheme()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string>(`anonymous-${Date.now()}`)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [mounted, setMounted] = useState(false)

  // Only access Alchemy context after mount (client-side only)
  useEffect(() => {
    setMounted(true)
  }, [])

  // Try to get user address from Alchemy context (only on client, after mount)
  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return

    try {
      // Dynamic import to avoid SSR issues
      const { useAlchemyAccountContext } = require('@account-kit/react')
      // We can't use hooks conditionally, so we'll use a different approach
      // For now, use anonymous sessions - we can enhance this later
    } catch {
      // Context not available, use anonymous session
    }
  }, [mounted])

  // Generate session ID based on user address if available (stored in localStorage or context)
  useEffect(() => {
    if (!mounted) return

    // Try to get user address from localStorage (if stored by Alchemy)
    try {
      const storedAddress = localStorage.getItem('alchemy-account-address')
      if (storedAddress) {
        setSessionId(`user-${storedAddress.toLowerCase()}`)
      }
    } catch {
      // localStorage not available, use anonymous session
    }
  }, [mounted])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Add welcome message when chat opens for the first time
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: 'Hello! I\'m your AI assistant. I can help you with:\n\n• Driver application questions\n• DOT compliance requirements\n• Form guidance\n• General questions about the application process\n\nHow can I help you today?',
          timestamp: new Date(),
        },
      ])
    }
  }, [isOpen, messages.length])

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
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
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
    } catch (error: any) {
      console.error('❌ [CHAT] Error sending message:', error)
      
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
  }, [input, isLoading, sessionId])

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      {/* Floating Chat Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-110 ${
            theme === 'dark'
              ? 'bg-brand-mint text-gray-900 hover:bg-brand-mint/90'
              : 'bg-brand-sage text-white hover:bg-brand-sage/90'
          }`}
          aria-label="Open chat assistant"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div
          className={`fixed bottom-6 right-6 z-50 w-96 h-[600px] rounded-lg shadow-2xl flex flex-col ${
            theme === 'dark'
              ? 'bg-brand-sage-light/20 backdrop-blur-xl border border-brand-mint'
              : 'bg-white/90 backdrop-blur-xl border border-gray-200'
          }`}
        >
          {/* Header */}
          <div
            className={`flex items-center justify-between p-4 border-b ${
              theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
            }`}
          >
            <div>
              <h3
                className={`font-semibold ${
                  theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}
              >
                AI Assistant
              </h3>
              <p
                className={`text-xs ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                }`}
              >
                Driver application help
              </p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className={`p-2 rounded-md transition-colors ${
                theme === 'dark'
                  ? 'hover:bg-gray-700 text-gray-300'
                  : 'hover:bg-gray-100 text-gray-600'
              }`}
              aria-label="Close chat"
            >
              <X className="w-5 h-5" />
            </button>
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
                placeholder="Type your message..."
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
      )}
    </>
  )
}

// Main component that handles SSR and context availability
export default function ChatAssistant() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Don't render until client-side mount to avoid SSR issues
  if (!mounted) {
    return null
  }

  return <ChatAssistantContent />
}

