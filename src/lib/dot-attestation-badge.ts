/**
 * DOT issuer badges → attestation honesty tier (P3.7 follow-on).
 *
 * Provenance first: no matching attestation → Accio / prior-employer issuer copy.
 * Midnight copy only when proof.kind === 'midnight_zk' (DEC-2026-05-004 / P3.6).
 */

import {
  formatAttestationProvenance,
  formatAttestationIssuedDate,
  formatVerifiedByStormLine,
} from '@/lib/attestation-fact-ui'
import {
  formatMvrFieldBadge,
  formatMvrRowBadge,
  type DotFieldProvenanceEntry,
} from '@/lib/dot-field-provenance'
import { formatVerifiedEmployerBadge } from '@/lib/employment-form3-provenance'
import type { FactType } from '@/lib/attestation-service'

export type AttestationProofKind = 'signed_jwt' | 'midnight_zk' | string

export interface AttestationBadgeSummary {
  factType: FactType | string
  proofKind: AttestationProofKind
  sourceCra: string | null
  sourcePullId: string | null
  issuedAt: string
  /** Midnight tx — optional; never required for badge copy */
  txHash?: string | null
}

export type DotBadgeHonestyTier = 'issuer_only' | 'storm_jwt' | 'midnight_zk'

export interface DotBadgeResult {
  text: string
  tier: DotBadgeHonestyTier
}

function formatMidnightLine(
  issuedAt: string,
  sourceCra: string | null | undefined,
  sourcePullId: string | null | undefined,
): string {
  return `Proven on Midnight on ${formatAttestationIssuedDate(issuedAt)} · ${formatAttestationProvenance(sourceCra, sourcePullId)}`
}

function tierFromProof(proofKind: AttestationProofKind): Exclude<DotBadgeHonestyTier, 'issuer_only'> {
  return proofKind === 'midnight_zk' ? 'midnight_zk' : 'storm_jwt'
}

function textFromAttestation(att: AttestationBadgeSummary): string {
  if (att.proofKind === 'midnight_zk') {
    return formatMidnightLine(att.issuedAt, att.sourceCra, att.sourcePullId)
  }
  return formatVerifiedByStormLine(att.issuedAt, att.sourceCra, att.sourcePullId)
}

function pullIdsMatch(
  sourcePullId: string | null | undefined,
  candidates: Array<string | null | undefined>,
): boolean {
  const pull = String(sourcePullId || '').trim()
  if (!pull) return false
  return candidates.some((c) => {
    const v = String(c || '').trim()
    return v.length > 0 && v === pull
  })
}

/**
 * Pick an MVR attestation for Form 1/2 badges.
 * Prefer source_pull_id match to orderId / accioOrderNumber; else single active MVR fact.
 */
export function matchMvrAttestation(
  attestations: AttestationBadgeSummary[],
  pullCandidates: {
    orderId?: string | null
    accioOrderNumber?: string | null
  },
): AttestationBadgeSummary | null {
  const mvr = attestations.filter((a) => a.factType === 'mvr_clean_36_months')
  if (mvr.length === 0) return null

  const matched = mvr.find((a) =>
    pullIdsMatch(a.sourcePullId, [pullCandidates.orderId, pullCandidates.accioOrderNumber]),
  )
  if (matched) return matched

  // No pull ids to match (or none matched) — only fall back when unambiguous
  if (mvr.length === 1) return mvr[0]
  return null
}

/**
 * Match prior-employer attestation by EVR request id (source_pull_id) or employment id.
 */
export function matchEmploymentAttestation(
  attestations: AttestationBadgeSummary[],
  meta: {
    verificationRequestId?: string | null
    employmentId?: string | null
  },
): AttestationBadgeSummary | null {
  const rows = attestations.filter((a) => a.factType === 'previous_employer_verified')
  if (rows.length === 0) return null

  const byRequest = rows.find((a) =>
    pullIdsMatch(a.sourcePullId, [meta.verificationRequestId]),
  )
  if (byRequest) return byRequest

  // Fallback: some older rows may have stored employment id as pull id
  const byEmployment = rows.find((a) => pullIdsMatch(a.sourcePullId, [meta.employmentId]))
  if (byEmployment) return byEmployment

  return null
}

/** Form 1 locked field badge — upgrade when MVR attestation matches. */
export function resolveMvrFieldDotBadge(
  entry: DotFieldProvenanceEntry,
  attestations: AttestationBadgeSummary[] = [],
): DotBadgeResult {
  const issuerText = formatMvrFieldBadge(entry)
  const att = matchMvrAttestation(attestations, {
    orderId: entry.orderId,
    accioOrderNumber: entry.accioOrderNumber,
  })
  if (!att) return { text: issuerText, tier: 'issuer_only' }
  return { text: textFromAttestation(att), tier: tierFromProof(att.proofKind) }
}

/** Form 2 MVR row badge (PSP stays issuer-only — no shipped PSP fact type). */
export function resolveMvrRowDotBadge(
  meta: {
    accioOrderNumber?: string | null
    asOf?: string | null
    orderId?: string | null
    kind?: 'mvr' | 'psp'
  },
  attestations: AttestationBadgeSummary[] = [],
): DotBadgeResult {
  const kind = meta.kind ?? 'mvr'
  const issuerText = formatMvrRowBadge({
    accioOrderNumber: meta.accioOrderNumber,
    asOf: meta.asOf,
    kind,
  })
  if (kind === 'psp') {
    return { text: issuerText, tier: 'issuer_only' }
  }
  const att = matchMvrAttestation(attestations, {
    orderId: meta.orderId,
    accioOrderNumber: meta.accioOrderNumber,
  })
  if (!att) return { text: issuerText, tier: 'issuer_only' }
  return { text: textFromAttestation(att), tier: tierFromProof(att.proofKind) }
}

/** Form 3 EVR-verified employer badge. */
export function resolveEmploymentDotBadge(
  meta: {
    status?: string | null
    verifiedAt?: string | null
    verificationRequestId?: string | null
    employmentId?: string | null
  },
  attestations: AttestationBadgeSummary[] = [],
): DotBadgeResult {
  const issuerText = formatVerifiedEmployerBadge({
    status: meta.status,
    verifiedAt: meta.verifiedAt,
  })
  const att = matchEmploymentAttestation(attestations, {
    verificationRequestId: meta.verificationRequestId,
    employmentId: meta.employmentId,
  })
  if (!att) return { text: issuerText, tier: 'issuer_only' }
  return { text: textFromAttestation(att), tier: tierFromProof(att.proofKind) }
}
