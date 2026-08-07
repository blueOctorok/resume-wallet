'use client'

import { cn } from '@/lib/utils'

interface ProvvenMarkProps {
  /** Size via font-size (e.g. `text-5xl`) — every offset is in em so the mark scales as one unit */
  className?: string
  /** 'ink' = fixed cream-on-navy (landing ink planes); 'auto' = theme-aware */
  tone?: 'ink' | 'auto'
  isDark?: boolean
  /** Set when the mark stands alone (e.g. "Provven"). Omit inside the wordmark, where the parent already carries the accessible name. */
  label?: string
}

/**
 * The Provven double-V — THE brand mark. Two verifications stacked:
 * the ghost v is the fact as the issuer attested it, the solid gold v
 * is Provven's seal laid over it.
 *
 * Canonical geometry (do not tweak casually — favicon + SVG assets in
 * public/brand/ mirror these numbers via scripts/generate-brand-assets.mjs;
 * full spec in docs/BRAND.md):
 *   - gold v rises 0.045em above the baseline
 *   - ghost v pulls in −0.38em and dips 0.07em below the baseline
 *   - ghost opacity: 65% on ink/dark, 55% on cream
 */
export default function ProvvenMark({ className, tone = 'ink', isDark = false, label }: ProvvenMarkProps) {
  const gold = tone === 'ink' || isDark ? 'text-[#cda868]' : 'text-[#6b5024]'
  const ghost = tone === 'ink' ? 'text-[#f4f1ea]/65' : isDark ? 'text-white/65' : 'text-stone-900/55'

  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      // whitespace-nowrap: the inline-blocks create a line-break opportunity
      // between the two v's — the mark must never split
      className={cn('whitespace-nowrap font-display font-semibold tracking-tight', className)}
    >
      <span className={cn('relative inline-block -translate-y-[0.045em]', gold)}>v</span>
      <span className={cn('relative inline-block -ml-[0.38em] translate-y-[0.07em]', ghost)}>v</span>
    </span>
  )
}
