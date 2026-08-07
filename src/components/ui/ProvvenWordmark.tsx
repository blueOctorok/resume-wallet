'use client'

import { cn } from '@/lib/utils'
import ProvvenMark from '@/components/ui/ProvvenMark'

interface ProvvenWordmarkProps {
  className?: string
  /** 'ink' = fixed cream-on-navy (landing ink planes); 'auto' = theme-aware */
  tone?: 'ink' | 'auto'
  isDark?: boolean
}

/**
 * Serif brand wordmark. The double-V IS the mark (see ProvvenMark.tsx —
 * the canonical component + docs/BRAND.md for the full spec). Size via
 * `className` (font-size cascades); weight/tracking here.
 */
export default function ProvvenWordmark({ className, tone = 'ink', isDark = false }: ProvvenWordmarkProps) {
  const base = tone === 'ink' ? 'text-[#f4f1ea]' : isDark ? 'text-white' : 'text-stone-900'

  return (
    // aria-label keeps screen readers reading one word, not "Pro v v en"
    <span aria-label='Provven' className={cn('font-display font-semibold tracking-tight', base, className)}>
      {/* whitespace-nowrap: the mark's inline-blocks create a line-break
          opportunity mid-word — never let Provven wrap */}
      <span aria-hidden className='whitespace-nowrap'>
        Pro
        <ProvvenMark tone={tone} isDark={isDark} />
        <span className='ml-[0.01em]'>en</span>
      </span>
    </span>
  )
}
