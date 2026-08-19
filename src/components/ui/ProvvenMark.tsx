'use client'

import { cn } from '@/lib/utils'

interface ProvvenMarkProps {
  /** Size via font-size (e.g. `text-5xl`) — height is 1.15em so it tracks type */
  className?: string
  /** 'ink' = Hot Embers on navy; 'auto' = theme-aware (embers on dark, Midnight Blue on paper) */
  tone?: 'ink' | 'auto'
  isDark?: boolean
  /** Set when the mark stands alone (e.g. "Provven"). Omit inside the wordmark. */
  label?: string
}

/**
 * Blue Star shield + check. Hot Embers on ink/dark, Midnight Blue on paper.
 * Geometry lives in public/brand/provven-mark*.svg (traced from the agency art).
 */
export default function ProvvenMark({ className, tone = 'ink', isDark = false, label }: ProvvenMarkProps) {
  const src = tone === 'ink' || isDark ? '/brand/provven-mark.svg' : '/brand/provven-mark-light.svg'

  return (
    <img
      src={src}
      alt={label ?? ''}
      role={label ? 'img' : undefined}
      aria-hidden={label ? undefined : true}
      className={cn('inline-block h-[1.15em] w-auto align-middle', className)}
    />
  )
}
