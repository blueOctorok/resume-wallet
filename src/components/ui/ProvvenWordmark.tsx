'use client'

import { cn } from '@/lib/utils'

interface ProvvenWordmarkProps {
  className?: string
  /** 'ink' = fixed cream-on-navy (landing ink planes); 'auto' = theme-aware */
  tone?: 'ink' | 'auto'
  isDark?: boolean
}

/**
 * Serif brand wordmark. The double-V IS the mark: two verifications — the
 * issuer checks the fact (base-colored v), Provven seals it (the gold v laid
 * on top). Size via `className` (font-size cascades); weight/tracking here.
 */
export default function ProvvenWordmark({ className, tone = 'ink', isDark = false }: ProvvenWordmarkProps) {
  const base = tone === 'ink' ? 'text-[#f4f1ea]' : isDark ? 'text-white' : 'text-stone-900'
  // The base v is dimmed so the eye reads "Proven" at a glance — the ghost v
  // under the gold seal is the brand moment, not a competing solid letter
  const baseV = tone === 'ink' ? 'text-[#f4f1ea]/65' : isDark ? 'text-white/65' : 'text-stone-900/55'
  const gold = tone === 'ink' || isDark ? 'text-[#cda868]' : 'text-[#6b5024]'

  return (
    // aria-label keeps screen readers reading one word, not "Pro v v en"
    <span aria-label='Provven' className={cn('font-display font-semibold tracking-tight', base, className)}>
      {/* whitespace-nowrap: the staggered-V inline-blocks create a line-break
          opportunity mid-word — never let Provven wrap */}
      <span aria-hidden className='whitespace-nowrap'>
        Pro
        {/* solid gold v rides slightly high — the pair is its own symbol,
            not two baseline letters */}
        <span className={cn('relative inline-block -translate-y-[0.045em]', gold)}>v</span>
        {/* ghost v laid deep on top, dipping below the baseline like a
            descender */}
        <span className={cn('relative inline-block -ml-[0.38em] translate-y-[0.07em]', baseV)}>v</span>
        <span className='ml-[0.01em]'>en</span>
      </span>
    </span>
  )
}
