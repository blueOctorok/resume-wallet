'use client'

import { useState } from 'react'
import { Car, Clock, Loader2 } from 'lucide-react'
import ProvvenMark from '@/components/ui/ProvvenMark'
import { cn } from '@/lib/utils'
import type { MvrData, CareerCardMode } from '@/types/career-card'
import { isCareerCardOwnerMode } from '@/types/career-card'
import MvrViewModal from '@/components/MvrViewModal'
import ScreeningFailureBanner from '@/components/ui/ScreeningFailureBanner'
import Button from '@/components/ui/Button'
import { outcomeBadgeClasses, outcomeLabel, type ScreeningOutcome } from '@/lib/accio-result-status'

function formatOrderDate(raw: string | null | undefined): string | null {
  if (!raw) return null
  const d = new Date(raw)
  return isNaN(d.getTime()) ? null : d.toLocaleDateString()
}

const STATUS_DISPLAY: Record<string, { label: string; icon: 'clock' | 'loader' | 'check' }> = {
  pending:      { label: 'Pending — waiting for processing', icon: 'clock' },
  processing:   { label: 'Processing — Accio is running the report', icon: 'loader' },
  needs_review: { label: 'Report received — under review', icon: 'check' },
  completed:    { label: 'Report complete', icon: 'check' },
  failed:       { label: 'Order failed — contact support', icon: 'clock' },
}

function statusIcon(key: 'clock' | 'loader' | 'check') {
  if (key === 'loader') return <Loader2 className="h-5 w-5 text-yellow-500 animate-spin" />
  if (key === 'check') return <ProvvenMark className="text-xl" />
  return <Clock className="h-5 w-5 text-yellow-500" />
}

interface MvrSectionProps {
  data: MvrData
  mode: CareerCardMode
  isDark: boolean
  onNavigateToOrder?: () => void
  sessionUserId?: string | null
}

