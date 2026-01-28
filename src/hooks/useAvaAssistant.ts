'use client'

import { useState, useCallback, useRef } from 'react'
import type {
  AssistantHelpPayload,
  AssistantHelpRequest,
  PrimerPrompt,
} from '@/types/assistant'

interface UseAvaAssistantOptions {
  userAddress?: string | null
}

interface UseAvaAssistantReturn {
  // Collapse state
  isAvaCollapsed: boolean
  setIsAvaCollapsed: (value: boolean) => void
  toggleAvaCollapse: () => void

  // Unread indicator
  avaHasUnread: boolean
  setAvaHasUnread: (value: boolean) => void

  // Loading state
  avaIsWorking: boolean
  avaWorkingMessage: string
  setAvaWorking: (isWorking: boolean, message?: string) => void

  // Help request
  helpRequest: AssistantHelpRequest | null
  handleHelpRequest: (payload: AssistantHelpPayload) => void
  clearHelpRequest: () => void

  // Primer state
  primerSeen: boolean
  primerRequest: PrimerPrompt | null
  setPrimerSeen: (value: boolean) => void
  triggerPrimer: () => void
  handlePrimerAction: (action: 'primer:learn_more' | 'primer:skip') => void
  isPrimerTriggered: () => boolean

  // Reset all state (for logout)
  resetAvaState: () => void
}

/**
 * Custom hook to manage AvA Assistant state.
 * Extracts assistant-related state from page.tsx to keep it organized.
 */
export function useAvaAssistant({
  userAddress,
}: UseAvaAssistantOptions = {}): UseAvaAssistantReturn {
  // Collapse state - start collapsed
  const [isAvaCollapsed, setIsAvaCollapsed] = useState(true)

  // Unread indicator
  const [avaHasUnread, setAvaHasUnread] = useState(false)

  // Loading state
  const [avaIsWorking, setAvaIsWorking] = useState(false)
  const [avaWorkingMessage, setAvaWorkingMessage] =
    useState('AvA is thinking...')

  // Help request state
  const [helpRequest, setHelpRequest] = useState<AssistantHelpRequest | null>(
    null,
  )

  // Primer state
  const [primerSeen, setPrimerSeenState] = useState(false)
  const [primerRequest, setPrimerRequest] = useState<PrimerPrompt | null>(null)
  const primerTriggeredRef = useRef(false)

  // Toggle collapse
  const toggleAvaCollapse = useCallback(() => {
    setIsAvaCollapsed((prev) => !prev)
  }, [])

  // Set working state with optional message
  const setAvaWorking = useCallback((isWorking: boolean, message?: string) => {
    setAvaIsWorking(isWorking)
    if (message) {
      setAvaWorkingMessage(message)
    }
  }, [])

  // Handle setting primer seen (persists to localStorage)
  const setPrimerSeen = useCallback(
    (value: boolean) => {
      setPrimerSeenState(value)
      if (typeof window !== 'undefined' && userAddress) {
        window.localStorage.setItem(
          `journey-primer-${userAddress}`,
          value ? 'seen' : 'pending',
        )
      }
      if (value) {
        primerTriggeredRef.current = true
        setPrimerRequest(null) // Clear primer request when marked as seen
      }
    },
    [userAddress],
  )

  // Handle help request - auto-opens AvA
  const handleHelpRequest = useCallback((payload: AssistantHelpPayload) => {
    const request: AssistantHelpRequest = {
      ...payload,
      id: `help-${Date.now()}`,
      createdAt: new Date().toISOString(),
    }
    setHelpRequest(request)
    // Auto-open AvA when user clicks "Ask AvA" button
    setIsAvaCollapsed(false)
  }, [])

  // Clear help request
  const clearHelpRequest = useCallback(() => {
    setHelpRequest(null)
  }, [])

  // Trigger primer prompt
  const triggerPrimer = useCallback(() => {
    if (!primerTriggeredRef.current) {
      setPrimerRequest({
        id: `primer-${Date.now()}`,
        type: 'primer',
        createdAt: new Date().toISOString(),
      })
      primerTriggeredRef.current = true
    }
  }, [])

  // Handle primer action (learn more or skip)
  const handlePrimerAction = useCallback(
    (action: 'primer:learn_more' | 'primer:skip') => {
      setPrimerSeen(true)
      setPrimerRequest(null)
      primerTriggeredRef.current = true
      console.log('🎓 [AVA] Primer action:', action)
    },
    [setPrimerSeen],
  )

  // Check if primer has been triggered
  const isPrimerTriggered = useCallback(() => {
    return primerTriggeredRef.current
  }, [])

  // Reset all state (used on logout)
  const resetAvaState = useCallback(() => {
    setHelpRequest(null)
    setPrimerRequest(null)
    primerTriggeredRef.current = false
    setIsAvaCollapsed(true)
    setAvaHasUnread(false)
    setAvaIsWorking(false)
    setAvaWorkingMessage('AvA is thinking...')
    setPrimerSeenState(false)
  }, [])

  // Initialize primer state from localStorage when userAddress changes
  // Note: This is handled in the parent component's useEffect since it needs
  // to coordinate with other initialization logic

  return {
    // Collapse
    isAvaCollapsed,
    setIsAvaCollapsed,
    toggleAvaCollapse,

    // Unread
    avaHasUnread,
    setAvaHasUnread,

    // Working
    avaIsWorking,
    avaWorkingMessage,
    setAvaWorking,

    // Help request
    helpRequest,
    handleHelpRequest,
    clearHelpRequest,

    // Primer
    primerSeen,
    primerRequest,
    setPrimerSeen,
    triggerPrimer,
    handlePrimerAction,
    isPrimerTriggered,

    // Reset
    resetAvaState,
  }
}
