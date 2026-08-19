'use client'

import { cn } from '@/lib/utils'

interface ProvvenMarkProps {
  /** Size via font-size (e.g. `text-5xl`) — height is 1.15em so it tracks type */
  className?: string
  /** Kept for callers; the shield fill is always Hot Embers. */
  tone?: 'ink' | 'auto'
  isDark?: boolean
  /** Set when the mark stands alone (e.g. "Provven"). Omit inside the wordmark. */
  label?: string
}

/**
 * Blue Star shield + check — always Hot Embers (`#f15a2b`).
 * Geometry lives in public/brand/provven-mark.svg (traced from the agency art).
 */
export default function ProvvenMark({ className, label }: ProvvenMarkProps) {
  return (
    <img
      src="/brand/provven-mark.svg"
      alt={label ?? ''}
      role={label ? 'img' : undefined}
      aria-hidden={label ? undefined : true}
      className={cn('inline-block h-[1.15em] w-auto align-middle', className)}
    />
  )
}
