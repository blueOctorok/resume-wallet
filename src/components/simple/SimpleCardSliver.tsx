'use client'

/**
 * SimpleCardSliver — thin bar pinned to the bottom of the screen on any
 * viewport narrower than `lg` (so: phones AND iPad portrait, where the
 * 3-column split collapses and the card panel is hidden). Tap or swipe up
 * to open the full-screen `SimpleCardSheet`. Works like a music-player
 * "now playing" bar so the card is never more than one tap away.
 */

import { ChevronUp, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import { useInstalledBlocks } from '@/stores/hub-blocks-store'
import { useSimpleModeStore } from '@/stores/simple-mode-store'

interface SimpleCardSliverProps {
  onOpen: () => void
}

export default function SimpleCardSliver({ onOpen }: SimpleCardSliverProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const installedCount = useInstalledBlocks().length
  const snap = useSimpleModeStore((s) => s.selectedJobSnapshot)

  return (
    <button
      type='button'
      onClick={onOpen}
      className={cn(
        'fixed bottom-3 inset-x-3 z-40 rounded-2xl border px-4 py-3 flex items-center gap-3 shadow-xl backdrop-blur',
        // Hide at lg+ — that's where the 3-col grid shows the card panel inline
        'lg:hidden cursor-pointer',
        isDark
          ? 'bg-gray-900/90 border-gray-700 text-white'
          : 'bg-white/95 border-slate-200 text-slate-900',
      )}
      aria-label='Open career card'
    >
      <div
        className={cn(
          'w-9 h-9 rounded-full flex items-center justify-center',
          isDark ? 'bg-teal-500/20 text-teal-200' : 'bg-teal-100 text-teal-700',
        )}
      >
        <User className='w-4 h-4' />
      </div>
      <div className='flex-1 min-w-0 text-left'>
        <p className='text-xs font-semibold'>Your career card</p>
        <p className={cn('text-[11px] truncate', isDark ? 'text-gray-400' : 'text-slate-500')}>
          {snap
            ? `Building for ${snap.title}`
            : installedCount === 0
              ? 'Pick a job and Stormi will guide you'
              : `${installedCount} block${installedCount === 1 ? '' : 's'} installed`}
        </p>
      </div>
      <ChevronUp className={cn('w-4 h-4', isDark ? 'text-gray-400' : 'text-slate-500')} />
    </button>
  )
}
