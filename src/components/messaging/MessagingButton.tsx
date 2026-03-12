'use client'

import { useState } from 'react'
import { MessageSquare, Loader2 } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'

interface MessagingButtonProps {
  /** The other participant's user ID */
  otherUserId: string
  /** Context anchor — at least one required */
  applicationId?: string
  candidateRequestId?: string
  /** Human-readable subject auto-shown in the thread header */
  subject: string
  walletAddress: string
  /** Called with the resolved threadId once the thread exists */
  onThreadOpen: (threadId: string) => void
  /** Visual variant */
  variant?: 'button' | 'icon'
  className?: string
}

/**
 * MessagingButton
 *
 * Thin trigger component. On click it POSTs to /api/messages to get or
 * create a thread, then calls onThreadOpen(threadId) so the parent can
 * open MessageInbox/MessageThread.
 */
export default function MessagingButton({
  otherUserId,
  applicationId,
  candidateRequestId,
  subject,
  walletAddress,
  onThreadOpen,
  variant = 'button',
  className = '',
}: MessagingButtonProps) {
  const { theme } = useTheme()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isDark = theme === 'dark'

  const handleClick = async () => {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': walletAddress,
        },
        body: JSON.stringify({ otherUserId, applicationId, candidateRequestId, subject }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to open conversation')
      }

      const { threadId } = await res.json()
      onThreadOpen(threadId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  if (variant === 'icon') {
    return (
      <button
        onClick={handleClick}
        disabled={loading}
        title={error || 'Message'}
        className={`p-2 rounded-lg transition-colors ${
          isDark
            ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
            : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
        } ${className}`}
      >
        {loading
          ? <Loader2 className='w-4 h-4 animate-spin' />
          : <MessageSquare className='w-4 h-4' />
        }
      </button>
    )
  }

  return (
    <div className={className}>
      <button
        onClick={handleClick}
        disabled={loading}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          isDark
            ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30'
            : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
        }`}
      >
        {loading
          ? <Loader2 className='w-4 h-4 animate-spin' />
          : <MessageSquare className='w-4 h-4' />
        }
        Message
      </button>
      {error && (
        <p className='text-xs text-red-500 mt-1'>{error}</p>
      )}
    </div>
  )
}
