'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useState, useEffect } from 'react'
import { useTheme } from '@/contexts/ThemeContext'

interface MvrStatusBadgeProps {
  sessionUserId: string | null
}

type MvrDisplayStatus = 'loading' | 'none' | 'processing' | 'available'

/**
 * Simple MVR status badge for the navigation bar.
 * Shows: "No MVR" | "Processing" | "Available"
 * Non-clickable - just informational. Use Hub for MVR actions.
 */
export default function MvrStatusBadge({ sessionUserId }: MvrStatusBadgeProps) {
  const { theme } = useTheme()
  const [status, setStatus] = useState<MvrDisplayStatus>('loading')

  useEffect(() => {
    if (!sessionUserId) {
      setStatus('none')
      return
    }

    const fetchStatus = async () => {
      try {
        const response = await fetch('/api/mvr/check-status')
        
        if (!response.ok) {
          setStatus('none')
          return
        }

        const data = await response.json()
        
        if (!data.hasMvr) {
          setStatus('none')
        } else if (data.result?.resultStatus === 'parsed') {
          setStatus('available')
        } else {
          setStatus('processing')
        }
      } catch {
        setStatus('none')
      }
    }

    fetchStatus()
    // Refresh every 30 seconds to catch status updates
    const interval = setInterval(fetchStatus, 30000)
    return () => clearInterval(interval)
  }, [sessionUserId])

  // Badge styling based on status
  const getBadgeStyles = () => {
    switch (status) {
      case 'loading':
        return isDarkTheme(theme)
          ? 'bg-gray-700/50 text-gray-400 border-gray-600'
          : 'bg-gray-100 text-gray-500 border-gray-300'
      case 'none':
        return isDarkTheme(theme)
          ? 'bg-gray-700/50 text-gray-400 border-gray-600'
          : 'bg-gray-100 text-gray-500 border-gray-300'
      case 'processing':
        return isDarkTheme(theme)
          ? 'bg-yellow-900/30 text-yellow-400 border-yellow-600/50'
          : 'bg-yellow-100 text-yellow-700 border-yellow-300'
      case 'available':
        return isDarkTheme(theme)
          ? 'bg-green-900/30 text-green-400 border-green-600/50'
          : 'bg-green-100 text-green-700 border-green-300'
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'loading':
        return 'MVR: ...'
      case 'none':
        return 'No MVR'
      case 'processing':
        return 'MVR: Processing'
      case 'available':
        return 'MVR: Available'
    }
  }

  return (
    <div
      className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${getBadgeStyles()}`}
    >
      {getStatusText()}
    </div>
  )
}
