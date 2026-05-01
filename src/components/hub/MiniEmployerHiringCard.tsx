'use client'

import { isDarkTheme } from '@/lib/theme-storage'
/**
 * Compact hiring snapshot for the employer job-path rail (mirrors mini career card idea).
 */

import { Briefcase, Users, Plus } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'

export interface MiniEmployerHiringCardProps {
  /** Inside job-path vault rail — drop nested card chrome */
  embedded?: boolean
  companyName: string | null
  activeJobs: number
  totalApplicants: number
  pendingReview: number
  onPostJob: () => void
  onApplicants: () => void
  onFindTalent: () => void
}

export default function MiniEmployerHiringCard({
  embedded = false,
  companyName,
  activeJobs,
  totalApplicants,
  pendingReview,
  onPostJob,
  onApplicants,
  onFindTalent,
}: MiniEmployerHiringCardProps) {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)
  const ink = theme === 'ink'

  return (
    <div
      className={cn(
        'space-y-3',
        !embedded && [
          'rounded-xl border p-3',
          ink
            ? 'border-zinc-600/70 bg-zinc-900/50'
            : isDark
              ? 'border-gray-700 bg-gray-800/40'
              : 'border-slate-300/90 bg-white shadow-sm shadow-slate-900/[0.04]',
        ],
        embedded && 'pt-0.5',
      )}
    >
      <p
        className={cn(
          'text-[11px] font-bold uppercase tracking-wider',
          ink ? 'text-zinc-500' : 'text-gray-500 dark:text-gray-400',
        )}
      >
        Hiring at a glance
      </p>
      <p className={cn('text-sm font-bold truncate', ink ? 'text-zinc-50' : isDark ? 'text-white' : 'text-slate-900')}>
        {companyName?.trim() || 'Your company'}
      </p>
      <div className='grid grid-cols-2 gap-2 text-center'>
        <div
          className={cn(
            'rounded-lg py-2 px-1 border',
            ink
              ? 'border-zinc-600 bg-zinc-900/60'
              : isDark
                ? 'border-gray-600 bg-gray-900/50'
                : 'border-slate-200 bg-slate-50',
          )}
        >
          <Briefcase className={cn('w-3.5 h-3.5 mx-auto mb-1', ink ? 'text-zinc-400' : 'text-teal-500')} />
          <p
            className={cn(
              'text-lg font-bold tabular-nums',
              ink ? 'text-zinc-50' : 'text-gray-900 dark:text-white',
            )}
          >
            {activeJobs}
          </p>
          <p className={cn('text-[10px]', ink ? 'text-zinc-500' : 'text-gray-500')}>Active jobs</p>
        </div>
        <div
          className={cn(
            'rounded-lg py-2 px-1 border',
            ink
              ? 'border-zinc-600 bg-zinc-900/60'
              : isDark
                ? 'border-gray-600 bg-gray-900/50'
                : 'border-slate-200 bg-slate-50',
          )}
        >
          <Users className={cn('w-3.5 h-3.5 mx-auto mb-1', ink ? 'text-zinc-400' : 'text-teal-500')} />
          <p
            className={cn(
              'text-lg font-bold tabular-nums',
              ink ? 'text-zinc-50' : 'text-gray-900 dark:text-white',
            )}
          >
            {totalApplicants}
          </p>
          <p className={cn('text-[10px]', ink ? 'text-zinc-500' : 'text-gray-500')}>
            In pipeline{pendingReview > 0 ? ` · ${pendingReview} new` : ''}
          </p>
        </div>
      </div>
      <div className='flex flex-wrap gap-2'>
        <button
          type='button'
          onClick={onPostJob}
          className={cn(
            'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors',
            ink
              ? 'bg-zinc-100 text-zinc-900 hover:bg-white ring-1 ring-zinc-500/40'
              : isDark
                ? 'bg-teal-600 text-white hover:bg-teal-500'
                : 'bg-teal-600 text-white hover:bg-teal-700',
          )}
        >
          <Plus className='w-3 h-3' />
          Post job
        </button>
        <button
          type='button'
          onClick={onApplicants}
          className={cn(
            'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors',
            ink
              ? 'bg-zinc-800 text-zinc-200 ring-1 ring-zinc-600/60 hover:bg-zinc-700'
              : isDark
                ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
          )}
        >
          <Users className='w-3 h-3' />
          Applicants
        </button>
        <button
          type='button'
          onClick={onFindTalent}
          className={cn(
            'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors',
            ink
              ? 'bg-zinc-800 text-zinc-200 ring-1 ring-zinc-600/60 hover:bg-zinc-700'
              : isDark
                ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
          )}
        >
          Find talent
        </button>
      </div>
    </div>
  )
}
