'use client'

/**
 * SimpleModeShell — the job-first split view.
 *
 * Layout:
 *   - ≥ md: 3-column desktop grid (rail | job detail | card panel) that
 *     collapses to 2-column on smaller screens. iPad landscape fits the
 *     3-col layout naturally because md breakpoint hits at 768px.
 *   - Mobile/portrait (< md): job rail + detail stack; card lives in the
 *     swipe-up `SimpleCardSheet`. A `SimpleCardSliver` stays pinned so the
 *     card is always one tap away.
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
import SimpleCardSheet from './SimpleCardSheet'

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
    // On mobile, nudge the sliver visible — parent already re-renders the
    // detail panel so the user sees the job. The sheet stays closed until
    // tapped — we don't want to spring the card over a user who's still
    // reading the job description.
  }, [])

  return (
    <div
      className={cn(
        'w-full min-h-[calc(100vh-7rem)] px-3 sm:px-4 lg:px-6 py-4',
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
          'hidden md:grid gap-4 h-[calc(100vh-8rem)]',
          'grid-cols-[300px_1fr] lg:grid-cols-[320px_1.2fr_1fr]',
        )}
      >
        <section aria-label='Job list' className='min-h-0'>
          <SimpleJobRail userAddress={walletAddress ?? null} onJobSelected={handleJobSelected} />
        </section>
        <section aria-label='Selected job' className='min-h-0'>
          <SimpleJobDetailPanel userAddress={walletAddress ?? null} />
        </section>
        {/* The card panel only appears at lg+ so md (iPad portrait-ish) users
            don't get a cramped 3-col layout. md users tap the sliver for the card. */}
        <aside aria-label='Career card' className='hidden lg:block min-h-0'>
          <SimpleCardPanel />
        </aside>
      </div>

      {/* Mobile — stack detail above; rail compact at top */}
      <div className='md:hidden flex flex-col gap-3 pb-24'>
        <div className='h-[300px]'>
          <SimpleJobRail userAddress={walletAddress ?? null} onJobSelected={handleJobSelected} />
        </div>
        <div className='min-h-[400px]'>
          <SimpleJobDetailPanel
            userAddress={walletAddress ?? null}
            onOpenCardSheet={openCardSheet}
          />
        </div>
      </div>

      {/* Sliver + sheet cover anything below `lg` — the sliver itself handles
          the breakpoint via `lg:hidden`, so iPad portrait + phones both get it. */}
      <SimpleCardSliver onOpen={openCardSheet} />
      <SimpleCardSheet open={isCardSheetOpen} onClose={closeCardSheet} />
    </div>
  )
}
