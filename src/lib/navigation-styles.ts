import { cn } from '@/lib/utils'

/** Compact control chips (log out, messages, hamburger). */
export function navControlButtonClass(isDark: boolean) {
  return cn(
    'rounded-lg border transition-colors duration-200',
    isDark
      ? 'border-gray-600/80 bg-gray-800/55 text-gray-200 hover:bg-gray-800/90 hover:border-gray-500/65'
      : 'border-slate-300/95 bg-white text-slate-900 hover:bg-slate-50 hover:border-slate-400/90',
  )
}

/** Secondary text buttons in link row. */
export function navTextLinkClass(isDark: boolean, accent?: 'teal' | 'neutral') {
  if (accent === 'teal') {
    return cn(
      'rounded-lg border text-sm font-semibold transition-colors',
      isDark
        ? 'border-teal-500/35 bg-teal-500/[0.08] text-teal-300 hover:bg-teal-500/15 hover:border-teal-400/40'
        : 'border-teal-600/22 bg-teal-50/95 text-teal-900 hover:bg-teal-50 hover:border-teal-600/35',
    )
  }
  return cn(
    'rounded-lg border text-sm font-semibold transition-colors',
    isDark
      ? 'border-gray-600/80 text-gray-200 hover:bg-gray-800/70'
      : 'border-slate-300/90 text-slate-800 hover:bg-slate-100',
  )
}

/** Stormi assistant button — steel (indigo remap) surface. */
export function navStormiButtonClass(isDark: boolean) {
  return cn(
    'rounded-lg border px-4 py-2 text-sm font-semibold tracking-wide transition-colors duration-200',
    isDark
      ? 'border-indigo-500/35 bg-indigo-500/[0.1] text-indigo-300 hover:bg-indigo-500/[0.16]'
      : 'border-indigo-200/90 bg-indigo-50/95 text-indigo-900 hover:bg-indigo-100/95',
  )
}

/** Dropdown panel anchored under its trigger (traditional left-aligned menu). */
export function navDropdownPanelClass(isDark: boolean) {
  return cn(
    'absolute top-full left-0 min-w-[220px] mt-2 rounded-xl shadow-xl overflow-hidden z-[200] border',
    isDark
      ? 'bg-gray-950 border-gray-600/80 ring-1 ring-white/[0.04]'
      : 'bg-white border-gray-200/90 ring-1 ring-gray-900/[0.04]',
  )
}

export function navDropdownItemClass(isDark: boolean) {
  return cn(
    'w-full px-4 py-3 text-sm font-medium flex items-center gap-3 transition-colors text-left',
    isDark ? 'text-gray-100 hover:bg-gray-900/90' : 'text-slate-800 hover:bg-slate-50',
  )
}

export function navDropdownItemBorderClass(isDark: boolean) {
  return cn('border-t', isDark ? 'border-gray-800' : 'border-gray-100')
}
