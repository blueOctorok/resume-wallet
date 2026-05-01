'use client'

import { isDarkTheme } from '@/lib/theme-storage'
/**
 * ModeToggle — flips between Simple / Apply (job-first) and Hub / Construct (full hub) chromes.
 *
 * Visible only to candidates once the Simple mode feature flag is on. The flip
 * is instant (local zustand) and a fire-and-forget PATCH persists the choice
 * to `users.ui_mode_preference` so it carries across devices.
 *
 * Zero-state-loss by design: both chromes read the same hub-blocks store, so
 * installed blocks, saved jobs, etc. survive the toggle.
 */

import { LayoutDashboard, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import { useUIModeStore } from '@/stores/ui-mode-store'
import { useAuthStore } from '@/stores'
import { isSimpleModeEnabled } from '@/lib/feature-flags'

interface ModeToggleProps {
  /** Compact pill style for the main nav row. */
  variant?: 'pill' | 'menu'
  onAfterToggle?: () => void
}

export default function ModeToggle({ variant = 'pill', onAfterToggle }: ModeToggleProps) {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)
  const mode = useUIModeStore((s) => s.mode)
  const setMode = useUIModeStore((s) => s.setMode)
  const walletAddress = useAuthStore((s) => s.walletAddress)
  const userRole = useAuthStore((s) => s.userRole)

  // Simple mode only makes sense for candidates; gate here so the toggle
  // never leaks into employer / driver / developer shells.
  if (userRole !== 'candidate') return null
  if (!isSimpleModeEnabled()) return null

  const handleToggle = () => {
    const next = mode === 'simple' ? 'hub' : 'simple'
    setMode(next)
    onAfterToggle?.()

    if (walletAddress) {
      // Fire-and-forget — UI is already flipped; server catches up for cross-device sync.
      void fetch('/api/user/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': walletAddress,
        },
        body: JSON.stringify({ ui_mode_preference: next }),
      }).catch(() => {
        /* ignore — localStorage copy is authoritative for UX; next successful sync will reconcile */
      })
    }
  }

  if (variant === 'menu') {
    return (
      <button
        type='button'
        onClick={handleToggle}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 text-sm cursor-pointer',
          isDark ? 'text-gray-200 hover:bg-gray-700/60' : 'text-slate-700 hover:bg-slate-100',
        )}
      >
        {mode === 'simple' ? <LayoutDashboard className='w-4 h-4' /> : <Sparkles className='w-4 h-4' />}
        <span className='font-medium'>
          {mode === 'simple' ? 'Open Construct mode' : 'Back to Apply'}
        </span>
      </button>
    )
  }

  // Pill — small segmented control for the nav row
  const active = (m: 'simple' | 'hub') =>
    mode === m
      ? isDark
        ? 'bg-teal-500/20 text-teal-200 border-teal-400/40'
        : 'bg-teal-500/15 text-teal-700 border-teal-500/40'
      : isDark
        ? 'text-gray-400 border-transparent hover:text-gray-200'
        : 'text-slate-500 border-transparent hover:text-slate-700'

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-full border p-1 text-xs font-semibold',
        isDark ? 'border-gray-700 bg-gray-900/60' : 'border-slate-200 bg-white/80 shadow-sm',
      )}
      role='group'
      aria-label='Storm mode'
    >
      <button
        type='button'
        onClick={() => mode !== 'simple' && handleToggle()}
        className={cn(
          'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 transition-colors cursor-pointer sm:px-3.5',
          active('simple'),
        )}
        aria-pressed={mode === 'simple'}
        title='Apply mode — job-first, Stormi as co-pilot'
      >
        <Sparkles className='h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4' aria-hidden />
        <span>Apply</span>
      </button>
      <button
        type='button'
        onClick={() => mode !== 'hub' && handleToggle()}
        className={cn(
          'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 transition-colors cursor-pointer sm:px-3.5',
          active('hub'),
        )}
        aria-pressed={mode === 'hub'}
        title='Construct mode — the full composable hub'
      >
        <LayoutDashboard className='h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4' aria-hidden />
        <span>Construct</span>
      </button>
    </div>
  )
}
