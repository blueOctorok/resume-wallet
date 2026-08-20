'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import Button from '@/components/ui/Button'
import ProvvenMark from '@/components/ui/ProvvenMark'
import { useAuthStore, useUIStore } from '@/stores'
import { useDqCoachStore } from '@/stores/dq-coach-store'
import { buildDqActionSteps, type DqCoachTarget } from '@/lib/dq-coach'
import type { PageType } from '@/stores/types'

const TARGET_PAGE: Record<Exclude<DqCoachTarget, null>, PageType | 'profile'> = {
  profile: 'profile',
  dotapp: 'dotapp',
  mvr: 'mvr',
  psp: 'psp',
  'screening-consent': 'screening-consent',
  'employment-verification': 'employment-verification',
}

const THINKING_LINES = [
  'Comparing your profile to the MVR…',
  'Checking the DOT against your reports…',
  'Looking for holes and mismatches…',
]

function ThinkingBlock() {
  const [line, setLine] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => {
      setLine((n) => (n + 1) % THINKING_LINES.length)
    }, 2200)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div
      className='rounded-xl border border-[#173150]/15 bg-[#173150]/[0.04] px-4 py-5'
      role='status'
      aria-live='polite'
      aria-busy='true'
    >
      <p className='text-[10px] font-semibold uppercase tracking-[0.12em] text-[#5c6166]'>
        Thinking
      </p>
      <p className='mt-1 text-sm font-semibold text-[#173150]'>
        Reading your file like a safety clerk would
      </p>
      <p className='mt-1 text-xs leading-relaxed text-[#5c6166]'>{THINKING_LINES[line]}</p>
      <div className='mt-3 flex items-center gap-1.5' aria-hidden>
        <span className='size-2 rounded-full bg-[#f15a2b] motion-safe:animate-pulse' />
        <span
          className='size-2 rounded-full bg-[#f15a2b] motion-safe:animate-pulse'
          style={{ animationDelay: '160ms' }}
        />
        <span
          className='size-2 rounded-full bg-[#f15a2b] motion-safe:animate-pulse'
          style={{ animationDelay: '320ms' }}
        />
      </div>
    </div>
  )
}

export default function DqCoachPanel() {
  const sessionUserId = useAuthStore((s) => s.sessionUserId)
  const setShowProfileSetup = useAuthStore((s) => s.setShowProfileSetup)
  const setCurrentPage = useUIStore((s) => s.setCurrentPage)
  const review = useDqCoachStore((s) => s.review)
  const isLoading = useDqCoachStore((s) => s.isLoading)
  const error = useDqCoachStore((s) => s.error)
  const scan = useDqCoachStore((s) => s.scan)

  useEffect(() => {
    if (sessionUserId) void scan()
  }, [sessionUserId, scan])

  const go = (target: Exclude<DqCoachTarget, null>) => {
    if (target === 'profile') {
      setShowProfileSetup(true)
      return
    }
    setCurrentPage(TARGET_PAGE[target])
  }

  const steps = review ? buildDqActionSteps(review) : []

  return (
    <div>
      <div className='mb-4 flex items-start gap-3'>
        <ProvvenMark className='mt-0.5 shrink-0 text-xl' />
        <div className='min-w-0 flex-1'>
          <div className='flex items-start justify-between gap-2'>
            <p className='text-[11px] font-bold uppercase tracking-[0.14em] text-[#173150]'>
              Watching your file
            </p>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              onClick={() => void scan()}
              disabled={isLoading}
              className='!h-7 !px-2 !text-xs !text-[#173150] hover:!bg-stone-100'
              title='Scan again'
              aria-label='Scan file again'
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'opacity-40')} />
            </Button>
          </div>
          {isLoading ? (
            <p className='mt-1 text-sm leading-snug text-[#173150]'>
              Thinking through your file…
            </p>
          ) : error && !review ? (
            <p className='mt-1 text-sm text-red-700'>{error}</p>
          ) : review ? (
            <p className='mt-1 text-sm leading-snug text-[#5c6166]'>{review.watching}</p>
          ) : null}
        </div>
      </div>

      {isLoading ? <ThinkingBlock /> : null}

      {review && !isLoading ? (
        <div className='space-y-3'>
          {steps.length === 0 ? (
            <p className='text-sm font-medium text-[#173150]'>
              Nothing waiting on you — keep the file current when something changes.
            </p>
          ) : (
            <ol className='space-y-2'>
              {steps.map((step, i) => {
                const first = i === 0
                return (
                  <li key={`${step.target}-${step.title}`}>
                    <button
                      type='button'
                      onClick={() => go(step.target)}
                      className={cn(
                        'flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-colors',
                        first
                          ? 'border-[#f15a2b]/35 bg-[#f15a2b]/[0.04] hover:bg-[#f15a2b]/[0.07]'
                          : 'border-ironside/25 bg-white hover:border-[#f15a2b]/35 hover:bg-[#f15a2b]/[0.04]',
                      )}
                    >
                      <span
                        className={cn(
                          'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums',
                          first
                            ? 'bg-[#f15a2b] text-white'
                            : 'bg-stone-100 text-[#173150]',
                        )}
                      >
                        {i + 1}
                      </span>
                      <span className='min-w-0 flex-1'>
                        {first ? (
                          <span className='text-[10px] font-semibold uppercase tracking-[0.12em] text-[#5c6166]'>
                            Do this first
                          </span>
                        ) : null}
                        <span
                          className={cn(
                            'block text-sm font-semibold leading-snug text-[#173150]',
                            first && 'mt-0.5',
                          )}
                        >
                          {step.title}
                        </span>
                        {step.detail ? (
                          <span className='mt-1 block text-xs leading-relaxed text-[#5c6166]'>
                            {step.detail}
                          </span>
                        ) : null}
                      </span>
                      <span className='flex shrink-0 items-center gap-1 pt-0.5 text-xs font-semibold text-[#173150]'>
                        Open
                        <ArrowRight className='h-3.5 w-3.5' aria-hidden />
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      ) : null}
    </div>
  )
}
