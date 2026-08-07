'use client'

/**
 * Shared primitives for the Provven marketing landing page.
 *
 * Design system notes:
 * - Ink bands (`InkBand`) are deliberately theme-independent: the hero, the
 *   selective-disclosure section, and the trust section always render on a deep
 *   ink plane in BOTH light and dark themes. That's the brand move — a premium
 *   "credential vault" plane the product visuals sit on — and it means the
 *   money-shot visuals never need two color treatments.
 * - Everything outside ink bands is theme-aware via `isDark` ternaries,
 *   matching the rest of the app.
 *
 * Palette (heritage-trust direction, per brand boards):
 * - Ink bands are deep ink-NAVY (not blue-black) — navy is the institutional
 *   trust hue for logistics/finance.
 * - Light sections sit on warm cream with stone neutrals (not cool slate) —
 *   matches the Fraunces serif + paper-cream INK heading already in use.
 * - ONE accent: champagne gold — the "seal". It marks brand moments, verified
 *   facts, and the disclosure seam. This is now the SITE-WIDE brand (the
 *   Tailwind teal/violet scales are remapped to gold/steel in
 *   tailwind.config.ts); the landing page pioneered it.
 *
 * Gold values (keep consistent — three tones, nothing else):
 * - `#c9a86a` — lines, borders, fills (usually at /15–/60 opacity)
 * - `#d4be93` — accent text on ink-navy · `#e6cf9f` bright variant
 * - `#8a6d3b` — accent text on cream (deep bronze, AA on #f7f4ed)
 */

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Muted body copy on theme-aware (non-ink) sections — warm stone on cream */
export function mutedText(isDark: boolean) {
  return isDark ? 'text-gray-400' : 'text-stone-600'
}

/** Primary heading color on theme-aware sections */
export function headingText(isDark: boolean) {
  return isDark ? 'text-white' : 'text-stone-900'
}

/**
 * Gold primary CTA — overrides Button's teal primary via twMerge.
 * Deep-navy label on champagne gold; identical in both themes on purpose
 * (the CTA is a brand object, not a theme surface).
 */
export const GOLD_CTA =
  'bg-[#c9a86a] text-[#141c30] shadow-lg shadow-black/25 hover:bg-[#d4b87e] dark:bg-[#c9a86a] dark:text-[#141c30] dark:hover:bg-[#d4b87e]'

/** Fixed palette for ink bands (never changes with theme) */
export const INK = {
  heading: 'text-[#f4f1ea]',
  body: 'text-slate-400',
  bodyBright: 'text-slate-300',
  hairline: 'border-white/[0.08]',
} as const

interface SectionHeaderProps {
  eyebrow: string
  title: ReactNode
  lede?: ReactNode
  /** Rendering on an ink band (fixed dark) vs a theme-aware section */
  onInk?: boolean
  isDark?: boolean
  align?: 'left' | 'center'
  className?: string
}

/** Eyebrow + display-serif title + optional lede. One per section. */
export function SectionHeader({
  eyebrow,
  title,
  lede,
  onInk = false,
  isDark = false,
  align = 'left',
  className,
}: SectionHeaderProps) {
  const eyebrowColor = onInk
    ? 'text-[#d4be93]/90'
    : isDark
      ? 'text-[#d4be93]/90'
      : 'text-[#8a6d3b]'
  const titleColor = onInk ? INK.heading : headingText(isDark)
  const ledeColor = onInk ? INK.body : mutedText(isDark)

  return (
    <div
      className={cn(
        'max-w-3xl',
        align === 'center' && 'mx-auto text-center',
        className,
      )}
    >
      <p
        className={cn(
          'mb-3 text-[11px] font-semibold uppercase tracking-[0.32em]',
          eyebrowColor,
        )}
      >
        {eyebrow}
      </p>
      <h2
        className={cn(
          'font-display text-3xl font-medium leading-[1.08] tracking-tight sm:text-4xl lg:text-[2.75rem]',
          titleColor,
        )}
      >
        {title}
      </h2>
      {lede && (
        <p className={cn('mt-5 max-w-2xl text-base leading-relaxed sm:text-lg', ledeColor, align === 'center' && 'mx-auto')}>
          {lede}
        </p>
      )}
    </div>
  )
}

interface InkBandProps {
  children: ReactNode
  className?: string
  /** Extra background layers (blooms, grids) rendered under the content */
  atmosphere?: ReactNode
  id?: string
}

/**
 * Full-bleed deep-ink plane. Theme-independent by design (see file header).
 * The ledger grid is a repeating hairline pattern that reads as "structured
 * records" without competing with copy.
 */
export function InkBand({ children, className, atmosphere, id }: InkBandProps) {
  return (
    <section id={id} className={cn('relative isolate overflow-hidden bg-[#0a1322]', className)}>
      {/* Ledger grid — horizontal record lines, barely-there */}
      <div
        aria-hidden
        className='pointer-events-none absolute inset-0 opacity-[0.5]'
        style={{
          backgroundImage:
            'repeating-linear-gradient(to bottom, rgba(148,163,184,0.05) 0px, rgba(148,163,184,0.05) 1px, transparent 1px, transparent 56px)',
        }}
      />
      {atmosphere}
      <div className='relative z-10'>{children}</div>
    </section>
  )
}

/** Standard horizontal container for landing sections */
export function LandingContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8', className)}>{children}</div>
}

interface SealDividerProps {
  /** Fixed ink-plane styling vs theme-aware */
  onInk?: boolean
  isDark?: boolean
  className?: string
}

/**
 * Heritage ornament: hairline rule with a centered gold diamond.
 * The "wax seal on the ledger line" — use it to close a section or the page,
 * not between every block (scarcity keeps it meaningful).
 */
export function SealDivider({ onInk = false, isDark = false, className }: SealDividerProps) {
  const goldLine = onInk || isDark ? 'to-[#c9a86a]/50' : 'to-[#8a6d3b]/45'
  const goldDiamond = onInk || isDark ? 'bg-[#c9a86a]/85' : 'bg-[#8a6d3b]/80'

  return (
    <div className={cn('flex items-center', className)} aria-hidden>
      <span className={cn('h-px flex-1 bg-gradient-to-r from-transparent', goldLine)} />
      <span className={cn('mx-3 h-1.5 w-1.5 shrink-0 rotate-45', goldDiamond)} />
      <span className={cn('h-px flex-1 bg-gradient-to-l from-transparent', goldLine)} />
    </div>
  )
}
