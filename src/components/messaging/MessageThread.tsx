'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, Loader2, AlertCircle, MessageSquare } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import Avatar from '@/components/ui/Avatar'
import BackToHubButton from '@/components/ui/BackToHubButton'

interface Message {
  id: string
  senderId: string
  body: string
  readAt: string | null
  createdAt: string
  isMine: boolean
}

interface ThreadData {
  id: string
  subject: string
  applicationId: string | null
  candidateRequestId: string | null
  otherParticipant: {
    userId: string
    name: string
    role: string | null
    avatarUrl: string | null
  }
}

interface MessageThreadProps {
  threadId: string
  sessionUserId: string
  onBack: () => void
}

function timeLabel(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  // Older: show date
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/**
 * MessageThread
 *
 * Full conversation view. Polls every 5 seconds for new messages so the
 * inbox feels live without Supabase Realtime plumbing.
 * Scroll anchors to the bottom automatically on new messages.
 */
export default function MessageThread({ threadId, sessionUserId, onBack }: MessageThreadProps) {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)

  const [thread, setThread] = useState<ThreadData | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lastMessageCountRef = useRef(0)

  const fetchMessages = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await fetch(`/api/messages/${threadId}`)
      if (!res.ok) throw new Error('Failed to load messages')
      const data = await res.json()
      setThread(data.thread)
      setMessages(data.messages)
      setError(null)
    } catch (err) {
      if (!silent) setError(err instanceof Error ? err.message : 'Error')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [threadId, sessionUserId])

  // Initial load
  useEffect(() => { fetchMessages() }, [fetchMessages])

  // Poll every 5s while the thread is open
  useEffect(() => {
    const interval = setInterval(() => fetchMessages(true), 5_000)
    return () => clearInterval(interval)
  }, [fetchMessages])

  // Scroll to bottom whenever new messages arrive
  useEffect(() => {
    if (messages.length !== lastMessageCountRef.current) {
      lastMessageCountRef.current = messages.length
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages.length])

  const handleSend = async () => {
    if (!draft.trim() || sending) return
    setSendError(null)
    setSending(true)
    try {
      const res = await fetch(`/api/messages/${threadId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json',
        },
        body: JSON.stringify({ body: draft.trim() }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || 'Failed to send')
      }
      const { message } = await res.json()
      setMessages(prev => [...prev, message])
      setDraft('')
      textareaRef.current?.focus()
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Error sending message')
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl/Cmd + Enter to send; plain Enter adds a newline
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSend()
    }
  }

  const cardBg = isDark ? 'bg-gray-900' : 'bg-white'
  const borderCls = isDark ? 'border-gray-700' : 'border-gray-200'

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-64 ${cardBg} rounded-2xl`}>
        <Loader2 className='w-6 h-6 animate-spin text-blue-400' />
      </div>
    )
  }

  if (error || !thread) {
    return (
      <div className={`flex flex-col items-center justify-center h-64 gap-3 ${cardBg} rounded-2xl`}>
        <AlertCircle className='w-8 h-8 text-red-400' />
        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{error || 'Thread not found'}</p>
        <button onClick={onBack} className='text-sm text-blue-400 hover:underline'>Go back</button>
      </div>
    )
  }

  const otherColor = thread.otherParticipant.role === 'employer' ? 'indigo' : 'teal'

  return (
    <div className={`flex flex-col h-full rounded-2xl overflow-hidden border ${borderCls} ${cardBg}`}>
      {/* Header */}
      <div className={`flex items-center gap-3 px-4 py-3 border-b ${borderCls} ${isDark ? 'bg-gray-800/50' : 'bg-gray-50'}`}>
        <BackToHubButton onClick={onBack} label='Back to Inbox' />

        <Avatar
          name={thread.otherParticipant.name}
          avatarUrl={thread.otherParticipant.avatarUrl}
          size='sm'
          color={otherColor}
        />

        <div className='flex-1 min-w-0'>
          <p className={`text-sm font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {thread.otherParticipant.name}
          </p>
          <p className={`text-xs truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {thread.subject}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className='flex-1 overflow-y-auto p-4 space-y-3 min-h-0'>
        {messages.length === 0 && (
          <div className={`flex flex-col items-center justify-center h-32 gap-2 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
            <MessageSquare className='w-8 h-8 opacity-40' />
            <p className='text-sm'>No messages yet. Say hello!</p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.isMine ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                msg.isMine
                  ? isDark
                    ? 'bg-blue-600 text-white rounded-br-sm'
                    : 'bg-blue-600 text-white rounded-br-sm'
                  : isDark
                    ? 'bg-gray-800 text-gray-100 rounded-bl-sm'
                    : 'bg-gray-100 text-gray-900 rounded-bl-sm'
              }`}
            >
              <p className='text-sm whitespace-pre-wrap break-words'>{msg.body}</p>
              <p className={`text-[10px] mt-1 ${msg.isMine ? 'text-blue-200' : isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                {timeLabel(msg.createdAt)}
                {msg.isMine && msg.readAt && (
                  <span className='ml-1 opacity-70'>· read</span>
                )}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Compose */}
      <div className={`border-t ${borderCls} p-3`}>
        {sendError && (
          <p className='text-xs text-red-500 mb-2 px-1'>{sendError}</p>
        )}
        <div className='flex gap-2 items-end'>
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder='Type a message… (Ctrl+Enter to send)'
            rows={2}
            maxLength={4000}
            className={`flex-1 resize-none rounded-xl px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              isDark
                ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
                : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
            }`}
          />
          <button
            onClick={handleSend}
            disabled={sending || !draft.trim()}
            className={`flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-xl transition-colors ${
              sending || !draft.trim()
                ? isDark ? 'bg-gray-700 text-gray-500' : 'bg-gray-100 text-gray-400'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {sending
              ? <Loader2 className='w-4 h-4 animate-spin' />
              : <Send className='w-4 h-4' />
            }
          </button>
        </div>
      </div>
    </div>
  )
}
