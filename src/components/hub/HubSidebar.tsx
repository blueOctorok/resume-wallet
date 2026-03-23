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
  /** lg+ sidebar: used with scrollIntoView from AvA “Open Journey” */
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
    return (
      <aside
        id={id}
        className={cn(
          'hidden lg:block w-80 shrink-0 self-start sticky top-24',
          'rounded-2xl border border-gray-200 dark:border-gray-700',
          'bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm p-4 shadow-sm',
          className,
        )}
      >
        {body}
      </aside>
    )
  }

  return <div className={cn('space-y-5', className)}>{body}</div>
}
