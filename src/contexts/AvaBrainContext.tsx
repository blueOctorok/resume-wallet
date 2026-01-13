'use client'

import React, { createContext, useContext, useCallback, useRef, useState, useEffect } from 'react'
import {
  AvaEvent,
  AvaEventCategory,
  AvaResponse,
  UserContext,
  createInitialContext,
  routeEvent,
  logEvent,
  checkMilestones,
  checkInactivity,
} from '@/lib/ava-brain'

// =====================================================
// CONTEXT TYPES
// =====================================================

interface AvaBrainContextType {
  // Track events
  trackEvent: (category: AvaEventCategory, action: string, context?: Record<string, unknown>) => void
  
  // Handle user messages (decides AI vs template)
  handleUserMessage: (message: string) => AvaResponse | { useAI: true; prompt: string }
  
  // Get Ava's response for an event
  getEventResponse: (event: AvaEvent) => AvaResponse | null
  
  // Update user context directly
  updateContext: (updates: Partial<UserContext>) => void
  
  // Get current context
  getContext: () => UserContext
  
  // Pending messages from template responses
  pendingMessages: AvaResponse[]
  clearPendingMessage: () => void
}

const AvaBrainContext = createContext<AvaBrainContextType | null>(null)

// =====================================================
// PROVIDER
// =====================================================

export function AvaBrainProvider({ children }: { children: React.ReactNode }) {
  const contextRef = useRef<UserContext>(createInitialContext())
  const [pendingMessages, setPendingMessages] = useState<AvaResponse[]>([])
  
  // Inactivity checker
  useEffect(() => {
    const interval = setInterval(() => {
      const inactivityEvent = checkInactivity(contextRef.current)
      if (inactivityEvent) {
        const response = routeEvent(inactivityEvent, contextRef.current)
        if ('message' in response && response.message) {
          setPendingMessages(prev => [...prev, response])
        }
      }
    }, 5000) // Check every 5 seconds
    
    return () => clearInterval(interval)
  }, [])
  
  const trackEvent = useCallback((
    category: AvaEventCategory,
    action: string,
    eventContext?: Record<string, unknown>
  ) => {
    const event: AvaEvent = {
      category,
      action,
      context: eventContext,
      timestamp: Date.now(),
    }
    
    // Check for milestones before updating context
    const prevContext = { ...contextRef.current }
    
    // Update context with this event
    contextRef.current = logEvent(contextRef.current, event)
    
    // Check if this triggered a milestone
    const milestoneEvent = checkMilestones(prevContext, contextRef.current)
    if (milestoneEvent) {
      const milestoneResponse = routeEvent(milestoneEvent, contextRef.current)
      if ('message' in milestoneResponse && milestoneResponse.message) {
        setPendingMessages(prev => [...prev, milestoneResponse])
      }
    }
    
    // Get response for this event
    const response = routeEvent(event, contextRef.current)
    if ('message' in response && response.message) {
      setPendingMessages(prev => [...prev, response])
    }
  }, [])
  
  const handleUserMessage = useCallback((message: string): AvaResponse | { useAI: true; prompt: string } => {
    // Create a help_request event
    const event: AvaEvent = {
      category: 'help_request',
      action: 'user_message',
      context: { message },
      timestamp: Date.now(),
    }
    
    return routeEvent(event, contextRef.current, message)
  }, [])
  
  const getEventResponse = useCallback((event: AvaEvent): AvaResponse | null => {
    const response = routeEvent(event, contextRef.current)
    if ('message' in response && response.message) {
      return response
    }
    return null
  }, [])
  
  const updateContext = useCallback((updates: Partial<UserContext>) => {
    const prevContext = { ...contextRef.current }
    contextRef.current = { ...contextRef.current, ...updates }
    
    // Check for milestones
    const milestoneEvent = checkMilestones(prevContext, contextRef.current)
    if (milestoneEvent) {
      const milestoneResponse = routeEvent(milestoneEvent, contextRef.current)
      if ('message' in milestoneResponse && milestoneResponse.message) {
        setPendingMessages(prev => [...prev, milestoneResponse])
      }
    }
  }, [])
  
  const getContext = useCallback(() => contextRef.current, [])
  
  const clearPendingMessage = useCallback(() => {
    setPendingMessages(prev => prev.slice(1))
  }, [])
  
  return (
    <AvaBrainContext.Provider value={{
      trackEvent,
      handleUserMessage,
      getEventResponse,
      updateContext,
      getContext,
      pendingMessages,
      clearPendingMessage,
    }}>
      {children}
    </AvaBrainContext.Provider>
  )
}

// =====================================================
// HOOK
// =====================================================

export function useAvaBrain() {
  const context = useContext(AvaBrainContext)
  if (!context) {
    throw new Error('useAvaBrain must be used within AvaBrainProvider')
  }
  return context
}

// =====================================================
// HELPER HOOK - Use for automatic page tracking
// =====================================================

export function useAvaPageTracking(page: string | null) {
  const { trackEvent, updateContext } = useAvaBrain()
  const prevPage = useRef<string | null>(null)
  
  useEffect(() => {
    if (page !== prevPage.current) {
      trackEvent('navigation', 'page_change', { page })
      updateContext({ currentPage: page })
      prevPage.current = page
    }
  }, [page, trackEvent, updateContext])
}
