import { Car, ShieldCheck, Building2, type LucideIcon } from 'lucide-react'
import type { ShippedFactType } from '@/lib/fact-registry'

/** Carrier-visible labels + icons for shipped third-party facts (P2.3). */
export const FACT_TYPE_UI: Record<
  ShippedFactType,
  { label: string; icon: LucideIcon; category: 'driving' | 'license' | 'employment' }
> = {
  mvr_clean_36_months: {
    label: 'Clean MVR (36 months)',
    icon: ShieldCheck,
    category: 'driving',
  },
  cdl_class_a: {
    label: 'CDL Class A',
    icon: Car,
    category: 'license',
  },
  previous_employer_verified: {
    label: 'Prior employer verified',
    icon: Building2,
    category: 'employment',
  },
}

const CRA_LABELS: Record<string, string> = {
  accio: 'Accio',
  prior_employer: 'prior employer verification',
}

/** Phase-2 provenance line — CRA citation without claiming on-chain proof (DEC-2026-05-011). */
export function formatAttestationProvenance(
  sourceCra: string | null | undefined,
  sourcePullId: string | null | undefined,
): string {
  if (!sourceCra?.trim()) {
    return 'Verified by Storm'
  }
  const label = CRA_LABELS[sourceCra] ?? sourceCra
  if (sourcePullId?.trim()) {
    return `Derived from ${label} pull ${sourcePullId}`
  }
  return `Derived from ${label}`
}

export function formatFactDisclosedFields(fields: Record<string, unknown>): string[] {
  return Object.entries(fields).map(([key, value]) => {
    if (value === null || value === undefined) return `${key}: —`
    if (typeof value === 'object') return `${key}: ${JSON.stringify(value)}`
    return `${key}: ${String(value)}`
  })
}
