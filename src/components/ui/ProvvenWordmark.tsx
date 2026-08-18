'use client'

import { cn } from '@/lib/utils'
import ProvvenMark from '@/components/ui/ProvvenMark'

interface ProvvenWordmarkProps {
  className?: string
  /** 'ink' = cream type on navy; 'auto' = theme-aware */
  tone?: 'ink' | 'auto'
  isDark?: boolean
}

/**
 * Blue Star lockup: shield mark + PROVVEN in Montserrat (body sans).
 * Size via `className` font-size — the mark scales in em with the type.
 */
export default function ProvvenWordmark({ className, tone = 'ink', isDark = false }: ProvvenWordmarkProps) {
  const type = tone === 'ink' ? 'text-[#f4f1ea]' : isDark ? 'text-white' : 'text-[#0c2340]'

  return (
    <span
      aria-label='Provven'
      className={cn(
        'inline-flex items-center gap-[0.28em] font-bold tracking-[0.08em]',
        type,
        className,
      )}
    >
      <ProvvenMark tone={tone} isDark={isDark} />
      <span aria-hidden className='whitespace-nowrap'>
        PROVVEN
      </span>
    </span>
  )
}
