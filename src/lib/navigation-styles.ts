import type { Theme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'

/** Compact control chips (wallet, messages, hamburger). */
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

/** Stormi assistant — keep indigo family but same edge treatment as other controls. */
export function navStormiButtonClass(isDark: boolean) {
  return cn(
    'rounded-lg border px-4 py-2 text-sm font-semibold tracking-wide transition-colors duration-200',
    isDark
      ? 'border-indigo-500/35 bg-indigo-500/[0.1] text-indigo-300 hover:bg-indigo-500/[0.16]'
      : 'border-indigo-200/90 bg-indigo-50/95 text-indigo-900 hover:bg-indigo-100/95',
  )
}

/** Hub primary CTA — teal/violet gradient ring; sepia/paper use muted rings (no brand gradient). */
export function navHubGradientRingClass(theme: Theme = 'light') {
  if (theme === 'sepia') {
    return cn(
      'rounded-xl p-[2px] w-full sm:w-auto shrink-0',
      'bg-gradient-to-br from-stone-500/50 via-stone-400/32 to-stone-600/42',
      'shadow-md shadow-stone-600/12',
    )
  }
  if (theme === 'paper') {
    return cn(
      'rounded-xl p-[2px] w-full sm:w-auto shrink-0',
      'bg-gradient-to-br from-zinc-400/48 via-zinc-300/26 to-zinc-500/40',
      'shadow-md shadow-zinc-500/10',
    )
  }
  return cn(
    'rounded-xl p-[2px] w-full sm:w-auto shrink-0',
    /* Light: teal-600 → teal-500 → violet (no cyan — single green family) */
    'bg-gradient-to-br from-teal-600/88 via-teal-500/48 to-violet-500/58',
    'dark:from-teal-400/80 dark:via-teal-600/38 dark:to-violet-600/48',
    'shadow-md shadow-teal-900/16 dark:shadow-black/45',
  )
}

export function navHubInnerButtonClass() {
  return cn(
    'w-full sm:w-auto px-5 py-2.5 text-sm font-semibold rounded-[10px] flex items-center justify-center gap-2',
    'bg-gray-950 text-white border border-white/[0.08]',
    'hover:bg-gray-900 dark:hover:bg-gray-900',
    'transition-colors duration-200',
  )
}

export function navRowDividerClass(isDark: boolean) {
  return cn('border-t', isDark ? 'border-gray-700/90' : 'border-gray-200/90')
}

export function navDropdownPanelClass(isDark: boolean) {
  return cn(
    'absolute top-full left-1/2 -translate-x-1/2 min-w-[220px] mt-2 rounded-xl shadow-xl overflow-hidden z-[200] border',
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

export function navStormPillClass(isDark: boolean) {
  return cn(
    'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors duration-200 cursor-pointer',
    isDark
      ? 'text-indigo-300 bg-indigo-500/[0.08] hover:bg-indigo-500/[0.14] border-indigo-500/35'
      : 'text-indigo-700 bg-indigo-50/95 hover:bg-indigo-100/95 border-indigo-200/90',
  )
}
