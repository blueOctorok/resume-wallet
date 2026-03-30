'use client'

import { cn } from '@/lib/utils'
import { useJourneyProgress } from '@/stores'
import { useUIStore } from '@/stores'
import { useHubBlocksStore, useInstalledBlocks } from '@/stores/hub-blocks-store'
import type { PageType } from '@/stores/types'
import PathGuidance from './PathGuidance'
import CareerPathSteps from './CareerPathSteps'
import MiniCareerCard from './MiniCareerCard'

export interface HubSidebarProps {
  variant: 'sticky' | 'drawer'
  /** lg+ sidebar: used with scrollIntoView from Stormi “Open Journey” */
  id?: string
  onCloseDrawer?: () => void
  className?: string
}

export default function HubSidebar({ variant, id, onCloseDrawer, className }: HubSidebarProps) {
  const { setCurrentPage } = useUIStore()
  const openPicker = useHubBlocksStore((s) => s.openPicker)
  const userProfile = useHubBlocksStore((s) => s.userProfile)
  const installedBlocks = useInstalledBlocks()
  const progress = useJourneyProgress()

  const handleNavigate = (target: PageType) => {
    if (target === ('block-store' as PageType)) {
      onCloseDrawer?.()
      openPicker()
      return
    }
    const normalized: PageType = target === 'hub' || target === 'signin' ? null : target
    setCurrentPage(normalized)
    onCloseDrawer?.()
  }

  const body = (
    <div className='space-y-5'>
      <PathGuidance
        audience='candidate'
        firstName={userProfile?.firstName}
        installedBlockCount={installedBlocks.length}
        overallProgress={progress.overallProgress}
      />
      <hr className='border-gray-200 dark:border-gray-700' />
      <CareerPathSteps onNavigate={handleNavigate} />
      <hr className='border-gray-200 dark:border-gray-700' />
      <MiniCareerCard />
    </div>
  )

  if (variant === 'sticky') {
    // Sticky lives on the outer <aside> with NO overflow-hidden — overflow on a sticky ancestor
    // breaks stickiness / alignment in WebKit and can make the rail sit “one block” lower visually.
    // The chrome (blur, hairline, clip) stays on an inner wrapper.
    return (
      <aside
        id={id}
        className={cn(
          'hidden lg:block w-80 max-w-full shrink-0 self-start sticky top-24 p-0',
          className,
        )}
      >
        <div
          className={cn(
            'relative overflow-hidden rounded-2xl border border-slate-300/90 dark:border-gray-600/70',
            'bg-white dark:bg-gradient-to-b dark:from-gray-900/95 dark:to-gray-950/90',
            'p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_6px_20px_-6px_rgba(15,23,42,0.1)]',
            'dark:shadow-[0_16px_48px_-12px_rgba(0,0,0,0.5)]',
            'ring-1 ring-slate-200/80 dark:ring-teal-400/[0.08]',
          )}
        >
          <div
            aria-hidden
            className='pointer-events-none absolute inset-x-0 top-0 z-[1] h-px bg-gradient-to-r from-transparent via-slate-300/70 to-transparent dark:via-teal-400/30'
          />
          {body}
        </div>
      </aside>
    )
  }

  return <div className={cn('space-y-5', className)}>{body}</div>
}
