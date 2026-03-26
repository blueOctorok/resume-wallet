import { cn } from '@/lib/utils'

/**
 * Shared visual vocabulary for CareerCard + ProjectedCareerCard so employer and
 * candidate views feel like the same premium artifact (aligned with hub Card elevated).
 */
export function careerCardShellClass(isDark: boolean) {
  return cn(
    'relative overflow-hidden rounded-[2.25rem]',
    isDark
      ? 'bg-gradient-to-b from-gray-900 via-gray-900 to-gray-950 border border-gray-600/70'
      : 'bg-gradient-to-b from-white via-white to-slate-50/95 border border-gray-200/90',
    'shadow-[0_24px_64px_-18px_rgba(13,148,136,0.2)] dark:shadow-[0_28px_72px_-14px_rgba(0,0,0,0.72)]',
    'ring-1 ring-teal-500/[0.08] dark:ring-teal-400/[0.1]',
  )
}

export function careerCardHairlineTop() {
  return cn(
    'pointer-events-none absolute inset-x-6 sm:inset-x-10 top-0 z-[1] h-px',
    'bg-gradient-to-r from-transparent via-teal-400/45 to-transparent dark:via-teal-400/35',
  )
}

/** Soft color bloom — keeps the card from reading as a flat rectangle */
export function careerCardAmbientBlobClass(isDark: boolean) {
  return cn(
    'pointer-events-none absolute -right-28 -top-36 w-[24rem] h-[24rem] rounded-full blur-3xl opacity-[0.85]',
    isDark
      ? 'bg-gradient-to-br from-teal-500/15 via-violet-600/10 to-transparent'
      : 'bg-gradient-to-br from-teal-400/25 via-cyan-300/15 to-transparent',
  )
}

export function careerCardHeroClass(isDark: boolean) {
  return cn(
    'relative h-24 sm:h-28 overflow-hidden shrink-0',
    isDark
      ? 'bg-gradient-to-br from-teal-950/90 via-gray-900 to-violet-950/50'
      : 'bg-gradient-to-br from-teal-100 via-slate-50 to-violet-100/70',
  )
}

/** Radial wash on top of hero gradient for depth */
export function careerCardHeroWashClass(isDark: boolean) {
  return cn(
    'absolute inset-0',
    isDark
      ? 'bg-[radial-gradient(ellipse_90%_80%_at_80%_-30%,rgba(45,212,191,0.18),transparent_55%)]'
      : 'bg-[radial-gradient(ellipse_90%_80%_at_75%_-25%,rgba(20,184,166,0.22),transparent_50%)]',
  )
}

/** Inner panels (completeness strip, dense lists) */
export function careerCardInsetPanelClass(isDark: boolean) {
  return cn(
    'rounded-xl border p-4',
    isDark
      ? 'border-gray-600/55 bg-gray-800/50 ring-1 ring-white/[0.04]'
      : 'border-gray-200/90 bg-white/75 ring-1 ring-gray-900/[0.04]',
  )
}
