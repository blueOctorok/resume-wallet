'use client'

/**
 * SimpleCardSliver — pinned bar below `lg` (phones + iPad portrait).
 *
 * When a job is selected: tap the main area to open the mobile sheet on the
 * last-used tab; use **Job** / **Your card** for a direct jump. When nothing
 * is selected, the bar is read-only — pick a job from the full-screen rail first.
 */

import { ChevronUp, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import { useInstalledBlocks } from '@/stores/hub-blocks-store'
import { useSimpleModeStore } from '@/stores/simple-mode-store'
import Button from '@/components/ui/Button'

export default function SimpleCardSliver() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const installedCount = useInstalledBlocks().length
  const snap = useSimpleModeStore((s) => s.selectedJobSnapshot)
  const openCardSheet = useSimpleModeStore((s) => s.openCardSheet)

  if (!snap) {
    return (
      <div
        className={cn(
          'fixed bottom-3 inset-x-3 z-40 rounded-2xl border px-4 py-3 flex items-center gap-3 shadow-xl backdrop-blur lg:hidden',
          isDark ? 'bg-gray-900/90 border-gray-700 text-white' : 'bg-white/95 border-slate-200 text-slate-900',
        )}
        role='status'
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
          <p className='text-xs font-semibold'>Guided mode</p>
          <p className={cn('text-[11px] leading-snug', isDark ? 'text-gray-400' : 'text-slate-500')}>
            Pick a job from the list — then open Job details or Your card from here.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'fixed bottom-3 inset-x-3 z-40 flex items-center gap-2 rounded-2xl border px-3 py-2.5 shadow-xl backdrop-blur lg:hidden',
        isDark ? 'bg-gray-900/90 border-gray-700 text-white' : 'bg-white/95 border-slate-200 text-slate-900',
      )}
    >
      <button
        type='button'
        onClick={() => openCardSheet()}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2 rounded-xl py-1 text-left cursor-pointer',
          isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50',
        )}
        aria-label='Open job and career card sheet'
      >
        <div
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-full',
            isDark ? 'bg-teal-500/20 text-teal-200' : 'bg-teal-100 text-teal-700',
          )}
        >
          <User className='size-4' />
        </div>
        <div className='min-w-0 flex-1'>
          <p className='text-xs font-semibold'>Job &amp; your card</p>
          <p className={cn('truncate text-[11px]', isDark ? 'text-gray-400' : 'text-slate-500')}>
            {snap.title}
            {installedCount > 0 ? ` · ${installedCount} block${installedCount === 1 ? '' : 's'}` : ''}
          </p>
        </div>
        <ChevronUp className={cn('size-4 shrink-0', isDark ? 'text-gray-400' : 'text-slate-500')} />
      </button>
      <div className='flex shrink-0 flex-col gap-1 sm:flex-row'>
        <Button type='button' variant='secondary' size='sm' className='!px-2 !py-1 !text-[11px]' onClick={() => openCardSheet('job')}>
          Job
        </Button>
        <Button type='button' variant='secondary' size='sm' className='!px-2 !py-1 !text-[11px]' onClick={() => openCardSheet('card')}>
          Card
        </Button>
      </div>
    </div>
  )
}
