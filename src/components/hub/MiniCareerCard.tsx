'use client'

/**
 * Live preview of what employers see — name, headline, and installed block pills with status.
 * Full Career Card + QR live on the career-card page (CTAs here).
 */

import { ExternalLink, QrCode } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores'
import { useHubBlocksStore } from '@/stores/hub-blocks-store'
import { useHubContext } from '@/lib/ava-chat'
import type { PageType } from '@/stores/types'
import Avatar from '@/components/ui/Avatar'

export default function MiniCareerCard() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const setCurrentPage = useUIStore((s) => s.setCurrentPage)
  const userProfile = useHubBlocksStore((s) => s.userProfile)
  const onboarding = useHubBlocksStore((s) => s.onboarding)
  const hubCtx = useHubContext()
  const blocksWithStatus = hubCtx.installedBlocks ?? []

  const displayName =
    [userProfile?.firstName, userProfile?.lastName].filter(Boolean).join(' ') || 'Your name'
  const headline = userProfile?.headline || onboarding?.occupation || 'Add a headline'

  const goCareerCard = () => setCurrentPage('career-card' as PageType)

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
        <button
          type='button'
          onClick={goCareerCard}
          className={cn(
            'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors',
            isDark ? 'bg-teal-600 text-white hover:bg-teal-500' : 'bg-teal-600 text-white hover:bg-teal-700',
          )}
        >
          <ExternalLink className='w-3 h-3' />
          Full card
        </button>
        <button
          type='button'
          onClick={goCareerCard}
          className={cn(
            'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors',
            isDark
              ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
          )}
        >
          <QrCode className='w-3 h-3' />
          QR
        </button>
      </div>
    </div>
  )
}
