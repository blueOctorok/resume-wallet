'use client'

/**
 * SimpleMobileSheet — card sheet for iPad portrait (md–lg).
 *
 * At md–lg the grid is 2-col (rail + detail) so the career card needs
 * this slide-up sheet, triggered by the `SimpleCardSliver`. Phones (<md)
 * use `MobileTabBar` instead and never mount this.
 */

import { X } from 'lucide-react'
import { useEffect } from 'react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import SimpleCardPanel from './SimpleCardPanel'

interface SimpleMobileSheetProps {
  open: boolean
  onClose: () => void
}

export default function SimpleMobileSheet({ open, onClose }: SimpleMobileSheetProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

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
      <div
        className={cn(
          // Only render at md–lg (iPad portrait). Phones use tab bar; lg+ has inline card.
          'fixed inset-0 z-40 hidden bg-black/60 transition-opacity md:block lg:hidden',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        onClick={onClose}
        aria-hidden
      />

      <div
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 hidden md:flex lg:hidden',
          'flex-col rounded-t-3xl border-t shadow-2xl',
          'transition-transform duration-300 ease-out',
          'h-[85vh]',
          open ? 'translate-y-0' : 'translate-y-full',
          isDark ? 'bg-gray-950 border-gray-700' : 'bg-slate-50 border-slate-200',
        )}
        role='dialog'
        aria-modal
        aria-label='Career card'
      >
        <div className='flex items-center justify-center px-4 pb-2 pt-3'>
          <div
            className={cn(
              'h-1.5 w-10 rounded-full',
              isDark ? 'bg-gray-700' : 'bg-slate-300',
            )}
          />
          <button
            type='button'
            onClick={onClose}
            className={cn(
              'absolute right-3 top-3 rounded-full p-2 cursor-pointer',
              isDark
                ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700',
            )}
            aria-label='Close'
          >
            <X className='size-4' />
          </button>
        </div>
        <div className='min-h-0 flex-1 px-3 pb-4'>
          <SimpleCardPanel />
        </div>
      </div>
    </>
  )
}
