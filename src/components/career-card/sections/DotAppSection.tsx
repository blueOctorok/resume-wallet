'use client'

import { ClipboardList, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DotAppData, CareerCardMode } from '@/types/career-card'

interface DotAppSectionProps {
  data: DotAppData
  mode: CareerCardMode
  isDark: boolean
  onAction?: () => void
}

export default function DotAppSection({ data, mode, isDark, onAction }: DotAppSectionProps) {
  const statusConfig = data.isComplete
    ? { icon: CheckCircle, label: 'Complete', color: 'text-green-500' }
    : { icon: Clock, label: 'In Progress', color: 'text-yellow-500' }

  const StatusIcon = statusConfig.icon

  return (
    <div className={cn(
      'rounded-xl border p-4',
      isDark ? 'bg-gray-800/40 border-gray-700' : 'bg-white border-gray-200'
    )}>
      <div className='flex items-center justify-between mb-3'>
        <div className='flex items-center gap-2'>
          <ClipboardList className={cn('w-4 h-4', isDark ? 'text-teal-400' : 'text-teal-600')} />
          <h3 className={cn('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
            DOT Application
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
            {data.isComplete ? 'View' : 'Continue'}
          </button>
        )}
      </div>

      <div className='flex items-center gap-3'>
        <StatusIcon className={cn('w-5 h-5', statusConfig.color)} />
        <div>
          <p className={cn('text-sm font-medium', isDark ? 'text-gray-200' : 'text-gray-800')}>
            FMCSA Driver Qualification File
          </p>
          <p className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>
            {statusConfig.label} &middot; Started {new Date(data.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  )
}
