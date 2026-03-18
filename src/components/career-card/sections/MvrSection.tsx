'use client'

import { Car, CheckCircle, Clock, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MvrData, CareerCardMode } from '@/types/career-card'

interface MvrSectionProps {
  data: MvrData
  mode: CareerCardMode
  isDark: boolean
  onAction?: () => void
}

export default function MvrSection({ data, mode, isDark, onAction }: MvrSectionProps) {
  const isComplete = data.orderStatus === 'completed'

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
        {mode === 'self' && onAction && (
          <button
            onClick={onAction}
            className={cn(
              'text-xs px-3 py-1 rounded-lg transition-colors',
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
      ) : (
        <div className='flex items-center gap-3'>
          <Clock className='w-5 h-5 text-yellow-500' />
          <div>
            <p className={cn('text-sm font-medium', isDark ? 'text-gray-200' : 'text-gray-800')}>
              MVR {data.orderStatus === 'pending' ? 'Pending' : 'Ordered'}
            </p>
            <p className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>
              {data.licenseState} &middot; Ordered {new Date(data.orderedAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
