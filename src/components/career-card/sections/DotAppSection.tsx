'use client'

import { useState } from 'react'
import { CheckCircle, ClipboardList, Clock, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import Button from '@/components/ui/Button'
import DotAppPreviewModal from '@/components/career-card/DotAppPreviewModal'
import DotVerifiedMeter from '@/components/driver-application/DotVerifiedMeter'
import type { DotAppData, CareerCardMode } from '@/types/career-card'
import { isCareerCardOwnerMode } from '@/types/career-card'
import type { DotVerifiedCoverage } from '@/lib/dot-verified-coverage'
import { useDotApplicationStore } from '@/stores'

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
  const setShowPrefillUpload = useDotApplicationStore((s) => s.setShowPrefillUpload)
  const isEmpty = !data.id || data.status === 'empty'
  const isComplete = data.isComplete
  const [showPreview, setShowPreview] = useState(false)

  const StatusIcon = isComplete ? CheckCircle : Clock
  const statusLabel = isComplete ? 'Complete' : isEmpty ? 'Not started' : 'In Progress'
  const statusColor = isComplete ? 'text-green-500' : isEmpty ? 'text-teal-500' : 'text-yellow-500'

  const canPreview = Boolean(isComplete && userId && sessionUserId)
  const openPreview = () => setShowPreview(true)
  const handleAction = canPreview ? openPreview : onAction

  const openPrefillUpload = () => {
    setShowPrefillUpload(true)
    onAction?.()
  }

  // Owner: View (complete) or Continue (in progress). Employer: View when complete.
  const showAction =
    (isCareerCardOwnerMode(mode) && !isEmpty && Boolean(handleAction)) ||
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

  if (isEmpty && isCareerCardOwnerMode(mode)) {
    return (
      <div
        className={cn(
          'rounded-xl border-2 border-dashed p-6 text-center',
          isDark ? 'border-teal-400/25 bg-teal-500/[0.06]' : 'border-teal-300/60 bg-teal-50/50',
        )}
      >
        <ClipboardList
          className={cn('mx-auto mb-2 h-8 w-8', isDark ? 'text-teal-300' : 'text-teal-600')}
        />
        <p className={cn('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
          Start your DOT application
        </p>
        <p className={cn('mt-1 text-xs', isDark ? 'text-gray-400' : 'text-gray-600')}>
          Your federal driver qualification file — the home base for MVR, PSP, and employer
          screening.
        </p>
        <div className='mt-4 flex flex-wrap items-center justify-center gap-2'>
          {onAction ? (
            <Button type='button' variant='primary' size='sm' onClick={onAction}>
              Start application
            </Button>
          ) : null}
          {onAction ? (
            <Button type='button' variant='secondary' size='sm' onClick={openPrefillUpload}>
              <Upload className='mr-1.5 h-3.5 w-3.5' aria-hidden />
              Upload resume to prefill
            </Button>
          ) : null}
        </div>
      </div>
    )
  }

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
                  {statusLabel}
                  {data.createdAt
                    ? ` · Started ${new Date(data.createdAt).toLocaleDateString()}`
                    : ''}
                </p>
              </div>
              {showAction && (
                <div className='flex shrink-0 flex-wrap items-center gap-1.5'>
                  {!isComplete && isCareerCardOwnerMode(mode) && onAction ? (
                    <button
                      type='button'
                      onClick={openPrefillUpload}
                      className={cn(
                        'text-xs px-3 py-1.5 rounded-lg font-medium transition-colors inline-flex items-center gap-1',
                        isDark
                          ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50',
                      )}
                    >
                      <Upload className='h-3 w-3' aria-hidden />
                      Upload resume
                    </button>
                  ) : null}
                  <button
                    type='button'
                    onClick={handleAction}
                    className={cn(
                      'text-xs px-3 py-1.5 rounded-lg font-medium transition-colors',
                      isDark
                        ? 'bg-teal-500/20 text-teal-300 hover:bg-teal-500/30'
                        : 'bg-teal-50 text-teal-700 hover:bg-teal-100',
                    )}
                  >
                    {isComplete ? 'View' : 'Continue'}
                  </button>
                </div>
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
