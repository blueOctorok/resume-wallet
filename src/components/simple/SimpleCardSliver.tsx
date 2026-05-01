'use client'

import { isDarkTheme } from '@/lib/theme-storage'
/**
 * SimpleCardSliver — card access bar for iPad portrait (md–lg only).
 *
 * Phones use `MobileTabBar` instead; desktop (lg+) shows the card inline.
 * This bar fills the gap at md–lg where the grid is 2-col (rail + detail)
 * and the career card lives in a sheet.
 */

import { ChevronUp, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import { useInstalledBlocks } from '@/stores/hub-blocks-store'
import { useSimpleModeStore } from '@/stores/simple-mode-store'

export default function SimpleCardSliver() {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)
  const installedCount = useInstalledBlocks().length
  const snap = useSimpleModeStore((s) => s.selectedJobSnapshot)
  const openCardSheet = useSimpleModeStore((s) => s.openCardSheet)

  return (
    <button
      type='button'
      onClick={() => openCardSheet('card')}
      className={cn(
        // Only visible at md–lg (iPad portrait). Phones have tab bar; lg+ has inline card.
        'fixed bottom-3 inset-x-3 z-40 hidden md:flex lg:hidden',
        'items-center gap-3 rounded-2xl border px-4 py-3 shadow-xl backdrop-blur cursor-pointer',
        isDark
          ? 'bg-gray-900/90 border-gray-700 text-white'
          : 'bg-white/95 border-slate-200 text-slate-900',
      )}
      aria-label='Open career card'
    >
      <div
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full',
          isDark ? 'bg-teal-500/20 text-teal-200' : 'bg-teal-100 text-teal-700',
        )}
      >
        <User className='size-4' />
      </div>
      <div className='min-w-0 flex-1 text-left'>
        <p className='text-xs font-semibold'>Your career card</p>
        <p className={cn('truncate text-[11px]', isDark ? 'text-gray-400' : 'text-slate-500')}>
          {snap
            ? `Building for ${snap.title}`
            : installedCount === 0
              ? 'Pick a job to start building'
              : `${installedCount} block${installedCount === 1 ? '' : 's'} installed`}
        </p>
      </div>
      <ChevronUp className={cn('size-4 shrink-0', isDark ? 'text-gray-400' : 'text-slate-500')} />
    </button>
  )
}
