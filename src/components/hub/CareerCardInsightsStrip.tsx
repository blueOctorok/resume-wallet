'use client'

import { TrendingUp, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import Card from '@/components/ui/Card'
import { useHubStats } from '@/stores/driver-hub-store'
import { useInstalledBlocks } from '@/stores/hub-blocks-store'

interface CareerCardInsightsStripProps {
  isDark: boolean
}

/**
 * Lightweight feedback loop: employer views + static prompts (data-driven counts from hub API).
 */
export default function CareerCardInsightsStrip({ isDark }: CareerCardInsightsStripProps) {
  const stats = useHubStats()
  const installedBlocks = useInstalledBlocks()

  const week = stats?.careerCardViewsThisWeek ?? 0
  const hasDriverLane = installedBlocks.some((b) => b.blockType.startsWith('driver-'))

  return (
    <Card
      variant='elevated'
      className={cn(
        'p-4 sm:p-5 border',
        isDark ? 'border-teal-500/20 bg-gray-900/40' : 'border-teal-200/60 bg-white',
      )}
    >
      <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6'>
        <div className='flex gap-3 min-w-0'>
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
              isDark ? 'bg-teal-500/15 text-teal-300' : 'bg-teal-50 text-teal-700',
            )}
          >
            <Eye className='h-5 w-5' aria-hidden />
          </div>
          <div className='min-w-0'>
            <p className={cn('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
              Career card insights
            </p>
            <p className={cn('text-sm mt-1', isDark ? 'text-gray-400' : 'text-gray-600')}>
              {week === 0 ? (
                <>No employer views on your card this week yet — keep building proof on your blocks.</>
              ) : (
                <>
                  Your card was viewed <strong className={isDark ? 'text-teal-300' : 'text-teal-800'}>{week}</strong>{' '}
                  {week === 1 ? 'time' : 'times'} this week (talent search &amp; pipeline).
                </>
              )}
            </p>
          </div>
        </div>
        <div
          className={cn(
            'flex gap-2 items-start rounded-xl px-3 py-2.5 text-xs sm:max-w-xs border',
            isDark ? 'bg-gray-800/50 border-gray-700 text-gray-400' : 'bg-slate-50 border-slate-200 text-slate-600',
          )}
        >
          <TrendingUp className='w-4 h-4 shrink-0 mt-0.5 text-amber-500' aria-hidden />
          <p>
            <span className='font-medium text-amber-600 dark:text-amber-400'>Tip:</span> Candidates with verified
            credentials tend to get more employer opens. {hasDriverLane ? 'Adding an MVR helps drivers stand out.' : 'Add blocks that match your lane so filters surface you.'}
          </p>
        </div>
      </div>
    </Card>
  )
}
