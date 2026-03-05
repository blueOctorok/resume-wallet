'use client'

import { useState, useEffect, useCallback } from 'react'
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'

type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error'

interface SyncIndicatorProps {
  status: SyncStatus
  message?: string
  /** Auto-hide after this many ms (default: 3000). Set to 0 to disable auto-hide */
  autoHideDuration?: number
  /** Called when the indicator hides */
  onHide?: () => void
}

/**
 * Subtle sync status indicator that appears briefly after save operations
 * Shows syncing spinner, success checkmark, or error state
 */
export default function SyncIndicator({ 
  status, 
  message,
  autoHideDuration = 3000,
  onHide 
}: SyncIndicatorProps) {
  const { theme } = useTheme()
  const [visible, setVisible] = useState(false)
  const [currentStatus, setCurrentStatus] = useState<SyncStatus>('idle')

  useEffect(() => {
    if (status === 'idle') {
      setVisible(false)
      return
    }

    setCurrentStatus(status)
    setVisible(true)

    // Auto-hide after success (not during syncing or error)
    if (status === 'synced' && autoHideDuration > 0) {
      const timer = setTimeout(() => {
        setVisible(false)
        onHide?.()
      }, autoHideDuration)
      return () => clearTimeout(timer)
    }
  }, [status, autoHideDuration, onHide])

  if (!visible) return null

  const getIcon = () => {
    switch (currentStatus) {
      case 'syncing':
        return <Loader2 className="w-4 h-4 animate-spin" />
      case 'synced':
        return <CheckCircle className="w-4 h-4" />
      case 'error':
        return <AlertCircle className="w-4 h-4" />
      default:
        return null
    }
  }

  const getMessage = () => {
    if (message) return message
    switch (currentStatus) {
      case 'syncing':
        return 'Saving...'
      case 'synced':
        return 'Saved to profile'
      case 'error':
        return 'Failed to save'
      default:
        return ''
    }
  }

  const getStyles = () => {
    const base = 'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-300'
    
    if (theme === 'dark') {
      switch (currentStatus) {
        case 'syncing':
          return `${base} bg-gray-700/50 text-white border border-gray-600`
        case 'synced':
          return `${base} bg-green-900/40 text-green-400 border border-green-500/40`
        case 'error':
          return `${base} bg-red-900/40 text-red-400 border border-red-500/40`
        default:
          return base
      }
    } else {
      switch (currentStatus) {
        case 'syncing':
          return `${base} bg-gray-100 text-gray-600 border border-gray-200`
        case 'synced':
          return `${base} bg-green-50 text-green-700 border border-green-200`
        case 'error':
          return `${base} bg-red-50 text-red-700 border border-red-200`
        default:
          return base
      }
    }
  }

  return (
    <div 
      className={`${getStyles()} animate-in fade-in slide-in-from-top-2 duration-200`}
      role="status"
      aria-live="polite"
    >
      {getIcon()}
      <span>{getMessage()}</span>
    </div>
  )
}

/**
 * Hook to manage sync indicator state
 * Returns status, trigger functions, and the SyncIndicator component props
 */
export function useSyncIndicator() {
  const [status, setStatus] = useState<SyncStatus>('idle')
  const [message, setMessage] = useState<string | undefined>()

  const startSync = useCallback((customMessage?: string) => {
    setMessage(customMessage)
    setStatus('syncing')
  }, [])

  const syncSuccess = useCallback((customMessage?: string) => {
    setMessage(customMessage)
    setStatus('synced')
  }, [])

  const syncError = useCallback((customMessage?: string) => {
    setMessage(customMessage)
    setStatus('error')
  }, [])

  const reset = useCallback(() => {
    setStatus('idle')
    setMessage(undefined)
  }, [])

  return {
    status,
    message,
    startSync,
    syncSuccess,
    syncError,
    reset,
    indicatorProps: { status, message, onHide: reset }
  }
}
