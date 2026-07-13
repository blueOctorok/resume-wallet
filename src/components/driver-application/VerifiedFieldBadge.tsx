'use client'

import { ShieldCheck } from 'lucide-react'
import { isDarkTheme } from '@/lib/theme-storage'
import { useTheme } from '@/contexts/ThemeContext'
import type { DotFieldProvenanceEntry } from '@/lib/dot-field-provenance'
import { formatMvrFieldBadge } from '@/lib/dot-field-provenance'

interface VerifiedFieldBadgeProps {
  entry: DotFieldProvenanceEntry
}

/** Small honest badge under a hard-locked DOT field (P3.7). */
export default function VerifiedFieldBadge({ entry }: VerifiedFieldBadgeProps) {
  const { theme } = useTheme()
  const dark = isDarkTheme(theme)

  return (
    <p
      className={`mt-1 flex items-start gap-1 text-[11px] leading-snug ${
        dark ? 'text-teal-300/90' : 'text-teal-800'
      }`}
      title={formatMvrFieldBadge(entry)}
    >
      <ShieldCheck className='mt-0.5 h-3 w-3 shrink-0' aria-hidden />
      <span>{formatMvrFieldBadge(entry)}</span>
    </p>
  )
}
