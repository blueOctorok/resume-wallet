'use client'

import { useState } from 'react'
import { ClipboardList, CheckCircle, Clock, X, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import DotAppPreviewContent, { type DotAppPreviewData } from '@/components/career-card/DotAppPreviewContent'
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
  const [previewData, setPreviewData] = useState<DotAppPreviewData | null>(null)
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const openPreview = async () => {
    setShowPreview(true)
    if (previewData) return // already fetched, reuse cached data
    setLoading(true)
    setFetchError(null)
    try {
      const res = await fetch(`/api/employer/talent/${userId}/dot-app`, {
        headers: walletAddress ? { 'x-wallet-address': walletAddress } : {},
      })
      if (!res.ok) throw new Error('Failed to load DOT application')
      const json = await res.json()
      setPreviewData(json)
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load DOT application')
    } finally {
      setLoading(false)
    }
  }

  const StatusIcon = isComplete ? CheckCircle : Clock
  const statusLabel = isComplete ? 'Complete' : 'In Progress'
  const statusColor = isComplete ? 'text-green-500' : 'text-yellow-500'

  // In self mode: completed apps show a "View" that opens the preview modal.
  // In-progress apps navigate to the form to continue filling it out.
  const handleAction = isComplete && userId ? openPreview : onAction

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
              onClick={handleAction}
              className={cn(
                'text-xs px-3 py-1 rounded-lg transition-colors',
                isDark ? 'bg-teal-500/20 text-teal-400 hover:bg-teal-500/30' : 'bg-teal-50 text-teal-600 hover:bg-teal-100'
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

      {/* Preview modal — only shown when user clicks "View" on a completed app */}
      {showPreview && (
        <Modal onClose={() => setShowPreview(false)} maxWidth='max-w-2xl' zIndex={10100}>
          <ModalHeader
            title='DOT Application'
            subtitle='Your completed driver qualification file'
            onClose={() => setShowPreview(false)}
          />
          <div className='overflow-y-auto max-h-[75vh]'>
            {loading && (
              <div className='flex items-center justify-center py-16'>
                <Loader2 className={cn('w-6 h-6 animate-spin', isDark ? 'text-teal-400' : 'text-teal-600')} />
              </div>
            )}
            {fetchError && (
              <div className={cn(
                'm-6 flex items-center gap-2 p-4 rounded-xl text-sm',
                isDark ? 'bg-red-900/20 text-red-400' : 'bg-red-50 text-red-600'
              )}>
                <AlertCircle className='w-4 h-4 flex-shrink-0' />
                {fetchError}
              </div>
            )}
            {!loading && !fetchError && previewData && (
              <DotAppPreviewContent data={previewData} isDark={isDark} />
            )}
          </div>
        </Modal>
      )}
    </>
  )
}
