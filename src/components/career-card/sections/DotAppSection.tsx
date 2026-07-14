'use client'

import { useState } from 'react'
import { ClipboardList, CheckCircle, Clock } from 'lucide-react'
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
      <div className={cn('rounded-xl p-4', isDark ? 'bg-gray-700/50' : 'bg-white/60')}>
        <div className='flex items-center justify-between mb-3'>
          <div className='flex items-center gap-2'>
            <ClipboardList className={cn('w-4 h-4', isDark ? 'text-teal-400' : 'text-teal-600')} />
            <h3 className={cn('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
              DOT Application
            </h3>
          </div>
          {showAction && (
            <button
              type='button'
              onClick={handleAction}
              className={cn(
                'text-xs px-3 py-1 rounded-lg transition-colors',
                isDark
                  ? 'bg-teal-500/20 text-teal-400 hover:bg-teal-500/30'
                  : 'bg-teal-50 text-teal-600 hover:bg-teal-100',
              )}
            >
              {isComplete ? 'View' : 'Continue'}
            </button>
          )}
        </div>

        <div className='flex items-center gap-3'>
          <StatusIcon className={cn('w-5 h-5', statusColor)} />
          <div className='min-w-0 flex-1'>
            <p className={cn('text-sm font-medium', isDark ? 'text-gray-200' : 'text-gray-800')}>
              FMCSA Driver Qualification File
            </p>
            <p className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>
              {statusLabel} · Started {new Date(data.createdAt).toLocaleDateString()}
            </p>
            {coverage && (
              <div className='mt-2'>
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
