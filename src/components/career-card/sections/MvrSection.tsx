'use client'

import { useState } from 'react'
import { Car, Clock, Loader2, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MvrData, CareerCardMode } from '@/types/career-card'
import { isCareerCardOwnerMode } from '@/types/career-card'
import MvrViewModal from '@/components/MvrViewModal'

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

interface MvrSectionProps {
  data: MvrData
  mode: CareerCardMode
  isDark: boolean
  onNavigateToOrder?: () => void
  walletAddress?: string | null
}

export default function MvrSection({
  data,
  mode,
  isDark,
  onNavigateToOrder,
  walletAddress,
}: MvrSectionProps) {
  const [showMvrViewer, setShowMvrViewer] = useState(false)

  const isComplete =
    data.orderStatus === 'completed' || data.orderStatus === 'needs_review'
  const hasOrder = Boolean(data.orderId && data.orderStatus !== 'none')
  const dateStr = formatOrderDate(data.orderedAt) ?? formatOrderDate(data.completedAt)

  const handlePrimaryClick = () => {
    if (isComplete) {
      setShowMvrViewer(true)
      return
    }
    onNavigateToOrder?.()
  }

  const showSelfButton =
    isCareerCardOwnerMode(mode) &&
    (isComplete ? Boolean(walletAddress && data.orderId) : Boolean(onNavigateToOrder))

  const display = STATUS_DISPLAY[data.orderStatus] ?? STATUS_DISPLAY.pending

  return (
    <div className={cn(
      'rounded-xl p-4',
      isDark ? 'bg-gray-700/50' : 'bg-white/60'
    )}>
      <div className='flex items-center justify-between mb-3'>
        <div className='flex items-center gap-2'>
          <Car className={cn('w-4 h-4', isDark ? 'text-teal-400' : 'text-teal-600')} />
          <h3 className={cn('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
            Motor Vehicle Record
          </h3>
        </div>
        {showSelfButton && (
          <button
            type='button'
            onClick={handlePrimaryClick}
            className={cn(
              'text-xs px-3 py-1 rounded-lg transition-colors cursor-pointer',
              isDark ? 'bg-teal-500/20 text-teal-400 hover:bg-teal-500/30' : 'bg-teal-50 text-teal-600 hover:bg-teal-100'
            )}
          >
            {isComplete ? 'View' : 'Order'}
          </button>
        )}
      </div>

      {isComplete && data.results ? (
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
        <p className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>
          No MVR ordered yet.{' '}
          {isCareerCardOwnerMode(mode) && onNavigateToOrder && (
            <button type="button" onClick={onNavigateToOrder} className="text-teal-500 hover:underline cursor-pointer">
              Order one
            </button>
          )}
        </p>
      )}

      {showMvrViewer && walletAddress && (
        <MvrViewModal
          isOpen={showMvrViewer}
          onClose={() => setShowMvrViewer(false)}
          walletAddress={walletAddress}
          orderId={data.orderId}
        />
      )}
    </div>
  )
}
