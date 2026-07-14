'use client'

import { ShieldCheck } from 'lucide-react'
import { isDarkTheme } from '@/lib/theme-storage'
import { useTheme } from '@/contexts/ThemeContext'
import type { DotFieldProvenanceEntry } from '@/lib/dot-field-provenance'
import {
  resolveMvrFieldDotBadge,
  type AttestationBadgeSummary,
} from '@/lib/dot-attestation-badge'

interface VerifiedFieldBadgeProps {
  entry: DotFieldProvenanceEntry
  /** Active attestations — upgrades Accio copy when an MVR fact matches */
  attestations?: AttestationBadgeSummary[]
}

/** Small honest badge under a hard-locked DOT field (P3.7). */
export default function VerifiedFieldBadge({
  entry,
  attestations = [],
}: VerifiedFieldBadgeProps) {
  const { theme } = useTheme()
  const dark = isDarkTheme(theme)
  const badge = resolveMvrFieldDotBadge(entry, attestations)

  return (
    <p
      className={`mt-1 flex items-start gap-1 text-[11px] leading-snug ${
        dark ? 'text-teal-300/90' : 'text-teal-800'
      }`}
      title={badge.text}
      data-honesty-tier={badge.tier}
    >
      <ShieldCheck className='mt-0.5 h-3 w-3 shrink-0' aria-hidden />
      <span>{badge.text}</span>
    </p>
  )
}
