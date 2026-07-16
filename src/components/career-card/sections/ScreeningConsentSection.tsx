'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { cn } from '@/lib/utils'
import type { ScreeningConsentData, CareerCardMode } from '@/types/career-card'
import { isCareerCardOwnerMode } from '@/types/career-card'
import Button from '@/components/ui/Button'

interface ScreeningConsentSectionProps {
  data: ScreeningConsentData
  mode: CareerCardMode
  isDark: boolean
  onAction?: () => void
}

/**
 * Self-view only (section is not injected for public/employer projections).
 * Lists per-employer consent packages so the candidate can see what is on file.
 */
export default function ScreeningConsentSection({
  data,
  mode,
  isDark,
  onAction,
}: ScreeningConsentSectionProps) {
  const owner = isCareerCardOwnerMode(mode)
  const bundles = data.bundles ?? []
  const hasIncomplete = bundles.some((b) => b.status !== 'complete')

  return (
    <div className='space-y-3 text-sm'>
      {bundles.length === 0 ? (
        <p className={cn(isDark ? 'text-gray-400' : 'text-slate-600')}>
          When an employer requests screening consent, your signed packages will appear here.
        </p>
      ) : (
        <ul className='space-y-2'>
          {bundles.map((b) => (
            <li
              key={b.id}
              className={cn(
                'rounded-lg border px-3 py-2',
                isDark ? 'border-gray-700/80 bg-gray-900/40' : 'border-slate-200 bg-white/60',
              )}
            >
              <div className='flex flex-wrap items-center justify-between gap-2'>
                <span className={cn('font-medium', isDark ? 'text-gray-100' : 'text-slate-900')}>
                  {b.companyName ?? 'Employer'}
                </span>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                    b.status === 'complete'
                      ? isDark
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : 'bg-emerald-100 text-emerald-800'
                      : isDark
                        ? 'bg-amber-500/15 text-amber-200'
                        : 'bg-amber-100 text-amber-900',
                  )}
                >
                  {b.status === 'complete' ? 'Complete' : 'In progress'}
                </span>
              </div>
              {b.completedAt && (
                <p className={cn('mt-1 text-xs', isDark ? 'text-gray-500' : 'text-slate-500')}>
                  Completed {new Date(b.completedAt).toLocaleString()}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      {owner && hasIncomplete && onAction && (
        <Button type='button' variant='primary' size='sm' onClick={onAction}>
          Continue screening consent
        </Button>
      )}
    </div>
  )
}
