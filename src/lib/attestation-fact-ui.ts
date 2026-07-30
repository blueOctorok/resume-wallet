import { Car, ShieldCheck, Building2, type LucideIcon } from 'lucide-react'
import type { ShippedFactType } from '@/lib/fact-registry'
import type {
  AttestationProvenanceTier,
  MidnightProofArtifact,
  ProofArtifact,
} from '@/lib/attestation-service'

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
    return 'Verified by ZKnight'
  }
  const label = CRA_LABELS[sourceCra] ?? sourceCra
  if (sourcePullId?.trim()) {
    return `Derived from ${label} pull ${sourcePullId}`
  }
  return `Derived from ${label}`
}

/** Human-readable issued date for carrier + candidate verification UI. */
export function formatAttestationIssuedDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

/**
 * Standard Phase-2 verification line — "Verified by Storm on [date]" + CRA citation.
 * Use for third-party attestation facts only (never self-reported blocks).
 */
export function formatVerifiedByStormLine(
  issuedAt: string,
  sourceCra?: string | null,
  sourcePullId?: string | null,
): string {
  return `Verified by ZKnight on ${formatAttestationIssuedDate(issuedAt)} · ${formatAttestationProvenance(sourceCra, sourcePullId)}`
}

export function provenanceTierFromProof(proof: ProofArtifact | null | undefined): AttestationProvenanceTier {
  if (proof?.kind === 'midnight_zk') {
    return proof.provenanceTier === 'issuer_signed' ? 'issuer_signed' : 'metadata'
  }
  return 'metadata'
}

export interface AttestationDisplayInput {
  issuedAt: string
  sourceCra?: string | null
  sourcePullId?: string | null
  proofKind?: ProofArtifact['kind'] | string
  provenanceTier?: AttestationProvenanceTier
  txHash?: string | null
  proofId?: string | null
}

/**
 * Single honesty helper for carrier UI, verify surfaces, and Stormi context.
 * Midnight marketing copy only when proof is midnight_zk AND issuer_signed (P3.4-B).
 */
export function formatAttestationVerificationLine(input: AttestationDisplayInput): string {
  const stormLine = formatVerifiedByStormLine(input.issuedAt, input.sourceCra, input.sourcePullId)

  if (input.proofKind === 'midnight_zk' && input.provenanceTier === 'issuer_signed') {
    return `Proven on Midnight on ${formatAttestationIssuedDate(input.issuedAt)} · ${formatAttestationProvenance(input.sourceCra, input.sourcePullId)}`
  }

  return stormLine
}

/** Technical details for verify UI — tx/proof id without "trust the math" until issuer_signed. */
export function formatAttestationVerifyDetails(input: AttestationDisplayInput): string[] {
  if (input.proofKind !== 'midnight_zk') return []
  const lines: string[] = []
  if (input.txHash?.trim()) lines.push(`Midnight transaction: ${input.txHash.trim()}`)
  if (input.proofId?.trim() && input.proofId.trim() !== input.txHash?.trim()) {
    lines.push(`Proof id: ${input.proofId.trim()}`)
  }
  if (input.provenanceTier !== 'issuer_signed') {
    lines.push('Predicate proof submitted — issuer signature pending (P3.4-B)')
  }
  return lines
}

export function attestationDisplayFromProof(
  issuedAt: string,
  sourceCra: string | null | undefined,
  sourcePullId: string | null | undefined,
  proof: ProofArtifact,
): AttestationDisplayInput {
  const midnight = proof.kind === 'midnight_zk' ? (proof as MidnightProofArtifact) : null
  return {
    issuedAt,
    sourceCra,
    sourcePullId,
    proofKind: proof.kind,
    provenanceTier: provenanceTierFromProof(proof),
    txHash: midnight?.txHash ?? null,
    proofId: midnight?.proofId ?? null,
  }
}

export function formatFactDisclosedFields(fields: Record<string, unknown>): string[] {
  return Object.entries(fields).map(([key, value]) => {
    if (value === null || value === undefined) return `${key}: —`
    if (typeof value === 'object') return `${key}: ${JSON.stringify(value)}`
    return `${key}: ${String(value)}`
  })
}
