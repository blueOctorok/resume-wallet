'use client'

/**
 * SimpleMobileSheet — mobile-only bottom sheet for Guided Mode.
 *
 * Two tabs: **Job** (posting + apply) and **Your card** (Stormi strip +
 * projected career card). The job rail stays full-screen behind this sheet so
 * search + results are not cramped. Desktop (`md+`) does not mount this.
 */

import { X } from 'lucide-react'
import { useEffect } from 'react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuthStore } from '@/stores'
import { useSimpleModeStore, type MobileGuidedSheetTab } from '@/stores/simple-mode-store'
import Button from '@/components/ui/Button'
import SimpleCardPanel from './SimpleCardPanel'
import SimpleJobDetailPanel from './SimpleJobDetailPanel'

interface SimpleMobileSheetProps {
  open: boolean
  onClose: () => void
}

export default function SimpleMobileSheet({ open, onClose }: SimpleMobileSheetProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const walletAddress = useAuthStore((s) => s.walletAddress)
  const mobileSheetTab = useSimpleModeStore((s) => s.mobileSheetTab)
  const setMobileSheetTab = useSimpleModeStore((s) => s.setMobileSheetTab)

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

  const tabBtn = (tab: MobileGuidedSheetTab, label: string) => (
    <Button
      type='button'
      variant={mobileSheetTab === tab ? 'primary' : 'secondary'}
      size='sm'
      className='!px-3 !py-1.5 !text-xs'
      onClick={() => setMobileSheetTab(tab)}
    >
      {label}
    </Button>
  )

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/60 transition-opacity md:hidden',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        onClick={onClose}
        aria-hidden
      />

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
        aria-label='Job and career card'
      >
        <div
          className={cn(
            'flex shrink-0 flex-col gap-2 border-b px-3 pb-2 pt-2',
            isDark ? 'border-gray-700' : 'border-slate-200',
          )}
        >
          <div className='relative flex items-center justify-center'>
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
                'absolute right-0 top-1/2 -translate-y-1/2 rounded-full p-2 cursor-pointer',
                isDark
                  ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700',
              )}
              aria-label='Close'
            >
              <X className='size-4' />
            </button>
          </div>
          <div className='flex justify-center gap-2'>
            {tabBtn('job', 'Job')}
            {tabBtn('card', 'Your card')}
          </div>
        </div>

        <div className='min-h-0 flex-1 overflow-hidden px-2 pb-3 pt-1 sm:px-3'>
          {mobileSheetTab === 'job' ? (
            <div className='flex h-full min-h-0 flex-col'>
              <SimpleJobDetailPanel userAddress={walletAddress ?? null} />
            </div>
          ) : (
            <div className='flex h-full min-h-0 flex-col overflow-hidden'>
              <SimpleCardPanel />
            </div>
          )}
        </div>
      </div>
    </>
  )
}
