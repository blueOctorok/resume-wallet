'use client'

/**
 * SimpleCardSheet — mobile-only modal sheet that renders `SimpleCardPanel`.
 *
 * Slide-up transition with a drag affordance so users can see it's
 * dismissible. Uses fixed positioning rather than a portal — the sheet is
 * short-lived and doesn't need to escape the Simple shell's stacking context.
 */

import { X } from 'lucide-react'
import { useEffect } from 'react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import SimpleCardPanel from './SimpleCardPanel'

interface SimpleCardSheetProps {
  open: boolean
  onClose: () => void
}

export default function SimpleCardSheet({ open, onClose }: SimpleCardSheetProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  // Lock body scroll while the sheet is open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <>
      {/* Scrim */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/60 transition-opacity md:hidden',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        onClick={onClose}
        aria-hidden
      />

      {/* Sheet */}
      <div
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 md:hidden',
          'rounded-t-3xl border-t shadow-2xl',
          'transition-transform duration-300 ease-out',
          'h-[90vh] flex flex-col',
          open ? 'translate-y-0' : 'translate-y-full',
          isDark ? 'bg-gray-950 border-gray-700' : 'bg-slate-50 border-slate-200',
        )}
        role='dialog'
        aria-modal
        aria-label='Career card'
      >
        <div className='flex items-center justify-between px-4 pt-3 pb-2'>
          <div className='flex-1 flex justify-center'>
            <div
              className={cn(
                'w-10 h-1.5 rounded-full',
                isDark ? 'bg-gray-700' : 'bg-slate-300',
              )}
            />
          </div>
          <button
            type='button'
            onClick={onClose}
            className={cn(
              'absolute right-3 top-3 p-2 rounded-full cursor-pointer',
              isDark
                ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100',
            )}
            aria-label='Close'
          >
            <X className='w-4 h-4' />
          </button>
        </div>
        <div className='flex-1 min-h-0 px-3 pb-4'>
          <SimpleCardPanel />
        </div>
      </div>
    </>
  )
}
