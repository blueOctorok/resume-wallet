'use client'

/**
 * Live preview of what employers see — name, headline, and installed block pills with status.
 * Full card opens the in-app career card; QR opens share link + QR modal (public /card/[token]).
 */

import { useState } from 'react'
import { ExternalLink, QrCode } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'
import { useUIStore, useAuthStore } from '@/stores'
import { useHubBlocksStore } from '@/stores/hub-blocks-store'
import { useHubContext } from '@/lib/ava-chat'
import type { PageType } from '@/stores/types'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import CareerCardShareModal from '@/components/hub/CareerCardShareModal'

export default function MiniCareerCard() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const setCurrentPage = useUIStore((s) => s.setCurrentPage)
  const walletAddress = useAuthStore((s) => s.walletAddress)
  const userProfile = useHubBlocksStore((s) => s.userProfile)
  const onboarding = useHubBlocksStore((s) => s.onboarding)
  const hubCtx = useHubContext()
  const blocksWithStatus = hubCtx.installedBlocks ?? []

  const displayName =
    [userProfile?.firstName, userProfile?.lastName].filter(Boolean).join(' ') || 'Your name'
  const headline = userProfile?.headline || onboarding?.occupation || 'Add a headline'

  const goCareerCard = () => setCurrentPage('career-card' as PageType)
  const [shareModalOpen, setShareModalOpen] = useState(false)

  const statusStyles = {
    complete: 'bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30',
    'in-progress': 'bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/25',
    empty: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600',
  } as const

  return (
    <div
      className={cn(
        'rounded-xl border p-3 space-y-3',
        isDark ? 'border-gray-700 bg-gray-800/40' : 'border-slate-200 bg-white/90',
      )}
    >
      <p className='text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400'>
        Career card preview
      </p>

      <div className='flex gap-3 items-start'>
        <Avatar
          name={displayName}
          avatarUrl={userProfile?.avatarUrl ?? null}
          size='sm'
          color='teal'
          className='!rounded-full'
        />
        <div className='min-w-0 flex-1'>
          <p className={cn('text-sm font-bold truncate', isDark ? 'text-white' : 'text-slate-900')}>
            {displayName}
          </p>
          <p className={cn('text-xs line-clamp-2', isDark ? 'text-gray-400' : 'text-slate-600')}>
            {headline}
          </p>
        </div>
      </div>

      {blocksWithStatus.length === 0 ? (
        <p className='text-xs text-gray-500 dark:text-gray-400'>Blocks you add appear here as pills.</p>
      ) : (
        <div className='flex flex-wrap gap-1'>
          {blocksWithStatus.map((b) => (
            <span
              key={b.blockType}
              className={cn(
                'text-[10px] font-medium px-1.5 py-0.5 rounded-md border max-w-full truncate',
                statusStyles[b.status],
              )}
              title={b.label}
            >
              {b.label}
            </span>
          ))}
        </div>
      )}

      <div className='flex flex-wrap gap-2 pt-0.5'>
        <Button variant='primary' size='sm' onClick={goCareerCard} className='text-[11px] px-2.5 py-1 h-auto'>
          <ExternalLink className='w-3 h-3' />
          Full card
        </Button>
        <Button
          variant='secondary'
          size='sm'
          onClick={() => setShareModalOpen(true)}
          className='text-[11px] px-2.5 py-1 h-auto'
          title='Share link and QR code'
        >
          <QrCode className='w-3 h-3' />
          QR & link
        </Button>
      </div>

      <CareerCardShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        walletAddress={walletAddress}
        displayName={displayName === 'Your name' ? undefined : displayName}
      />
    </div>
  )
}
