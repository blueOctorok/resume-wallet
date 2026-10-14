'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface StripStep {
  key: string
  label: string
  hint?: string
  done: boolean
}

/**
 * Horizontal node/line progress strip. Purely presentational — callers derive
 * `steps` from their own data (see `deriveOutreachSteps`, `deriveDriverJourneySteps`).
 * The first step that isn't done renders as "current" with the ember pulse.
 */
export default function StepStrip({
  steps,
  muted = false,
  ariaLabel,
}: {
  steps: StripStep[]
  /** Dim the whole strip (e.g. cancelled invite). Also suppresses the "current" pulse. */
  muted?: boolean
  ariaLabel: string
}) {
  const currentIdx = steps.findIndex((s) => !s.done)

  return (
    <ol className={cn('flex items-start', muted && 'opacity-50')} aria-label={ariaLabel}>
      {steps.map((step, i) => {
        const state = step.done ? 'done' : i === currentIdx && !muted ? 'current' : 'upcoming'
        const last = i === steps.length - 1
        return (
          <li key={step.key} className={cn('relative flex min-w-0 flex-col items-center', last ? 'flex-none' : 'flex-1')}>
            {!last && (
              <span
                aria-hidden
                className={cn('absolute left-1/2 top-3 h-px w-full', state === 'done' ? 'bg-[#173150]' : 'bg-stone-200')}
              />
            )}
            <span
              className={cn(
                'relative z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 bg-white transition-colors',
                state === 'done' && 'border-[#173150] bg-[#173150]',
                state === 'current' && 'border-[#f15a2b]',
                state === 'upcoming' && 'border-stone-300',
              )}
            >
              {state === 'done' && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
              {state === 'current' && <span className="h-2 w-2 animate-pulse rounded-full bg-[#f15a2b]" />}
            </span>
            <span
              className={cn(
                'mt-1.5 px-1 text-center text-[11px] font-semibold leading-tight',
                state === 'upcoming' ? 'text-ironside' : 'text-[#173150]',
              )}
            >
              {step.label}
            </span>
            {step.hint && (
              <span
                className={cn(
                  'mt-0.5 max-w-[9rem] truncate px-1 text-center text-[10px] leading-tight',
                  state === 'current' ? 'text-[#f15a2b]' : 'text-ironside',
                )}
                title={step.hint}
              >
                {step.hint}
              </span>
            )}
          </li>
        )
      })}
    </ol>
  )
}