export default function MvrSection({
  data,
  mode,
  isDark,
  onNavigateToOrder,
  sessionUserId,
}: MvrSectionProps) {
  const [showMvrViewer, setShowMvrViewer] = useState(false)

  const isComplete =
    data.orderStatus === 'completed' || data.orderStatus === 'needs_review'
  const isFailed = data.orderStatus === 'failed'
  const hasOrder = Boolean(data.orderId && data.orderStatus !== 'none')
  const dateStr = formatOrderDate(data.orderedAt) ?? formatOrderDate(data.completedAt)

  const pending = data.pendingEmployerRequest
  const isEmployerPendingNoOrder = Boolean(pending) && !hasOrder && !isFailed

  const handlePrimaryClick = () => {
    if (data.employerPaidScreening) return
    if (isComplete) {
      setShowMvrViewer(true)
      return
    }
    onNavigateToOrder?.()
  }

  // Employer-requested screening: candidate completes consent on another page — hide duplicate self-order.
  const hideOrderHeaderForEmployerScreeningPending =
    !isComplete && !isFailed && isEmployerPendingNoOrder

  const showSelfButton =
    mode !== 'construct' &&
    isCareerCardOwnerMode(mode) &&
    !data.employerPaidScreening &&
    !isFailed &&
    !hideOrderHeaderForEmployerScreeningPending &&
    (isComplete
      ? Boolean(sessionUserId && data.orderId)
      : hasOrder
        ? false
        : Boolean(onNavigateToOrder))

  const display = STATUS_DISPLAY[data.orderStatus] ?? STATUS_DISPLAY.pending

  return (
    <div className={cn(
      'rounded-xl p-4',
      isDark ? 'bg-gray-700/50' : 'bg-white/60'
    )}>
      <div className='flex items-center justify-between mb-3'>
        <div className='flex items-center gap-2 min-w-0'>
          <Car className={cn('w-4 h-4 shrink-0', isDark ? 'text-teal-400' : 'text-teal-600')} />
          <h3 className={cn('text-sm font-semibold truncate', isDark ? 'text-white' : 'text-gray-900')}>
            Motor Vehicle Record
          </h3>
          {/* Outcome chip — derived from Accio filledCode in src/lib/accio-result-status.ts.
              Hidden until the order is in a terminal state to avoid flashing "Pending review"
              on freshly placed orders that just haven't returned yet. */}
          {isComplete && data.resultOutcome ? (
            <span
              className={cn(
                'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                outcomeBadgeClasses(data.resultOutcome as ScreeningOutcome),
              )}
            >
              {outcomeLabel(data.resultOutcome as ScreeningOutcome)}
            </span>
          ) : null}
        </div>
        {showSelfButton && (
          <Button
            type='button'
            variant={isComplete ? 'secondary' : 'primary'}
            size='sm'
            onClick={handlePrimaryClick}
          >
            {isComplete ? 'View' : pending ? 'Continue' : 'Order'}
          </Button>
        )}
      </div>

      {isFailed ? (
        <ScreeningFailureBanner
          kind="mvr"
          outcome={data.resultOutcome}
          isDark={isDark}
          onRetry={onNavigateToOrder}
          hideRetry={!isCareerCardOwnerMode(mode) || data.employerPaidScreening || !onNavigateToOrder}
        />
      ) : isComplete && data.employerPaidScreening ? (
        <div className='space-y-2'>
          <p className={cn('text-sm', isDark ? 'text-gray-300' : 'text-gray-700')}>
            <span className='font-medium text-emerald-500 dark:text-emerald-400'>Complete.</span>{' '}
            An employer ordered this MVR. They receive the full motor vehicle report; you see status
            here only.
          </p>
          {(data.licenseState || dateStr) && (
            <p className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-500')}>
              {[data.licenseState, dateStr && `Ordered ${dateStr}`].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      ) : isComplete && data.results ? (
        <div className='space-y-2'>
          <div className='grid grid-cols-3 gap-3'>
            <div className={cn('rounded-lg p-3 text-center', isDark ? 'bg-gray-700/50' : 'bg-gray-50')}>
              <p className={cn('text-xs mb-1', isDark ? 'text-gray-400' : 'text-gray-500')}>Status</p>
              <p className={cn('text-sm font-semibold', isDark ? 'text-green-400' : 'text-green-600')}>
                {data.results.licenseStatus || 'Valid'}
              </p>
            </div>
            <div className={cn('rounded-lg p-3 text-center', isDark ? 'bg-gray-700/50' : 'bg-gray-50')}>
              <p className={cn('text-xs mb-1', isDark ? 'text-gray-400' : 'text-gray-500')}>Points</p>
              <p className={cn('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
                {data.results.totalPoints}
              </p>
            </div>
            <div className={cn('rounded-lg p-3 text-center', isDark ? 'bg-gray-700/50' : 'bg-gray-50')}>
              <p className={cn('text-xs mb-1', isDark ? 'text-gray-400' : 'text-gray-500')}>Violations</p>
              <p className={cn('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
                {data.results.violationCount}
              </p>
            </div>
          </div>
          {/* Provenance — Storm is the candidate's agent; attestations cite the originating CRA */}
          <p className={cn('text-[11px]', isDark ? 'text-gray-500' : 'text-gray-500')}>
            Derived from MVR pulled by Accio{dateStr ? ` · ${dateStr}` : ''}
            {data.licenseState ? ` · ${data.licenseState}` : ''}
          </p>
        </div>
      ) : hasOrder ? (
        <div className='flex items-center gap-3'>
          {statusIcon(display.icon)}
          <div>
            <p className={cn('text-sm font-medium', isDark ? 'text-gray-200' : 'text-gray-800')}>
              {display.label}
            </p>
            {(data.licenseState || dateStr) && (
              <p className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>
                {[data.licenseState, dateStr && `Ordered ${dateStr}`].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className='space-y-3'>
          {pending && isEmployerPendingNoOrder ? (
            <p className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>
              <span className='font-medium'>{pending.companyName}</span> asked you to complete screening consent
              (background check, FMCSA PSP, and CDLIS written consent). Open the Screening consent block on your hub to
              finish — you&apos;ll order your own portable MVR and PSP when you submit.
            </p>
          ) : (
            <p className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>
              No MVR ordered yet.
            </p>
          )}
          {mode === 'self' && pending && isEmployerPendingNoOrder && onNavigateToOrder ? (
            <Button type='button' variant='primary' size='sm' onClick={onNavigateToOrder}>
              Continue screening
            </Button>
          ) : null}
        </div>
      )}

      {showMvrViewer && sessionUserId && (
        <MvrViewModal
          isOpen={showMvrViewer}
          onClose={() => setShowMvrViewer(false)}
          sessionUserId={sessionUserId}
          orderId={data.orderId}
        />
      )}
    </div>
  )
}
