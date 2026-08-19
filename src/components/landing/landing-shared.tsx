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
 * Palette (Blue Star):
 * - Ink bands are Midnight Blue `#173150`.
 * - Light sections sit on cool paper with Ironside `#939598`.
 * - Accent is Hot Embers `#f15a2b` only — no homemade ember tints.
 * - Secondary: Denim `#00608b`, Dark Amber `#F28A0F`, Retro Teal `#3F8A8C`.
 */

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Muted body copy — darker neighbor of Ironside so ledes stay readable */
export function mutedText(isDark: boolean) {
  return isDark ? 'text-ironside' : 'text-[#5c6166]'
}

/** Primary heading — Midnight Blue on paper */
export function headingText(isDark: boolean) {
  return isDark ? 'text-white' : 'text-[#173150]'
}

/**
 * Opaque fill for non-ink sections. Do not use /opacity tints here —
 * InkBand blurs escape `overflow-hidden` on iOS and the fixed StormBackground
 * would show through, so the page reads as one navy slab on phones.
 */
export function paperBand(isDark: boolean, tint = false) {
  if (isDark) return tint ? 'bg-[#1e3d5c]' : 'bg-[#152a42]'
  return tint ? 'bg-[#e6e7e8]' : 'bg-[#f3f4f5]'
}

/**
 * Gold primary CTA — overrides Button's teal primary via twMerge.
 * Deep-navy label on champagne gold; identical in both themes on purpose
 * (the CTA is a brand object, not a theme surface).
 */
export const GOLD_CTA =
  'bg-ember text-white shadow-lg shadow-black/25 hover:brightness-110 dark:bg-ember dark:text-white dark:hover:brightness-110'

/** Fixed palette for ink bands (never changes with theme) */
export const INK = {
  heading: 'text-[#f4f1ea]',
  body: 'text-ironside',
  bodyBright: 'text-[#b8babc]',
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
    ? 'text-[#f15a2b]/90'
    : isDark
      ? 'text-[#f15a2b]/90'
      : 'text-[#f15a2b]'
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
    <section
      id={id}
      className={cn('relative isolate overflow-hidden bg-[#173150] [clip-path:inset(0)]', className)}
    >
      {/* Ledger grid — horizontal record lines, barely-there */}
      <div
        aria-hidden
        className='pointer-events-none absolute inset-0 opacity-[0.5]'
        style={{
          backgroundImage:
            'repeating-linear-gradient(to bottom, rgba(147,149,152,0.08) 0px, rgba(147,149,152,0.08) 1px, transparent 1px, transparent 56px)',
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
  const goldLine = 'to-ember/50'
  const goldDiamond = 'bg-ember/80'

  return (
    <div className={cn('flex items-center', className)} aria-hidden>
      <span className={cn('h-px flex-1 bg-gradient-to-r from-transparent', goldLine)} />
      <span className={cn('mx-3 h-1.5 w-1.5 shrink-0 rotate-45', goldDiamond)} />
      <span className={cn('h-px flex-1 bg-gradient-to-l from-transparent', goldLine)} />
    </div>
  )
}
