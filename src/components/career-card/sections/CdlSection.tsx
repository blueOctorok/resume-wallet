'use client'

import { IdCard, Award } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CdlData, CareerCardMode } from '@/types/career-card'

interface CdlSectionProps {
  data: CdlData
  mode: CareerCardMode
  isDark: boolean
}

export default function CdlSection({ data, isDark }: CdlSectionProps) {
  const hasData = data.cdlClass || data.cdlState || (data.endorsements.length > 0)
  if (!hasData) return null

  return (
    <div className={cn(
      'rounded-xl border p-4',
      isDark ? 'bg-gray-800/40 border-gray-700' : 'bg-white border-gray-200'
    )}>
      <div className='flex items-center gap-2 mb-3'>
        <IdCard className={cn('w-4 h-4', isDark ? 'text-teal-400' : 'text-teal-600')} />
        <h3 className={cn('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
          CDL Credentials
        </h3>
      </div>

      <div className='grid grid-cols-2 gap-3'>
        {data.cdlClass && (
          <div>
            <p className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>Class</p>
            <p className={cn('text-sm font-medium', isDark ? 'text-white' : 'text-gray-900')}>
              Class {data.cdlClass}
            </p>
          </div>
        )}
        {data.cdlState && (
          <div>
            <p className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>State</p>
            <p className={cn('text-sm font-medium', isDark ? 'text-white' : 'text-gray-900')}>
              {data.cdlState}
            </p>
          </div>
        )}
        {data.cdlExpiration && (
          <div>
            <p className={cn('text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>Expires</p>
            <p className={cn('text-sm font-medium', isDark ? 'text-white' : 'text-gray-900')}>
              {new Date(data.cdlExpiration).toLocaleDateString()}
            </p>
          </div>
        )}
      </div>

      {data.endorsements.length > 0 && (
        <div className='mt-3 pt-3 border-t border-gray-700/30'>
          <p className={cn('text-xs mb-2', isDark ? 'text-gray-400' : 'text-gray-500')}>Endorsements</p>
          <div className='flex flex-wrap gap-1.5'>
            {data.endorsements.map((e) => (
              <span
                key={e}
                className={cn(
                  'text-xs px-2 py-0.5 rounded-full',
                  isDark ? 'bg-teal-500/20 text-teal-300' : 'bg-teal-50 text-teal-700'
                )}
              >
                {e}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
