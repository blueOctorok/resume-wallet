'use client'

import { useEffect } from 'react'
import { AlertTriangle, ArrowRight, Info, Loader2, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
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

/** Beat Card's dark: slate face — this well is always cream paper. */
const paperCard =
  '!bg-white !border-ironside/20 !shadow-none dark:!bg-white dark:!border-ironside/20'

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
    <div className='mb-5'>
      <div className='mb-3 flex items-start gap-3'>
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
              {isLoading ? (
                <Loader2 className='h-3.5 w-3.5 animate-spin' />
              ) : (
                <RefreshCw className='h-3.5 w-3.5' />
              )}
            </Button>
          </div>
          {isLoading && !review ? (
            <p className='mt-1 text-sm text-[#173150]'>
              Reading your career card and every block…
            </p>
          ) : error && !review ? (
            <p className='mt-1 text-sm text-red-700'>{error}</p>
          ) : review ? (
            <p className='mt-1 text-sm leading-snug text-[#5c6166]'>{review.watching}</p>
          ) : null}
        </div>
      </div>

      {review ? (
        <div className='space-y-3'>
          {review.next ? (
            <Card variant='flat' className={cn(paperCard, 'p-4')}>
              <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                <div className='min-w-0'>
                  <p className='text-[10px] font-semibold uppercase tracking-[0.12em] text-[#5c6166]'>
                    Next
                  </p>
                  <p className='mt-0.5 text-sm font-semibold text-[#173150]'>{review.next.title}</p>
                  {review.next.detail ? (
                    <p className='mt-1 text-xs leading-relaxed text-[#5c6166]'>{review.next.detail}</p>
                  ) : null}
                </div>
                {review.next.target ? (
                  <Button type='button' variant='primary' size='sm' onClick={goNext} className='shrink-0'>
                    Open
                    <ArrowRight className='h-3.5 w-3.5' aria-hidden />
                  </Button>
                ) : null}
              </div>
            </Card>
          ) : (
            <p className='text-sm font-medium text-[#173150]'>
              No holes right now — keep the file current when something changes.
            </p>
          )}

          {review.flags.length > 0 ? (
            <ul className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
              {review.flags.map((flag, i) => {
                const warn = flag.severity === 'warn'
                const Icon = warn ? AlertTriangle : Info
                return (
                  <li key={`${flag.title}-${i}`}>
                    <Card variant='flat' className={cn(paperCard, 'h-full p-3.5')}>
                      <div className='flex items-start gap-2.5'>
                        <span
                          className={cn(
                            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                            warn ? 'bg-amber-50 text-amber-800' : 'bg-stone-100 text-[#5c6166]',
                          )}
                        >
                          <Icon className='h-3.5 w-3.5' aria-hidden />
                        </span>
                        <div className='min-w-0'>
                          <p className='text-sm font-semibold leading-snug text-[#173150]'>{flag.title}</p>
                          <p className='mt-1 text-xs leading-relaxed text-[#5c6166]'>{flag.detail}</p>
                        </div>
                      </div>
                    </Card>
                  </li>
                )
              })}
            </ul>
          ) : null}

          {review.clear.length > 0 ? (
            <div className='flex flex-wrap gap-1.5'>
              {review.clear.map((item) => (
                <span
                  key={item}
                  className='rounded-full border border-ironside/20 bg-white px-2.5 py-1 text-[11px] text-[#173150]'
                >
                  {item}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
