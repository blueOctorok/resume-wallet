'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { BookOpen, Check, ChevronDown, FileText, Moon, Sun } from 'lucide-react'
import { useTheme, type Theme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'
import { navControlButtonClass, navDropdownItemBorderClass, navDropdownItemClass } from '@/lib/navigation-styles'

const OPTIONS: { id: Theme; label: string; description: string; Icon: typeof Sun }[] = [
  { id: 'light', label: 'Icy light', description: 'Cool slate vault (default)', Icon: Sun },
  { id: 'sepia', label: 'Sepia', description: 'Kindle-style warm cream — soft & easy on the eyes', Icon: BookOpen },
  { id: 'paper', label: 'Paper', description: 'Newsprint grey — calm, low contrast, print-like', Icon: FileText },
  { id: 'dark', label: 'Dark', description: 'Storm void', Icon: Moon },
]

function activeThemeIcon(theme: Theme) {
  if (theme === 'dark') return Moon
  if (theme === 'sepia') return BookOpen
  if (theme === 'paper') return FileText
  return Sun
}

export default function ThemePicker() {
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const isDark = theme === 'dark'
  const ActiveIcon = activeThemeIcon(theme)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const pick = useCallback(
    (t: Theme) => {
      setTheme(t)
      setOpen(false)
    },
    [setTheme],
  )

  return (
    <div ref={rootRef} className='relative'>
      <button
        type='button'
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'relative flex cursor-pointer items-center gap-1.5 rounded-lg p-2.5 pr-2',
          navControlButtonClass(isDark),
        )}
        aria-expanded={open}
        aria-haspopup='listbox'
        aria-label='Appearance: theme picker'
        title='Theme'
      >
        <span className='flex h-5 w-5 items-center justify-center'>
          <ActiveIcon className='h-4 w-4 transition-transform duration-300' aria-hidden />
        </span>
        <ChevronDown className={cn('h-3.5 w-3.5 opacity-70 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>

      {open && (
        <div
          className={cn(
            'absolute right-0 top-full z-[200] mt-2 min-w-[min(100vw-2rem,17rem)] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border shadow-xl ring-1',
            isDark
              ? 'border-gray-600/80 bg-gray-950 ring-white/[0.04]'
              : 'border-stone-300/90 bg-white ring-stone-900/[0.04]',
          )}
          role='listbox'
          aria-label='Appearance'
        >
          <p
            className={cn(
              'border-b px-3 py-2 text-[10px] font-semibold uppercase tracking-wider',
              isDark ? 'border-gray-700/80 text-gray-500' : 'border-stone-200 text-stone-500',
            )}
          >
            Appearance
          </p>
          {OPTIONS.map((opt, i) => {
            const selected = theme === opt.id
            return (
              <button
                key={opt.id}
                type='button'
                role='option'
                aria-selected={selected}
                onClick={() => pick(opt.id)}
                className={cn(
                  navDropdownItemClass(isDark),
                  i > 0 && navDropdownItemBorderClass(isDark),
                  'items-start gap-3',
                  selected && (isDark ? 'bg-gray-900/80' : 'bg-stone-50'),
                )}
              >
                <opt.Icon
                  className={cn(
                    'mt-0.5 h-4 w-4 shrink-0',
                    selected ? (isDark ? 'text-teal-400' : 'text-teal-600') : isDark ? 'text-gray-400' : 'text-stone-500',
                  )}
                  aria-hidden
                />
                <span className='min-w-0 flex-1 text-left'>
                  <span className='block font-medium'>{opt.label}</span>
                  <span className={cn('mt-0.5 block text-xs font-normal', isDark ? 'text-gray-500' : 'text-stone-500')}>
                    {opt.description}
                  </span>
                </span>
                {selected ? (
                  <Check className={cn('h-4 w-4 shrink-0', isDark ? 'text-teal-400' : 'text-teal-600')} aria-hidden />
                ) : null}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
