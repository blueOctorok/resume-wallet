'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useEffect, useRef, useState } from 'react'
import { Bell, BriefcaseBusiness, UserCheck, ShieldCheck, Users, FileText, ClipboardCheck, MessageSquare, X, CheckCheck, Sparkles, CalendarClock } from 'lucide-react'
import { useNotificationStore, type AppNotification } from '@/stores/notification-store'
import { useTheme, type Theme } from '@/contexts/ThemeContext'
import { useUIStore } from '@/stores'
import { cn } from '@/lib/utils'
import { navControlButtonClass } from '@/lib/navigation-styles'

interface NotificationBellProps {
  walletAddress: string
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  application_status:     <BriefcaseBusiness className='w-4 h-4' />,
  application_follow_up:  <CalendarClock className='w-4 h-4' />,
  candidate_request:      <UserCheck className='w-4 h-4' />,
  employment_verification:<ShieldCheck className='w-4 h-4' />,
  team_invite:            <Users className='w-4 h-4' />,
  new_application:        <FileText className='w-4 h-4' />,
  consent_signed:         <ClipboardCheck className='w-4 h-4' />,
  new_message:            <MessageSquare className='w-4 h-4' />,
  job_match:              <Sparkles className='w-4 h-4' />,
}

const TYPE_COLOR: Record<string, string> = {
  application_status:      'bg-teal-500/20 text-teal-400',
  application_follow_up:   'bg-violet-500/20 text-violet-400',
  candidate_request:       'bg-blue-500/20 text-blue-400',
  employment_verification: 'bg-green-500/20 text-green-400',
  team_invite:             'bg-purple-500/20 text-purple-400',
  new_application:         'bg-orange-500/20 text-orange-400',
  consent_signed:          'bg-teal-500/20 text-teal-400',
  new_message:             'bg-blue-500/20 text-blue-400',
  job_match:               'bg-sky-500/20 text-sky-400',
}

const TYPE_COLOR_PAPER = 'bg-zinc-200/90 text-zinc-700'

function typeChipClass(type: string, isDark: boolean, appTheme: Theme) {
  if (!isDark && appTheme === 'paper') return TYPE_COLOR_PAPER
  return TYPE_COLOR[type] ?? 'bg-gray-500/20 text-gray-400'
}

function timeAgo(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export default function NotificationBell({ walletAddress }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { theme } = useTheme()
  const { notifications, unreadCount, loading, fetchNotifications, markRead, markAllRead } =
    useNotificationStore()

  // Fetch on mount, then poll every 60 seconds.
  // Pauses when the tab is hidden so it doesn't hammer the server in the background.
  useEffect(() => {
    fetchNotifications(walletAddress)

    let interval: ReturnType<typeof setInterval> | null = null

    const start = () => {
      if (!interval) {
        interval = setInterval(() => fetchNotifications(walletAddress), 60_000)
      }
    }
    const stop = () => {
      if (interval) { clearInterval(interval); interval = null }
    }

    start()
    document.addEventListener('visibilitychange', () =>
      document.hidden ? stop() : start()
    )
    return () => {
      stop()
      document.removeEventListener('visibilitychange', stop)
    }
  }, [walletAddress, fetchNotifications])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleOpen = () => {
    setIsOpen((prev) => !prev)
  }

  const handleNotificationClick = (n: AppNotification) => {
    if (!n.read) markRead(n.id, walletAddress)
    setIsOpen(false)

    // Message notifications navigate in-app to the specific thread
    if (n.type === 'new_message') {
      const threadId = (n.data as { threadId?: string })?.threadId ?? null
      navigateToMessages(threadId)
      return
    }

    if (n.action_url) window.location.href = n.action_url
  }

  const { navigateToMessages } = useUIStore()
  const isDark = isDarkTheme(theme)
  const isPaperLight = !isDark && theme === 'paper'

  return (
    <div ref={dropdownRef} className='relative'>
      {/* Bell button */}
      <button
        type='button'
        onClick={handleOpen}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        className={cn(
          'relative flex items-center justify-center w-9 h-9 cursor-pointer',
          navControlButtonClass(isDark, theme),
        )}
      >
        <Bell className='w-4 h-4' />
        {unreadCount > 0 && (
          <span
            className={cn(
              'absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-white text-[10px] font-bold rounded-full border-2',
              isPaperLight ? 'bg-zinc-700' : 'bg-teal-500',
              isDark ? 'border-gray-950' : 'border-white',
            )}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className={`absolute right-0 top-full mt-2 w-80 rounded-xl shadow-2xl border overflow-hidden z-[200] ${
            isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
          }`}
        >
          {/* Header */}
          <div className={`flex items-center justify-between px-4 py-3 border-b ${
            isDark ? 'border-gray-700' : 'border-gray-100'
          }`}>
            <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Notifications
            </span>
            <div className='flex items-center gap-2'>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllRead(walletAddress)}
                  className={`flex items-center gap-1 text-xs font-medium transition-colors cursor-pointer ${
                    isDark
                      ? 'text-teal-400 hover:text-teal-300'
                      : isPaperLight
                        ? 'text-zinc-600 hover:text-zinc-900'
                        : 'text-teal-600 hover:text-teal-700'
                  }`}
                  title='Mark all as read'
                >
                  <CheckCheck className='w-3.5 h-3.5' />
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className={`p-0.5 rounded cursor-pointer ${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <X className='w-3.5 h-3.5' />
              </button>
            </div>
          </div>

          {/* List */}
          <div className='max-h-[360px] overflow-y-auto'>
            {loading && notifications.length === 0 ? (
              <div className={`px-4 py-8 text-center text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                Loading…
              </div>
            ) : notifications.length === 0 ? (
              <div className={`px-4 py-8 text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                <Bell className='w-8 h-8 mx-auto mb-2 opacity-30' />
                <p className='text-sm'>No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`w-full text-left px-4 py-3 flex gap-3 border-b transition-colors cursor-pointer ${
                    isDark
                      ? `border-gray-800 hover:bg-gray-800 ${!n.read ? 'bg-gray-800/60' : ''}`
                      : isPaperLight
                        ? `border-zinc-100 hover:bg-zinc-50 ${!n.read ? 'bg-zinc-100/80' : ''}`
                        : `border-gray-50 hover:bg-gray-50 ${!n.read ? 'bg-teal-50/60' : ''}`
                  }`}
                >
                  {/* Type icon */}
                  <div
                    className={`flex-shrink-0 mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center ${typeChipClass(
                      n.type,
                      isDark,
                      theme,
                    )}`}
                  >
                    {TYPE_ICON[n.type] ?? <Bell className='w-4 h-4' />}
                  </div>

                  {/* Content */}
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-start justify-between gap-2'>
                      <p className={`text-xs font-semibold truncate ${
                        isDark ? 'text-white' : 'text-gray-900'
                      }`}>
                        {n.title}
                      </p>
                      {!n.read && (
                        <span
                          className={`flex-shrink-0 w-1.5 h-1.5 mt-1 rounded-full ${
                            isPaperLight ? 'bg-zinc-500' : 'bg-teal-500'
                          }`}
                        />
                      )}
                    </div>
                    <p className={`text-xs mt-0.5 line-clamp-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {n.body}
                    </p>
                    <p className={`text-[10px] mt-1 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                      {timeAgo(n.created_at)}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
