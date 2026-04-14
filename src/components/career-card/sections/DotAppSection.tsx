'use client'

import { useState } from 'react'
import { ClipboardList, CheckCircle, Clock, ExternalLink, Shield } from 'lucide-react'
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
  const hasChainProof = Boolean(data.blockchainTxHash && String(data.blockchainTxHash).length > 8)

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
            {hasChainProof && (
              <span className='flex items-center gap-1 text-[10px] font-medium text-green-600 dark:text-green-400'>
                <Shield className='w-3 h-3' /> On-chain
              </span>
            )}
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
            <p className={cn('text-xs flex flex-wrap items-center gap-x-1 gap-y-1', isDark ? 'text-gray-500' : 'text-gray-400')}>
              <span>
                {statusLabel} &middot; Started {new Date(data.createdAt).toLocaleDateString()}
              </span>
              {hasChainProof && data.blockchainTxHash ? (
                <>
                  <span aria-hidden>&middot;</span>
                  <a
                    href={`https://sepolia.basescan.org/tx/${data.blockchainTxHash}`}
                    target='_blank'
                    rel='noopener noreferrer'
                    className={cn(
                      'inline-flex items-center gap-0.5 font-medium',
                      isDark ? 'text-teal-400 hover:text-teal-300' : 'text-teal-700 hover:text-teal-800',
                    )}
                  >
                    View on Base <ExternalLink className='w-3 h-3' />
                  </a>
                </>
              ) : null}
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
