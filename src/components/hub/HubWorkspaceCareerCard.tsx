'use client'

import { useCallback, useState } from 'react'
import { Loader2, AlertCircle, Pencil, Share2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuthStore, useUIStore } from '@/stores'
import { useHubBlocksStore, useInstalledBlocks } from '@/stores/hub-blocks-store'
import { getBlockDefinition } from '@/lib/block-registry'
import type { PageType } from '@/stores/types'
import ProjectedCareerCard from '@/components/career-card/ProjectedCareerCard'
import Button from '@/components/ui/Button'
import CareerCardShareModal from '@/components/hub/CareerCardShareModal'
import { useProjectedCareerCard } from '@/hooks/use-projected-career-card'

export interface HubWorkspaceCareerCardProps {
  /** Bumps when hub data is refreshed so the card refetches from `/api/career-card`. */
  refreshNonce: number
}

/**
 * Full-size interactive career card for Construct (hub) — the hub "cake".
 * No outer panel wrapper — ProjectedCareerCard's VaultShell IS the container.
 * Share + Edit live in the card header (`selfHeaderActions`); hub refresh is in the nav.
 */
export default function HubWorkspaceCareerCard({ refreshNonce }: HubWorkspaceCareerCardProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const walletAddress = useAuthStore((s) => s.walletAddress)
  const setShowProfileSetup = useAuthStore((s) => s.setShowProfileSetup)
  const setCurrentPage = useUIStore((s) => s.setCurrentPage)
  const openPicker = useHubBlocksStore((s) => s.openPicker)
  const updateAvatarUrl = useHubBlocksStore((s) => s.updateAvatarUrl)
  const installedBlocks = useInstalledBlocks()
  const [shareOpen, setShareOpen] = useState(false)

  const { card, loading, error, refresh } = useProjectedCareerCard(walletAddress, {
    refreshNonce,
    installedBlockCount: installedBlocks.length,
  })

  const handleNavigateToBlock = useCallback(
    (blockType: string) => {
      const route = getBlockDefinition(blockType)?.pageRoute
      if (route) setCurrentPage(route as PageType)
    },
    [setCurrentPage],
  )

  if (!walletAddress) {
    return null
  }

  if (loading && !card) {
    return (
      <div className='flex items-center justify-center py-16'>
        <Loader2 className={cn('h-8 w-8 animate-spin', isDark ? 'text-gray-400' : 'text-slate-500')} />
      </div>
    )
  }

  if (error || !card) {
    return (
      <div
        className={cn(
          'rounded-xl border p-6 text-center',
          isDark ? 'border-gray-700 bg-gray-800/60' : 'border-slate-200 bg-white dark:bg-gray-900',
        )}
      >
        <AlertCircle className='mx-auto mb-3 h-8 w-8 text-red-500' />
        <p className={cn('mb-1 text-sm font-medium', isDark ? 'text-white' : 'text-slate-900')}>
          Couldn&apos;t load your career card
        </p>
        <p className={cn('mb-4 text-xs', isDark ? 'text-gray-400' : 'text-slate-600')}>{error}</p>
        <Button variant='secondary' size='sm' onClick={() => void refresh()}>
          Try again
        </Button>
      </div>
    )
  }

  const ghostBtn = isDark ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'

  return (
    <div className='min-w-0'>
      <ProjectedCareerCard
        data={card}
        mode='self'
        walletAddress={walletAddress}
        onNavigateToBlock={handleNavigateToBlock}
        onAddBlock={openPicker}
        onAvatarUploadSuccess={(url) => {
          updateAvatarUrl(url)
          void refresh()
        }}
        selfHeaderActions={
          <>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              className={cn('gap-1 px-2', ghostBtn)}
              title='Share career card'
              aria-label='Share career card'
              onClick={() => setShareOpen(true)}
            >
              <Share2 className='h-3.5 w-3.5' />
              <span className='hidden text-xs font-medium sm:inline'>Share</span>
            </Button>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              className={cn('gap-1 px-2', ghostBtn)}
              title='Edit profile'
              onClick={() => setShowProfileSetup(true)}
            >
              <Pencil className='h-3.5 w-3.5' />
              <span className='hidden text-xs font-medium sm:inline'>Edit</span>
            </Button>
          </>
        }
      />
      <CareerCardShareModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        walletAddress={walletAddress}
        displayName={card.name?.trim() || undefined}
        onShareUpdated={() => void refresh()}
      />
    </div>
  )
}
