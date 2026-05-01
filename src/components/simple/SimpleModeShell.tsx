'use client'

import { isDarkTheme } from '@/lib/theme-storage'
/**
 * SimpleModeShell — the job-first split view.
 *
 * Layout:
 *   - >= lg: 3-column desktop grid (rail | job detail | card panel).
 *   - md–lg: 2-column grid (rail | detail). Card via sliver + sheet.
 *   - < md (phones): animated tab bar at bottom — Jobs / Job / Card.
 *     Each tab is a full-screen panel; no stacking, no gestures.
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
import MobileTabBar from './MobileTabBar'

const GRADUATE_BANNER_STEP = 'simple-graduate-banner-dismissed'
const GRADUATE_BLOCK_THRESHOLD = 3

export default function SimpleModeShell() {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)
  const walletAddress = useAuthStore((s) => s.walletAddress)
  const installedCount = useInstalledBlocks().length
  const hasDismissedGraduate = usePreferencesStore((s) => s.hasCompletedJourneyStep(GRADUATE_BANNER_STEP))
  const markJourneyStepComplete = usePreferencesStore((s) => s.markJourneyStepComplete)
  const setUiMode = useUIModeStore((s) => s.setMode)

  const showGraduateBanner = useMemo(
    () => installedCount >= GRADUATE_BLOCK_THRESHOLD && !hasDismissedGraduate,
    [installedCount, hasDismissedGraduate],
  )

  // Sheet state — only used on iPad portrait (md–lg) via sliver
  const isCardSheetOpen = useSimpleModeStore((s) => s.isCardSheetOpen)
  const openCardSheet = useSimpleModeStore((s) => s.openCardSheet)
  const closeCardSheet = useSimpleModeStore((s) => s.closeCardSheet)

  // Phone tab bar state
  const mobileTab = useSimpleModeStore((s) => s.mobileTab)
  const setMobileTab = useSimpleModeStore((s) => s.setMobileTab)

  useSelectedJobSync()

  const handleJobSelected = useCallback(() => {
    // Phones: switch to the Job tab so the user reads the posting.
    // Tablets/desktop: no-op (inline panels show everything already).
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
      setMobileTab('job')
    }
  }, [setMobileTab])

  return (
    <div
      className={cn(
        'flex w-full min-h-[calc(100vh-7rem)] flex-col px-3 sm:px-4 lg:px-6 py-4',
        // On phones, override to fill the dynamic viewport and ditch extra padding
        'max-md:min-h-[100dvh] max-md:px-0 max-md:py-0',
        isDark ? 'text-white' : 'text-slate-900',
      )}
    >
      {showGraduateBanner && (
        <div
          className={cn(
            'mb-4 rounded-2xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 max-md:mx-3 max-md:mt-3',
            isDark ? 'bg-teal-500/10 border-teal-500/30' : 'bg-teal-50 border-teal-200',
          )}
        >
          <p className={cn('text-sm', isDark ? 'text-teal-100' : 'text-teal-900')}>
            <span className='font-semibold'>You&apos;ve got the hang of this.</span>{' '}
            Try Construct mode for power tools — you can flip back anytime.
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
              Open Construct mode
            </Button>
          </div>
        </div>
      )}

      {/* ================================================
          Desktop / iPad — grid, md+
          ================================================ */}
      <div
        className={cn(
          'hidden md:grid gap-3 lg:gap-4 h-[calc(100vh-8rem)]',
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
        <aside aria-label='Career card' className='hidden lg:block min-h-0'>
          <SimpleCardPanel />
        </aside>
      </div>

      {/* iPad portrait (md–lg): sliver + sheet for card access */}
      <SimpleCardSliver />
      <SimpleMobileSheet open={isCardSheetOpen} onClose={closeCardSheet} />

      {/* ================================================
          Phone — tab bar navigation, < md
          Content gets bottom padding so it never hides behind the fixed bar.
          ================================================ */}
      <div className='flex min-h-0 flex-1 flex-col pb-[4.5rem] md:hidden'>
        {mobileTab === 'jobs' && (
          <div className='flex min-h-0 flex-1 flex-col px-2'>
            <SimpleJobRail userAddress={walletAddress ?? null} onJobSelected={handleJobSelected} />
          </div>
        )}
        {mobileTab === 'job' && (
          <div className='flex min-h-0 flex-1 flex-col px-2'>
            <SimpleJobDetailPanel userAddress={walletAddress ?? null} />
          </div>
        )}
        {mobileTab === 'card' && (
          <div className='flex min-h-0 flex-1 flex-col overflow-y-auto px-2 py-2'>
            <SimpleCardPanel />
          </div>
        )}
      </div>
      {/* Fixed bar — renders outside the content container */}
      <MobileTabBar />
    </div>
  )
}
