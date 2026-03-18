'use client'

import { Briefcase, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WorkHistoryData, CareerCardMode } from '@/types/career-card'

interface WorkHistorySectionProps {
  data: WorkHistoryData
  mode: CareerCardMode
  isDark: boolean
}

export default function WorkHistorySection({ data, isDark }: WorkHistorySectionProps) {
  if (!data.entries.length) return null

  return (
    <div className={cn(
      'rounded-xl p-4',
      isDark ? 'bg-gray-700/50' : 'bg-white/60'
    )}>
      <div className='flex items-center justify-between mb-3'>
        <div className='flex items-center gap-2'>
          <Briefcase className={cn('w-4 h-4', isDark ? 'text-teal-400' : 'text-teal-600')} />
          <h3 className={cn('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
            Work History
          </h3>
        </div>
        {data.verifiedCount > 0 && (
          <span className='flex items-center gap-1 text-xs text-green-500'>
            <CheckCircle className='w-3 h-3' /> {data.verifiedCount} verified
          </span>
        )}
      </div>

      <div className='space-y-3'>
        {data.entries.slice(0, 5).map((entry, idx) => (
          <div key={idx} className='flex gap-3'>
            <div className='flex flex-col items-center'>
              <div className={cn(
                'w-2 h-2 rounded-full mt-1.5',
                entry.isCurrent
                  ? 'bg-green-500'
                  : isDark ? 'bg-gray-600' : 'bg-gray-300'
              )} />
              {idx < data.entries.length - 1 && (
                <div className={cn('w-px flex-1 mt-1', isDark ? 'bg-gray-700' : 'bg-gray-200')} />
              )}
            </div>
            <div className='pb-3'>
              <p className={cn('text-sm font-medium', isDark ? 'text-gray-200' : 'text-gray-800')}>
                {entry.position || 'Position'}
              </p>
              <p className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>
                {entry.companyName}
              </p>
              <p className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>
                {entry.startDate ? new Date(entry.startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : ''}
                {' — '}
                {entry.isCurrent ? 'Present' : entry.endDate ? new Date(entry.endDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : ''}
              </p>
            </div>
          </div>
        ))}
      </div>

      {data.entries.length > 5 && (
        <p className={cn('text-xs mt-2', isDark ? 'text-gray-500' : 'text-gray-400')}>
          +{data.entries.length - 5} more positions
        </p>
      )}
    </div>
  )
}
