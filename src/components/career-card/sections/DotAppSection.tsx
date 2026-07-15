'use client'

import { useState } from 'react'
import { CheckCircle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import DotAppPreviewModal from '@/components/career-card/DotAppPreviewModal'
import DotVerifiedMeter from '@/components/driver-application/DotVerifiedMeter'
import type { DotAppData, CareerCardMode } from '@/types/career-card'
import { isCareerCardOwnerMode } from '@/types/career-card'
import type { DotVerifiedCoverage } from '@/lib/dot-verified-coverage'

interface DotAppSectionProps {
  data: DotAppData
  mode: CareerCardMode
  isDark: boolean
  onAction?: () => void
  /** Required to fetch the full DOT app for preview (self + employer) */
  userId?: string
  sessionUserId?: string
}

export default function DotAppSection({
  data,
  mode,
  isDark,
  onAction,
  userId,
  sessionUserId,
}: DotAppSectionProps) {
  const isComplete = data.isComplete
  const [showPreview, setShowPreview] = useState(false)

  const StatusIcon = isComplete ? CheckCircle : Clock
  const statusLabel = isComplete ? 'Complete' : 'In Progress'
  const statusColor = isComplete ? 'text-green-500' : 'text-yellow-500'

  const canPreview = Boolean(isComplete && userId && sessionUserId)
  const openPreview = () => setShowPreview(true)
  const handleAction = canPreview ? openPreview : onAction

  // Owner: View (complete) or Continue (in progress via onAction).
  // Employer: View only when complete (two-tone preview).
  const showAction =
    (isCareerCardOwnerMode(mode) && Boolean(handleAction)) ||
    (mode === 'employer' && canPreview)

  const coverage: DotVerifiedCoverage | null =
    typeof data.verifiedPercent === 'number' &&
    typeof data.verifiedTotalCount === 'number' &&
    data.verifiedTotalCount > 0
      ? {
          verifiedCount: data.verifiedCount ?? 0,
          totalCount: data.verifiedTotalCount,
          percent: data.verifiedPercent,
          majorityVerified: Boolean(data.majorityVerified),
          slots: [],
          caveat:
            'Verified fields are sourced from the candidate MVR (Accio). Other fields are self-certified.',
        }
      : null

  return (
    <>
      <div className={cn('rounded-xl p-3.5 sm:p-4', isDark ? 'bg-gray-800/40' : 'bg-slate-50/80')}>
        <div className='flex items-start gap-3'>
          <StatusIcon className={cn('mt-0.5 h-5 w-5 shrink-0', statusColor)} />
          <div className='min-w-0 flex-1'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
              <div>
                <p className={cn('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
                  FMCSA Driver Qualification File
                </p>
                <p className={cn('text-xs mt-0.5', isDark ? 'text-gray-400' : 'text-gray-500')}>
                  {statusLabel} · Started {new Date(data.createdAt).toLocaleDateString()}
                </p>
              </div>
              {showAction && (
                <button
                  type='button'
                  onClick={handleAction}
                  className={cn(
                    'shrink-0 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors',
                    isDark
                      ? 'bg-teal-500/20 text-teal-300 hover:bg-teal-500/30'
                      : 'bg-teal-50 text-teal-700 hover:bg-teal-100',
                  )}
                >
                  {isComplete ? 'View' : 'Continue'}
                </button>
              )}
            </div>
            {coverage && (
              <div className='mt-3'>
                <DotVerifiedMeter coverage={coverage} isDark={isDark} variant='compact' />
              </div>
            )}
          </div>
        </div>
      </div>

      <DotAppPreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        userId={userId ?? null}
        sessionUserId={sessionUserId ?? null}
        isDark={isDark}
      />
    </>
  )
}
