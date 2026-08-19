'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import { getBlockColor } from '@/lib/block-registry'
import { useJourneyProgress } from '@/stores'
import { useUIStore } from '@/stores'
import { useHubBlocksStore, useInstalledBlocks } from '@/stores/hub-blocks-store'
import type { PageType } from '@/stores/types'
import { VaultCredentialChrome } from '@/components/hub/HubBlockVault'
import PathGuidance from './PathGuidance'
import CareerPathSteps from './CareerPathSteps'
import MiniCareerCard from './MiniCareerCard'
import HubExploreLinks from './HubExploreLinks'

export interface HubSidebarProps {
  variant: 'sticky' | 'drawer'
  /** lg+ sidebar: used with scrollIntoView from Stormi “Open Journey” */
  id?: string
  onCloseDrawer?: () => void
  className?: string
}

export default function HubSidebar({ variant, id, onCloseDrawer, className }: HubSidebarProps) {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)
  const pathVaultGlow = getBlockColor('general-resume').glowColor
  const { setCurrentPage } = useUIStore()
  const userProfile = useHubBlocksStore((s) => s.userProfile)
  const installedBlocks = useInstalledBlocks()
  const progress = useJourneyProgress()

  const handleNavigate = (target: PageType) => {
    const normalized: PageType =
      target === 'hub' || target === 'signin' || target === ('block-store' as PageType)
        ? null
        : target
    setCurrentPage(normalized)
    onCloseDrawer?.()
  }

  const divider = (
    <div
      aria-hidden
      className='h-px shrink-0 bg-gradient-to-r from-transparent via-slate-300/55 to-transparent dark:via-teal-400/20'
    />
  )

  /** One vault panel: path + steps + explore + preview — no outer rounded card */
  const rail = (
    <VaultCredentialChrome
      isDark={isDark}
      glowColor={pathVaultGlow}
      hasRoute
      showSigil={false}
      className='w-full max-w-full min-w-0'
      // Drawer already has shadow; drop-shadow on vault spills past the panel on iOS and causes horizontal scroll
      style={
        variant === 'sticky'
          ? {
              filter: isDark
                ? 'drop-shadow(0 4px 22px rgba(0,0,0,0.5))'
                : 'drop-shadow(0 4px 14px rgba(15,23,42,0.1))',
            }
          : undefined
      }
    >
      <div className='flex min-h-0 min-w-0 flex-col gap-4 px-3.5 pb-[14px] pt-3.5'>
        <PathGuidance
          audience='candidate'
          firstName={userProfile?.firstName}
          installedBlockCount={installedBlocks.length}
          overallProgress={progress.overallProgress}
        />
        {divider}
        <CareerPathSteps onNavigate={handleNavigate} />
        {divider}
        <HubExploreLinks onCloseDrawer={onCloseDrawer} />
        {divider}
        <MiniCareerCard embedded />
      </div>
    </VaultCredentialChrome>
  )

  if (variant === 'sticky') {
    // Sticky on <aside> only — no overflow-hidden here (breaks stickiness in WebKit).
    return (
      <aside
        id={id}
        className={cn(
          'hidden lg:block w-80 max-w-full shrink-0 self-start sticky top-24 p-0',
          className,
        )}
      >
        {rail}
      </aside>
    )
  }

  return <div className={cn('min-w-0 max-w-full overflow-x-hidden', className)}>{rail}</div>
}
