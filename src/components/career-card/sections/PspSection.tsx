'use client'

import { useState } from 'react'
import { FileWarning, Clock, Loader2, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PspData, CareerCardMode } from '@/types/career-card'
import { isCareerCardOwnerMode } from '@/types/career-card'
import PspViewModal from '@/components/PspViewModal'
import Button from '@/components/ui/Button'
import ScreeningFailureBanner from '@/components/ui/ScreeningFailureBanner'
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
  if (key === 'check') return <CheckCircle className="h-5 w-5 text-green-500" />
  return <Clock className="h-5 w-5 text-yellow-500" />
}

interface PspSectionProps {
  data: PspData
  mode: CareerCardMode
  isDark: boolean
  onNavigateToOrder?: () => void
  walletAddress?: string | null
}

export default function PspSection({
  data,
  mode,
  isDark,
  onNavigateToOrder,
  walletAddress,
}: PspSectionProps) {
  const [open, setOpen] = useState(false)

  const isComplete = data.orderStatus === 'completed' || data.orderStatus === 'needs_review'
  const isFailed = data.orderStatus === 'failed'
  const hasOrder = Boolean(data.orderId && data.orderStatus !== 'none')
  const dateStr = formatOrderDate(data.orderedAt) ?? formatOrderDate(data.completedAt)

  const handlePrimary = () => {
    if (data.employerPaidScreening) return
    if (isComplete) {
      setOpen(true)
      return
    }
    onNavigateToOrder?.()
  }

  // Suppress the header button on failed orders — the banner provides
  // its own clearer "Re-order" CTA.
  const showSelfButton =
    isCareerCardOwnerMode(mode) &&
    !data.employerPaidScreening &&
    !isFailed &&
    (isComplete ? Boolean(walletAddress && data.orderId) : Boolean(onNavigateToOrder))

  const display = STATUS_DISPLAY[data.orderStatus] ?? STATUS_DISPLAY.pending

  return (
    <div
      className={cn('rounded-xl p-4', isDark ? 'bg-gray-700/50' : 'bg-white/60')}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <FileWarning className={cn('h-4 w-4 shrink-0', isDark ? 'text-orange-400' : 'text-orange-600')} />
          <h3 className={cn('text-sm font-semibold truncate', isDark ? 'text-white' : 'text-gray-900')}>
            PSP Report
          </h3>
          {/* Same outcome chip pattern as MvrSection. Hidden until terminal. */}
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
          <Button type="button" variant={isComplete ? 'secondary' : 'primary'} size="sm" onClick={handlePrimary}>
            {isComplete ? 'View' : 'Order'}
          </Button>
        )}
      </div>

      {isFailed ? (
        <ScreeningFailureBanner
          kind="psp"
          outcome={data.resultOutcome}
          isDark={isDark}
          onRetry={onNavigateToOrder}
          hideRetry={!isCareerCardOwnerMode(mode) || data.employerPaidScreening || !onNavigateToOrder}
        />
      ) : isComplete && data.employerPaidScreening ? (
        <div className="space-y-2">
          <p className={cn('text-sm', isDark ? 'text-gray-300' : 'text-gray-700')}>
            <span className="font-medium text-emerald-500 dark:text-emerald-400">Complete.</span>{' '}
            An employer ordered this PSP bundle. They receive the full FMCSA report; you see status
            here only.
          </p>
          {(data.licenseState || dateStr) && (
            <p className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-500')}>
              {[data.licenseState, dateStr && `Ordered ${dateStr}`].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      ) : isComplete ? (
        <div className="space-y-2">
          <p className={cn('text-sm', isDark ? 'text-gray-300' : 'text-gray-700')}>
            {data.resultSummary ? (
              <>
                Report status:{' '}
                <span className="font-medium">{data.resultSummary.resultStatus ?? 'received'}</span>
              </>
            ) : (
              <>
                Report received — details will appear here after we finish parsing the vendor file.
              </>
            )}
          </p>
          {(data.licenseState || dateStr) && (
            <p className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-500')}>
              {[data.licenseState, dateStr && `Ordered ${dateStr}`].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      ) : hasOrder ? (
        <div className="flex items-center gap-3">
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
        <p className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>
          No PSP report ordered yet.{' '}
          {isCareerCardOwnerMode(mode) && onNavigateToOrder && !data.employerPaidScreening && (
            <button type="button" onClick={onNavigateToOrder} className="text-teal-500 hover:underline cursor-pointer">
              Order one
            </button>
          )}
        </p>
      )}

      {open && walletAddress && (
        <PspViewModal
          isOpen={open}
          onClose={() => setOpen(false)}
          walletAddress={walletAddress}
          orderId={data.orderId}
        />
      )}
    </div>
  )
}
