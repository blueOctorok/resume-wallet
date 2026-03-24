'use client'

/**
 * Dynamic steps from journey progress (blocks for candidates, hiring for employers).
 * Shown under PathGuidance as “Next steps” — not a “quest log” label.
 */

import { Check, Circle, Loader2, ChevronRight, IdCard } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useJourneyProgress } from '@/stores'
import { useHubBlocksStore } from '@/stores/hub-blocks-store'
import type { PageType } from '@/stores/types'
import type { JourneyProgress, JourneyStep } from '@/lib/journey-progress'

export interface CareerPathStepsProps {
  onNavigate: (target: PageType) => void
  /** When set (e.g. employer sidebar), skips `useJourneyProgress` */
  progressOverride?: JourneyProgress
}

export default function CareerPathSteps({ onNavigate, progressOverride }: CareerPathStepsProps) {
  const storeProgress = useJourneyProgress()
  const progress = progressOverride ?? storeProgress
  const openPicker = useHubBlocksStore((s) => s.openPicker)
  const isEmployer = progress.role === 'employer'

  if (progress.steps.length === 0) {
    return (
      <div
        className={cn(
          'rounded-xl border p-4 text-center',
          'border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/40',
        )}
      >
        <IdCard className='w-8 h-8 mx-auto mb-2 opacity-50 text-gray-500' />
        <p className='text-sm font-medium text-gray-800 dark:text-gray-200'>Nothing here yet</p>
        <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
          {isEmployer ? 'Load your hub to see your job path.' : 'Add blocks from the store to see your next steps.'}
        </p>
        {!isEmployer && (
          <button
            type='button'
            onClick={() => openPicker()}
            className={cn(
              'mt-3 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
              'bg-brand-mint text-gray-900 hover:bg-brand-mint/90',
            )}
          >
            Open block store
          </button>
        )}
      </div>
    )
  }

  return (
    <div className='space-y-3'>
      <div className='flex items-center justify-between gap-2'>
        <span className='text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400'>
          Next steps
        </span>
        <span className='text-xs font-bold text-brand-sage-dark dark:text-teal-300 tabular-nums'>
          {progress.completedSteps}/{progress.totalSteps}
        </span>
      </div>

      <div className='h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden'>
        <div
          className='h-full rounded-full bg-gradient-to-r from-brand-mint to-brand-mint/80 transition-all duration-500'
          style={{ width: `${progress.overallProgress}%` }}
        />
      </div>

      <ul className='space-y-1' role='list'>
        {progress.steps.map((step) => (
          <PathStepRow key={step.id} step={step} onNavigate={onNavigate} />
        ))}
      </ul>
    </div>
  )
}

function PathStepRow({
  step,
  onNavigate,
}: {
  step: JourneyStep
  onNavigate: (target: PageType) => void
}) {
  const target = step.action?.target
  const isClickable = step.status !== 'complete' && step.action != null && target != null

  return (
    <li>
      <button
        type='button'
        onClick={() => {
          if (isClickable && target != null) onNavigate(target)
        }}
        disabled={!isClickable}
        className={cn(
          'w-full flex items-start gap-2 p-2 rounded-lg text-left transition-colors',
          step.status === 'complete' && 'bg-green-50/80 dark:bg-green-900/15',
          step.status === 'in_progress' && 'bg-brand-mint/10 dark:bg-brand-mint/15 ring-1 ring-brand-mint/25',
          step.status === 'pending' && 'bg-gray-50 dark:bg-gray-800/50',
          isClickable && 'hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer',
          !isClickable && 'cursor-default',
        )}
      >
        <span
          className={cn(
            'flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5',
            step.status === 'complete' && 'bg-green-500 text-white',
            step.status === 'in_progress' && 'bg-brand-mint text-gray-900',
            step.status === 'pending' && 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400',
          )}
        >
          {step.status === 'complete' && <Check className='w-3.5 h-3.5' />}
          {step.status === 'in_progress' && <Loader2 className='w-3.5 h-3.5 animate-spin' />}
          {step.status === 'pending' && <Circle className='w-3.5 h-3.5' />}
        </span>
        <div className='flex-1 min-w-0'>
          <div className='flex items-center gap-1.5 flex-wrap'>
            <span
              className={cn(
                'text-xs font-semibold leading-tight',
                step.status === 'complete' && 'text-green-800 dark:text-green-300',
                step.status === 'in_progress' && 'text-brand-mint dark:text-brand-mint',
                step.status === 'pending' && 'text-gray-600 dark:text-gray-400',
              )}
            >
              {step.label}
            </span>
            {step.isOptional && (
              <span className='text-[10px] px-1 py-px rounded bg-gray-200 dark:bg-gray-700 text-gray-500'>
                optional
              </span>
            )}
          </div>
          <p className='text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5'>
            {step.description}
          </p>
          {step.progress !== undefined && step.status !== 'complete' && (
            <div className='mt-1 flex items-center gap-1.5'>
              <div className='h-1 flex-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden'>
                <div
                  className='h-full bg-brand-mint rounded-full transition-all'
                  style={{ width: `${step.progress}%` }}
                />
              </div>
              <span className='text-[10px] text-gray-500 tabular-nums'>{step.progress}%</span>
            </div>
          )}
        </div>
        {isClickable && <ChevronRight className='w-4 h-4 text-gray-400 flex-shrink-0 mt-1' />}
      </button>
    </li>
  )
}
