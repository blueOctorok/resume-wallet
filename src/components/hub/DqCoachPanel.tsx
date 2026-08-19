'use client'

import { useEffect } from 'react'
import { AlertTriangle, ArrowRight, Loader2, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import Button from '@/components/ui/Button'
import ProvvenMark from '@/components/ui/ProvvenMark'
import { useAuthStore, useUIStore } from '@/stores'
import { useDqCoachStore } from '@/stores/dq-coach-store'
import type { DqCoachTarget } from '@/lib/dq-coach'
import type { PageType } from '@/stores/types'

const TARGET_PAGE: Record<Exclude<DqCoachTarget, null>, PageType | 'profile'> = {
  profile: 'profile',
  dotapp: 'dotapp',
  mvr: 'mvr',
  psp: 'psp',
  'screening-consent': 'screening-consent',
  'employment-verification': 'employment-verification',
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

  const goNext = () => {
    const target = review?.next?.target
    if (!target) return
    if (target === 'profile') {
      setShowProfileSetup(true)
      return
    }
    setCurrentPage(TARGET_PAGE[target])
  }

  return (
    <div className='mb-5 rounded-xl border border-violet-200/80 bg-violet-50/50 px-4 py-3.5 dark:border-violet-400/20 dark:bg-violet-500/[0.07]'>
      <div className='flex items-start gap-3'>
        <ProvvenMark className='mt-0.5 shrink-0 text-xl' />
        <div className='min-w-0 flex-1'>
          <div className='flex items-start justify-between gap-2'>
            <p className='text-[11px] font-bold uppercase tracking-[0.14em] text-violet-800 dark:text-violet-200'>
              Watching your file
            </p>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              onClick={() => void scan()}
              disabled={isLoading}
              className='!h-7 !px-2 !text-xs'
              title='Scan again'
              aria-label='Scan file again'
            >
              {isLoading ? (
                <Loader2 className='h-3.5 w-3.5 animate-spin' />
              ) : (
                <RefreshCw className='h-3.5 w-3.5' />
              )}
            </Button>
          </div>

          {isLoading && !review ? (
            <p className='mt-1 text-sm text-[#173150] dark:text-gray-200'>
              Reading your career card and every block…
            </p>
          ) : error && !review ? (
            <p className='mt-1 text-sm text-red-700 dark:text-red-300'>{error}</p>
          ) : review ? (
            <div className='mt-1.5 space-y-3'>
              <p className='text-sm leading-snug text-[#173150] dark:text-gray-200'>
                {review.watching}
              </p>

              {review.next ? (
                <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                  <div className='min-w-0'>
                    <p className='text-sm font-semibold text-[#173150] dark:text-white'>
                      Next: {review.next.title}
                    </p>
                    {review.next.detail ? (
                      <p className='mt-0.5 text-xs leading-snug text-ironside'>{review.next.detail}</p>
                    ) : null}
                  </div>
                  {review.next.target ? (
                    <Button type='button' variant='primary' size='sm' onClick={goNext} className='shrink-0'>
                      Open
                      <ArrowRight className='h-3.5 w-3.5' aria-hidden />
                    </Button>
                  ) : null}
                </div>
              ) : (
                <p className='text-sm font-medium text-[#173150] dark:text-gray-100'>
                  No holes right now — keep the file current when something changes.
                </p>
              )}

              {review.flags.length > 0 ? (
                <ul className='space-y-2'>
                  {review.flags.map((flag) => (
                    <li key={flag.title} className='flex items-start gap-2 text-sm'>
                      <AlertTriangle
                        className={cn(
                          'mt-0.5 h-3.5 w-3.5 shrink-0',
                          flag.severity === 'warn'
                            ? 'text-amber-700 dark:text-amber-300'
                            : 'text-ironside',
                        )}
                        aria-hidden
                      />
                      <span className='min-w-0'>
                        <span className='font-medium text-[#173150] dark:text-gray-100'>{flag.title}.</span>{' '}
                        <span className='text-ironside'>{flag.detail}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}

              {review.clear.length > 0 ? (
                <p className='text-xs text-ironside'>Solid: {review.clear.join(' · ')}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
