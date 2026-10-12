'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import Button from '@/components/ui/Button'
import { getBlockDefinition } from '@/lib/block-registry'
import { useNotificationStore, type AppNotification } from '@/stores/notification-store'
import { useUIStore } from '@/stores'
import type { PageType } from '@/stores/types'

/**
 * Employer → driver asks, sitting on the career card.
 *
 * Two sources, on purpose. A pending request stays until the driver answers it,
 * even after the bell notification is marked read. Other employer notifications
 * (a message, an application update) have no request row, so they stay while unread.
 */

const EMPLOYER_TO_DRIVER = new Set([
  'candidate_request',
  'ev_share_request',
  'employment_verification',
  'application_status',
  'application_follow_up',
  'new_message',
])

const SCREENING_BLOCKS = new Set([
  'driver-screening-consent',
  'driver-mvr',
  'driver-psp',
])

interface PendingAsk {
  id: string
  requestType: string
  targetBlockType: string | null
  status: string
  company: { name?: string | null } | null
}

function companyOf(ask: PendingAsk): string {
  return ask.company?.name?.trim() || 'An employer'
}

function isScreeningAsk(ask: PendingAsk): boolean {
  if (ask.requestType === 'mvr_order' || ask.requestType === 'psp_order') return true
  return ask.requestType === 'block_request' && SCREENING_BLOCKS.has(ask.targetBlockType ?? '')
}

function askHeadline(ask: PendingAsk): string {
  const company = companyOf(ask)
  if (ask.targetBlockType === 'driver-dot-application') {
    return `${company} wants to see your DOT application`
  }
  if (isScreeningAsk(ask)) return `${company} wants you to complete screening`
  const label = ask.targetBlockType ? getBlockDefinition(ask.targetBlockType)?.label : null
  if (label) return `${company} wants your ${label}`
  return `${company} sent you a request`
}

function textField(data: Record<string, unknown>, key: string): string | null {
  const value = data[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function openNotification(
  n: AppNotification,
  sessionUserId: string,
  markRead: (id: string, sessionUserId: string) => Promise<void>,
  setCurrentPage: (page: PageType) => void,
  navigateToMessages: (threadId: string | null) => void,
) {
  if (!n.read) void markRead(n.id, sessionUserId)
  if (n.type === 'new_message') {
    const threadId = textField(n.data, 'threadId')
    navigateToMessages(threadId)
    return
  }
  const url = n.action_url
  if (!url) return
  try {
    const parsed = new URL(url, window.location.origin)
    const onboard = parsed.searchParams.get('onboard')
    const page = parsed.searchParams.get('page')
    const target = onboard || page
    if (target) {
      setCurrentPage(target as PageType)
      return
    }
  } catch {
    // Fall through to a full navigation for anything that isn't an in-app link.
  }
  window.location.href = url
}

interface EmployerAskBannerProps {
  sessionUserId: string
  isDark: boolean
}

export default function EmployerAskBanner({ sessionUserId, isDark }: EmployerAskBannerProps) {
  const notifications = useNotificationStore((s) => s.notifications)
  const markRead = useNotificationStore((s) => s.markRead)
  const setCurrentPage = useUIStore((s) => s.setCurrentPage)
  const navigateToMessages = useUIStore((s) => s.navigateToMessages)
  const [asks, setAsks] = useState<PendingAsk[]>([])
  const [sharingId, setSharingId] = useState<string | null>(null)
  const [shareError, setShareError] = useState<string | null>(null)

  const loadAsks = useCallback(async () => {
    try {
      const res = await fetch('/api/candidate/requests')
      if (!res.ok) return
      const data = (await res.json()) as { requests?: PendingAsk[] }
      const pending = (data.requests ?? []).filter(
        (r) => r.status === 'pending' || r.status === 'viewed',
      )
      setAsks(pending)
    } catch (err) {
      console.error('[EMPLOYER ASK] Failed to load requests:', err)
    }
  }, [])

  useEffect(() => {
    void loadAsks()
  }, [loadAsks])

  const shareDotApp = async (requestId: string) => {
    setShareError(null)
    setSharingId(requestId)
    try {
      const res = await fetch(`/api/candidate/requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      })
      if (!res.ok) throw new Error('share failed')
      const notice = notifications.find((n) => textField(n.data, 'requestId') === requestId)
      if (notice && !notice.read) await markRead(notice.id, sessionUserId)
      await loadAsks()
    } catch {
      setShareError('Could not share that file. Open notifications and try from there.')
    } finally {
      setSharingId(null)
    }
  }

  const pendingIds = new Set(asks.map((a) => a.id))
  const otherNotices = notifications.filter((n) => {
    if (n.read || !EMPLOYER_TO_DRIVER.has(n.type)) return false
    const requestId = textField(n.data, 'requestId')
    return !requestId || !pendingIds.has(requestId)
  })

  if (asks.length === 0 && otherNotices.length === 0) return null

  const rowClass = cn(
    'flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left',
    isDark
      ? 'border-dark-amber/40 bg-dark-amber/15'
      : 'border-dark-amber/35 bg-dark-amber/10',
  )
  const titleClass = cn(
    'block text-sm font-semibold',
    isDark ? 'text-amber-50' : 'text-[#173150]',
  )
  const kickerClass = cn(
    'block text-[11px] font-semibold uppercase tracking-wide',
    isDark ? 'text-dark-amber' : 'text-dark-amber',
  )

  return (
    <div className='mb-4 space-y-2'>
      {asks.map((ask) => {
        const isDot = ask.targetBlockType === 'driver-dot-application'
        const openAsk = () => {
          // The file ask is an accept or decline, not a form. Inbox holds the full request.
          if (isDot) {
            setCurrentPage('inbox')
            return
          }
          if (isScreeningAsk(ask)) {
            setCurrentPage('screening-consent')
            return
          }
          const route = ask.targetBlockType
            ? getBlockDefinition(ask.targetBlockType)?.pageRoute
            : null
          setCurrentPage((route ?? 'inbox') as PageType)
        }
        return (
          <div key={ask.id} className={rowClass}>
            <button type='button' onClick={openAsk} className='min-w-0 flex-1 text-left'>
              <span className={kickerClass}>Employer request</span>
              <span className={titleClass}>{askHeadline(ask)}</span>
            </button>
            {isDot ? (
              <Button
                type='button'
                variant='primary'
                size='sm'
                className='shrink-0'
                isLoading={sharingId === ask.id}
                onClick={() => void shareDotApp(ask.id)}
              >
                Share
              </Button>
            ) : (
              <button
                type='button'
                onClick={openAsk}
                className={cn('shrink-0', isDark ? 'text-amber-50' : 'text-[#173150]')}
                aria-label='Open request'
              >
                <ArrowRight className='h-4 w-4' />
              </button>
            )}
          </div>
        )
      })}

      {otherNotices.map((n) => (
        <button
          key={n.id}
          type='button'
          onClick={() =>
            openNotification(n, sessionUserId, markRead, setCurrentPage, navigateToMessages)
          }
          className={rowClass}
        >
          <span className='min-w-0'>
            <span className={kickerClass}>From an employer</span>
            <span className={cn(titleClass, 'truncate')}>{n.title}</span>
          </span>
          <ArrowRight className={cn('h-4 w-4 shrink-0', isDark ? 'text-amber-50' : 'text-[#173150]')} />
        </button>
      ))}

      {shareError && (
        <p className='text-xs text-red-600' role='alert'>
          {shareError}
        </p>
      )}
    </div>
  )
}
