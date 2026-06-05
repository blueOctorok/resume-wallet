'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useState, useEffect, useCallback } from 'react'
import { Loader2, AlertCircle, MessageSquare, Inbox } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import Avatar from '@/components/ui/Avatar'
import MessageThread from './MessageThread'
import type { AvatarColor } from '@/components/ui/Avatar'

interface ThreadSummary {
  id: string
  subject: string
  lastMessageAt: string | null
  lastMessagePreview: string | null
  createdAt: string
  applicationId: string | null
  candidateRequestId: string | null
  otherParticipant: {
    userId: string
    name: string
    role: string | null
    avatarUrl: string | null
  }
  unreadCount: number
}

interface MessageInboxProps {
  sessionUserId: string
  /** Called when user navigates back to their hub */
  onBack: () => void
  /** If set, opens this thread immediately on mount (e.g. from notification click) */
  initialThreadId?: string | null
}

function timeLabel(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

/**
 * MessageInbox
 *
 * Full-page inbox showing all the user's threads. Clicking a thread
 * swaps to MessageThread in-place. The back button in MessageThread
 * returns here; the back button here calls onBack (returns to hub).
 *
 * Refreshes the thread list every 15 seconds (matching notification poll).
 */
export default function MessageInbox({ sessionUserId, onBack, initialThreadId }: MessageInboxProps) {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)

  const [threads, setThreads] = useState<ThreadSummary[]>([])
  const [totalUnread, setTotalUnread] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeThreadId, setActiveThreadId] = useState<string | null>(initialThreadId ?? null)

  const fetchThreads = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await fetch('/api/messages')
      if (!res.ok) throw new Error('Failed to load inbox')
      const data = await res.json()
      setThreads(data.threads)
      setTotalUnread(data.totalUnread)
      setError(null)
    } catch (err) {
      if (!silent) setError(err instanceof Error ? err.message : 'Error')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [sessionUserId])

  useEffect(() => { fetchThreads() }, [fetchThreads])

  // Poll every 15s for new threads (same cadence as notification bell)
  useEffect(() => {
    const interval = setInterval(() => fetchThreads(true), 15_000)
    return () => clearInterval(interval)
  }, [fetchThreads])

  const cardBg = isDark ? 'bg-gray-900' : 'bg-white'
  const borderCls = isDark ? 'border-gray-700' : 'border-gray-200'
  const mutedText = isDark ? 'text-gray-400' : 'text-gray-500'

  // ── Thread view ────────────────────────────────────────────────────────────
  if (activeThreadId) {
    return (
      <div className='max-w-2xl mx-auto h-[calc(100vh-160px)]'>
        <MessageThread
          threadId={activeThreadId}
          sessionUserId={sessionUserId}
          onBack={() => {
            setActiveThreadId(null)
            fetchThreads(true) // refresh unread counts after reading
          }}
        />
      </div>
    )
  }

  // ── Inbox list ─────────────────────────────────────────────────────────────
  return (
    <div className='max-w-2xl mx-auto space-y-4'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-3'>
          <button
            onClick={onBack}
            className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
              isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            ← Back
          </button>
          <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Messages
            {totalUnread > 0 && (
              <span className='ml-2 px-2 py-0.5 text-xs font-bold rounded-full bg-blue-600 text-white'>
                {totalUnread}
              </span>
            )}
          </h1>
        </div>
      </div>

      {/* Content */}
      <div className={`rounded-2xl border overflow-hidden ${cardBg} ${borderCls}`}>
        {loading ? (
          <div className='flex items-center justify-center py-16'>
            <Loader2 className='w-6 h-6 animate-spin text-blue-400' />
          </div>
        ) : error ? (
          <div className='flex flex-col items-center justify-center py-16 gap-2'>
            <AlertCircle className='w-8 h-8 text-red-400' />
            <p className={`text-sm ${mutedText}`}>{error}</p>
          </div>
        ) : threads.length === 0 ? (
          <div className='flex flex-col items-center justify-center py-16 gap-3'>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
              <Inbox className={`w-7 h-7 ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
            </div>
            <div className='text-center'>
              <p className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>No messages yet</p>
              <p className={`text-sm mt-1 ${mutedText}`}>
                Conversations will appear here once an employer or candidate starts a thread.
              </p>
            </div>
          </div>
        ) : (
          <ul>
            {threads.map((thread, idx) => {
              const isLast = idx === threads.length - 1
              const otherRole = thread.otherParticipant.role
              const avatarColor: AvatarColor = otherRole === 'employer' ? 'indigo' : 'teal'

              return (
                <li key={thread.id}>
                  <button
                    onClick={() => setActiveThreadId(thread.id)}
                    className={`w-full text-left px-4 py-3.5 flex gap-3 transition-colors ${
                      isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-50'
                    } ${thread.unreadCount > 0 ? (isDark ? 'bg-blue-500/5' : 'bg-blue-50/40') : ''} ${
                      !isLast ? `border-b ${borderCls}` : ''
                    }`}
                  >
                    <Avatar
                      name={thread.otherParticipant.name}
                      avatarUrl={thread.otherParticipant.avatarUrl}
                      size='md'
                      color={avatarColor}
                    />

                    <div className='flex-1 min-w-0'>
                      <div className='flex items-start justify-between gap-2'>
                        <p className={`text-sm font-semibold truncate ${
                          isDark ? 'text-white' : 'text-gray-900'
                        }`}>
                          {thread.otherParticipant.name}
                        </p>
                        <div className='flex items-center gap-1.5 flex-shrink-0'>
                          {thread.unreadCount > 0 && (
                            <span className='flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-blue-600 text-white text-[10px] font-bold rounded-full'>
                              {thread.unreadCount}
                            </span>
                          )}
                          {thread.lastMessageAt && (
                            <span className={`text-[10px] ${mutedText}`}>
                              {timeLabel(thread.lastMessageAt)}
                            </span>
                          )}
                        </div>
                      </div>

                      <p className={`text-xs truncate mt-0.5 ${
                        thread.unreadCount > 0
                          ? isDark ? 'text-gray-200 font-medium' : 'text-gray-700 font-medium'
                          : mutedText
                      }`}>
                        {thread.subject}
                      </p>

                      {thread.lastMessagePreview && (
                        <p className={`text-xs truncate mt-0.5 ${mutedText}`}>
                          {thread.lastMessagePreview}
                        </p>
                      )}
                    </div>

                    <MessageSquare className={`w-4 h-4 flex-shrink-0 mt-1 ${mutedText} opacity-40`} />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
