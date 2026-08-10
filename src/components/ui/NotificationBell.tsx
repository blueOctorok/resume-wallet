'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useEffect, useRef, useState } from 'react'
import { Bell, BriefcaseBusiness, UserCheck, ShieldCheck, Users, FileText, ClipboardCheck, MessageSquare, X, CheckCheck, Sparkles, CalendarClock } from 'lucide-react'
import { useNotificationStore, type AppNotification } from '@/stores/notification-store'
import { useTheme } from '@/contexts/ThemeContext'
import { useUIStore } from '@/stores'
import { cn } from '@/lib/utils'
import { navControlButtonClass } from '@/lib/navigation-styles'

interface NotificationBellProps {
  sessionUserId: string
  /**
   * Controlled open — used when the panel is triggered from Options instead of
   * the standalone bell button. When set, `onOpenChange` must also be provided.
   */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Hide the nav bell trigger (panel still renders when open). */
  hideTrigger?: boolean
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

function typeChipClass(type: string) {
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

export default function NotificationBell({
  sessionUserId,
  open: openProp,
  onOpenChange,
  hideTrigger = false,
}: NotificationBellProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const isControlled = openProp !== undefined
  const isOpen = isControlled ? openProp : uncontrolledOpen
  const setIsOpen = (next: boolean) => {
    if (isControlled) onOpenChange?.(next)
    else setUncontrolledOpen(next)
  }

  const dropdownRef = useRef<HTMLDivElement>(null)
  const { theme } = useTheme()
  const { notifications, unreadCount, loading, fetchNotifications, markRead, markAllRead } =
    useNotificationStore()

  // Fetch on mount, then poll every 60 seconds.
  // Pauses when the tab is hidden so it doesn't hammer the server in the background.
  useEffect(() => {
    fetchNotifications(sessionUserId)

    let interval: ReturnType<typeof setInterval> | null = null

    const start = () => {
      if (!interval) {
        interval = setInterval(() => fetchNotifications(sessionUserId), 60_000)
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
  }, [sessionUserId, fetchNotifications])

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen])

  const handleNotificationClick = (n: AppNotification) => {
    if (!n.read) markRead(n.id, sessionUserId)
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

  const panel = isOpen ? (
    <div
      ref={hideTrigger ? dropdownRef : undefined}
      className={cn(
        'absolute right-0 top-full mt-2 w-80 overflow-hidden rounded-xl border shadow-2xl z-[200] animate-menu-pop origin-top-right',
        isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200',
      )}
    >
      <div
        className={cn(
          'flex items-center justify-between border-b px-4 py-3',
          isDark ? 'border-gray-700' : 'border-gray-100',
        )}
      >
        <span className={cn('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
          Notifications
        </span>
        <div className='flex items-center gap-2'>
          {unreadCount > 0 && (
            <button
              type='button'
              onClick={() => markAllRead(sessionUserId)}
              className={cn(
                'flex cursor-pointer items-center gap-1 text-xs font-medium transition-colors',
                isDark ? 'text-teal-400 hover:text-teal-300' : 'text-teal-600 hover:text-teal-700',
              )}
              title='Mark all as read'
            >
              <CheckCheck className='h-3.5 w-3.5' />
              Mark all read
            </button>
          )}
          <button
            type='button'
            onClick={() => setIsOpen(false)}
            className={cn(
              'cursor-pointer rounded p-0.5',
              isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600',
            )}
          >
            <X className='h-3.5 w-3.5' />
          </button>
        </div>
      </div>

      <div className='max-h-[360px] overflow-y-auto'>
        {loading && notifications.length === 0 ? (
          <div className={cn('px-4 py-8 text-center text-sm', isDark ? 'text-gray-500' : 'text-gray-400')}>
            Loading…
          </div>
        ) : notifications.length === 0 ? (
          <div className={cn('px-4 py-8 text-center', isDark ? 'text-gray-500' : 'text-gray-400')}>
            <Bell className='mx-auto mb-2 h-8 w-8 opacity-30' />
            <p className='text-sm'>No notifications yet</p>
          </div>
        ) : (
          notifications.map((n) => (
            <button
              key={n.id}
              type='button'
              onClick={() => handleNotificationClick(n)}
              className={cn(
                'flex w-full cursor-pointer gap-3 border-b px-4 py-3 text-left transition-colors',
                isDark
                  ? `border-gray-800 hover:bg-gray-800 ${!n.read ? 'bg-gray-800/60' : ''}`
                  : `border-gray-50 hover:bg-gray-50 ${!n.read ? 'bg-teal-50/60' : ''}`,
              )}
            >
              <div
                className={cn(
                  'mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg',
                  typeChipClass(n.type),
                )}
              >
                {TYPE_ICON[n.type] ?? <Bell className='h-4 w-4' />}
              </div>
              <div className='min-w-0 flex-1'>
                <div className='flex items-start justify-between gap-2'>
                  <p className={cn('truncate text-xs font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
                    {n.title}
                  </p>
                  {!n.read && <span className='mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-teal-500' />}
                </div>
                <p className={cn('mt-0.5 line-clamp-2 text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>
                  {n.body}
                </p>
                <p className={cn('mt-1 text-[10px]', isDark ? 'text-gray-600' : 'text-gray-400')}>
                  {timeAgo(n.created_at)}
                </p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  ) : null

  // Options-owned trigger: panel anchors to the parent Options `relative` root.
  // Still mount (hooks above) when closed so polling keeps running.
  if (hideTrigger) return panel

  return (
    <div ref={dropdownRef} className='relative'>
      <button
        type='button'
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        className={cn(
          'relative flex h-9 w-9 cursor-pointer items-center justify-center',
          navControlButtonClass(isDark),
        )}
      >
        <Bell className='h-4 w-4' />
        {unreadCount > 0 && (
          <span
            className={cn(
              'absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 bg-teal-500 px-1 text-[10px] font-bold text-white',
              isDark ? 'border-gray-950' : 'border-white',
            )}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {panel}
    </div>
  )
}
