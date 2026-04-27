'use client'

/**
 * SimpleModeShell — the job-first split view.
 *
 * Layout:
 *   - ≥ md: 3-column desktop grid (rail | job detail | card panel) that
 *     collapses to 2-column on smaller screens. iPad landscape fits the
 *     3-col layout naturally because md breakpoint hits at 768px.
 *   - Mobile/portrait (< md): full-height job rail; posting + career card
 *     live in a tabbed `SimpleMobileSheet`. `SimpleCardSliver` opens the sheet
 *     or jumps to Job / Your card.
 *
 * The selection pointer (`simple-mode-store`) is mirrored to `?selected=`
 * via `useSelectedJobSync` so shared links + browser-back work. The shell
 * itself is otherwise stateless — everything reads from the stores.
 */

import { useCallback, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuthStore, usePreferencesStore } from '@/stores'
import { useInstalledBlocks } from '@/stores/hub-blocks-store'
import { useUIModeStore } from '@/stores/ui-mode-store'
import Button from '@/components/ui/Button'
import { useSimpleModeStore } from '@/stores/simple-mode-store'
import { useSelectedJobSync } from '@/hooks/use-selected-job-sync'
import SimpleJobRail from './SimpleJobRail'
import SimpleJobDetailPanel from './SimpleJobDetailPanel'
import SimpleCardPanel from './SimpleCardPanel'
import SimpleCardSliver from './SimpleCardSliver'
import SimpleMobileSheet from './SimpleMobileSheet'

const GRADUATE_BANNER_STEP = 'simple-graduate-banner-dismissed'
const GRADUATE_BLOCK_THRESHOLD = 3

export default function SimpleModeShell() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const walletAddress = useAuthStore((s) => s.walletAddress)
  const installedCount = useInstalledBlocks().length
  const hasDismissedGraduate = usePreferencesStore((s) => s.hasCompletedJourneyStep(GRADUATE_BANNER_STEP))
  const markJourneyStepComplete = usePreferencesStore((s) => s.markJourneyStepComplete)
  const setUiMode = useUIModeStore((s) => s.setMode)

  const showGraduateBanner = useMemo(
    () => installedCount >= GRADUATE_BLOCK_THRESHOLD && !hasDismissedGraduate,
    [installedCount, hasDismissedGraduate],
  )

  const isCardSheetOpen = useSimpleModeStore((s) => s.isCardSheetOpen)
  const openCardSheet = useSimpleModeStore((s) => s.openCardSheet)
  const closeCardSheet = useSimpleModeStore((s) => s.closeCardSheet)

  useSelectedJobSync()

  const handleJobSelected = useCallback(() => {
    // Mobile: rail is full-screen — open the sheet on the Job tab so they read
    // the posting first. Desktop: no-op (inline panels already show everything).
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
      openCardSheet('job')
    }
  }, [openCardSheet])

  return (
    <div
      className={cn(
        'flex w-full min-h-[calc(100vh-7rem)] flex-col px-3 sm:px-4 lg:px-6 py-4',
        isDark ? 'text-white' : 'text-slate-900',
      )}
    >
      {showGraduateBanner && (
        <div
          className={cn(
            'mb-4 rounded-2xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3',
            isDark ? 'bg-teal-500/10 border-teal-500/30' : 'bg-teal-50 border-teal-200',
          )}
        >
          <p className={cn('text-sm', isDark ? 'text-teal-100' : 'text-teal-900')}>
            <span className='font-semibold'>You&apos;ve got the hang of this.</span>{' '}
            Try the full workspace for power tools — you can flip back anytime.
          </p>
          <div className='flex gap-2 shrink-0'>
            <Button
              type='button'
              variant='secondary'
              size='sm'
              onClick={() => markJourneyStepComplete(GRADUATE_BANNER_STEP)}
            >
              Not now
            </Button>
            <Button
              type='button'
              variant='primary'
              size='sm'
              onClick={() => {
                markJourneyStepComplete(GRADUATE_BANNER_STEP)
                setUiMode('hub')
              }}
            >
              Open workspace
            </Button>
          </div>
        </div>
      )}

      {/* Desktop / iPad landscape — 3-column grid, md+ */}
      <div
        className={cn(
          'hidden md:grid gap-3 lg:gap-4 h-[calc(100vh-8rem)]',
          // Rail capped so the job column always wins horizontal space on md (2-col).
          'grid-cols-[minmax(240px,300px)_minmax(0,1fr)]',
          'lg:grid-cols-[minmax(250px,280px)_minmax(0,1.4fr)_minmax(320px,1.15fr)]',
        )}
      >
        <section aria-label='Job list' className='min-h-0 min-w-0'>
          <SimpleJobRail userAddress={walletAddress ?? null} onJobSelected={handleJobSelected} />
        </section>
        <section aria-label='Selected job' className='min-h-0 min-w-0'>
          <SimpleJobDetailPanel userAddress={walletAddress ?? null} />
        </section>
        {/* The card panel only appears at lg+ so md (iPad portrait-ish) users
            don't get a cramped 3-col layout. md users tap the sliver for the card. */}
        <aside aria-label='Career card' className='hidden lg:block min-h-0'>
          <SimpleCardPanel />
        </aside>
      </div>

      {/* Mobile — rail fills space under nav; job + card live in SimpleMobileSheet */}
      <div className='flex min-h-0 flex-1 flex-col pb-24 md:hidden'>
        <SimpleJobRail userAddress={walletAddress ?? null} onJobSelected={handleJobSelected} />
      </div>

      {/* Sliver + sheet below `lg` — iPad portrait + phones */}
      <SimpleCardSliver />
      <SimpleMobileSheet open={isCardSheetOpen} onClose={closeCardSheet} />
    </div>
  )
}
