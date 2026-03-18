'use client'

import { useState } from 'react'
import { ClipboardList, CheckCircle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import DotAppPreviewModal from '@/components/career-card/DotAppPreviewModal'
import type { DotAppData, CareerCardMode } from '@/types/career-card'

interface DotAppSectionProps {
  data: DotAppData
  mode: CareerCardMode
  isDark: boolean
  onAction?: () => void
  /** Required when mode === 'self' to fetch the full DOT app for preview */
  userId?: string
  walletAddress?: string
}

export default function DotAppSection({ data, mode, isDark, onAction, userId, walletAddress }: DotAppSectionProps) {
  const isComplete = data.isComplete
  const [showPreview, setShowPreview] = useState(false)

  const StatusIcon = isComplete ? CheckCircle : Clock
  const statusLabel = isComplete ? 'Complete' : 'In Progress'
  const statusColor = isComplete ? 'text-green-500' : 'text-yellow-500'

  const handleAction =
    isComplete && userId && walletAddress ? () => setShowPreview(true) : onAction

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
          {mode === 'self' && handleAction && (
            <button
              type='button'
              onClick={handleAction}
              className={cn(
                'text-xs px-3 py-1 rounded-lg transition-colors',
                isDark ? 'bg-teal-500/20 text-teal-400 hover:bg-teal-500/30' : 'bg-teal-50 text-teal-600 hover:bg-teal-100',
              )}
            >
              {isComplete ? 'View' : 'Continue'}
            </button>
          )}
        </div>

        <div className='flex items-center gap-3'>
          <StatusIcon className={cn('w-5 h-5', statusColor)} />
          <div>
            <p className={cn('text-sm font-medium', isDark ? 'text-gray-200' : 'text-gray-800')}>
              FMCSA Driver Qualification File
            </p>
            <p className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>
              {statusLabel} &middot; Started {new Date(data.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      <DotAppPreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        userId={userId ?? null}
        walletAddress={walletAddress ?? null}
        isDark={isDark}
      />
    </>
  )
}
