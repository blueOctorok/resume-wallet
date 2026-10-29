'use client'

import { isDarkTheme } from '@/lib/theme-storage'
/**
 * Name, headline, and installed block pills inside the Stormi drawer.
 * Share opens the public career card link. The driver's home is the File.
 */

import { useState } from 'react'
import { QrCode } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores'
import { useHubBlocksStore } from '@/stores/hub-blocks-store'
import { useHubContext } from '@/lib/ava-chat'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import CareerCardShareModal from '@/components/hub/CareerCardShareModal'

export interface MiniCareerCardProps {
  /** Inside hub vault rail — drop nested card chrome */
  embedded?: boolean
}

export default function MiniCareerCard({ embedded = false }: MiniCareerCardProps) {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)
  const sessionUserId = useAuthStore((s) => s.sessionUserId)
  const userProfile = useHubBlocksStore((s) => s.userProfile)
  const onboarding = useHubBlocksStore((s) => s.onboarding)
  const hubCtx = useHubContext()
  const blocksWithStatus = hubCtx.installedBlocks ?? []

  const displayName =
    [userProfile?.firstName, userProfile?.lastName].filter(Boolean).join(' ') || 'Your name'
  const headline = userProfile?.headline || onboarding?.occupation || 'Add a headline'

  const [shareModalOpen, setShareModalOpen] = useState(false)

  const statusStyles = {
    complete: 'border-teal-500/35 bg-teal-500/10 text-teal-800 dark:text-teal-300',
    'in-progress': 'bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/25',
    empty: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600',
  } as const

  return (
    <div
      className={cn(
        'space-y-3',
        !embedded && [
          'relative overflow-hidden rounded-2xl border p-3',
          'ring-1 dark:ring-teal-400/[0.08]',
          isDark
            ? 'border-gray-600/60 bg-gradient-to-b from-gray-900/90 to-gray-950/90 ring-teal-500/[0.06]'
            : 'border-slate-300/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_14px_-4px_rgba(15,23,42,0.08)] ring-slate-200/80',
        ],
        embedded && 'pt-0.5',
      )}
    >
      {!embedded && (
        <div
          aria-hidden
          className='pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-300/65 to-transparent dark:via-teal-400/25'
        />
      )}
      <p className='text-[10px] font-bold uppercase tracking-[0.18em] text-teal-800 dark:text-teal-400/80'>
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
        <Button
          variant='secondary'
          size='sm'
          onClick={() => setShareModalOpen(true)}
          className='text-[11px] px-2.5 py-1 h-auto'
          title='Share public career card link'
        >
          <QrCode className='w-3 h-3' />
          Share
        </Button>
      </div>

      <CareerCardShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        sessionUserId={sessionUserId}
        displayName={displayName === 'Your name' ? undefined : displayName}
      />
    </div>
  )
}
