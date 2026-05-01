'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useEffect, useRef } from 'react'
import { Check, Settings2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import { useLenses } from '@/stores/career-card-lenses-store'
import { useSimpleModeStore } from '@/stores/simple-mode-store'

interface LensPickerPopoverProps {
  onClose: () => void
  onManage: () => void
}

/**
 * Anchored popover list for switching the active lens. Stays deliberately
 * tiny: each lens is a one-line row with a check mark on the active one,
 * plus a "Manage lenses" escape hatch at the bottom.
 *
 * Closes on outside click and Escape.
 */
export default function LensPickerPopover({ onClose, onManage }: LensPickerPopoverProps) {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)
  const lenses = useLenses()
  const activeLensId = useSimpleModeStore((s) => s.activeLensId)
  const setActiveLens = useSimpleModeStore((s) => s.setActiveLens)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const onClick = (e: MouseEvent) => {
      if (!panelRef.current) return
      if (!panelRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('keydown', onKey)
    // Mouse-down rather than click so the popover closes before the next action.
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [onClose])

  const resolvedActive =
    activeLensId ?? lenses.find((l) => l.isDefault)?.id ?? null

  return (
    <div
      ref={panelRef}
      role='dialog'
      aria-label='Switch career card lens'
      className={cn(
        'absolute top-8 right-3 sm:right-5 z-30 w-56 rounded-lg border shadow-lg p-1',
        isDark ? 'border-gray-700 bg-gray-900' : 'border-slate-200 bg-white',
      )}
    >
      <ul className='max-h-64 overflow-y-auto scrollbar-none'>
        {lenses.map((lens) => {
          const isActive = lens.id === resolvedActive
          return (
            <li key={lens.id}>
              <button
                type='button'
                onClick={() => {
                  setActiveLens(lens.isDefault ? null : lens.id)
                  onClose()
                }}
                className={cn(
                  'w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm cursor-pointer transition-colors',
                  isDark
                    ? 'text-gray-200 hover:bg-gray-800'
                    : 'text-slate-700 hover:bg-slate-100',
                )}
              >
                <span className='w-4 shrink-0'>
                  {isActive && <Check className={cn('w-4 h-4', isDark ? 'text-teal-300' : 'text-teal-600')} />}
                </span>
                <span className='truncate flex-1'>{lens.name}</span>
              </button>
            </li>
          )
        })}
      </ul>
      <div className={cn('mt-1 border-t pt-1', isDark ? 'border-gray-700' : 'border-slate-200')}>
        <button
          type='button'
          onClick={() => {
            onClose()
            onManage()
          }}
          className={cn(
            'w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs cursor-pointer',
            isDark
              ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800',
          )}
        >
          <Settings2 className='w-3.5 h-3.5' />
          Manage lenses
        </button>
      </div>
    </div>
  )
}
