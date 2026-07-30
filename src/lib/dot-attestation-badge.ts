/**
 * DOT issuer badges → attestation honesty tier (P3.7 follow-on).
 *
 * Provenance first: no matching attestation → Accio / prior-employer issuer copy.
 * Midnight copy only when proof.kind === 'midnight_zk' AND provenanceTier === 'issuer_signed'.
 */

import {
  formatAttestationVerificationLine,
  type AttestationProvenanceTier,
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
  provenanceTier?: AttestationProvenanceTier
  sourceCra: string | null
  sourcePullId: string | null
  issuedAt: string
  txHash?: string | null
  proofId?: string | null
}

export type DotBadgeHonestyTier = 'issuer_only' | 'storm_jwt' | 'midnight_zk'

export interface DotBadgeResult {
  text: string
  tier: DotBadgeHonestyTier
}

function tierFromAttestation(att: AttestationBadgeSummary): DotBadgeHonestyTier {
  if (att.proofKind === 'midnight_zk' && att.provenanceTier === 'issuer_signed') {
    return 'midnight_zk'
  }
  if (att.proofKind === 'midnight_zk' || att.proofKind === 'signed_jwt') {
    return 'storm_jwt'
  }
  return 'storm_jwt'
}

function textFromAttestation(att: AttestationBadgeSummary): string {
  return formatAttestationVerificationLine({
    issuedAt: att.issuedAt,
    sourceCra: att.sourceCra,
    sourcePullId: att.sourcePullId,
    proofKind: att.proofKind,
    provenanceTier: att.provenanceTier,
    txHash: att.txHash,
    proofId: att.proofId,
  })
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
  return { text: textFromAttestation(att), tier: tierFromAttestation(att) }
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
  return { text: textFromAttestation(att), tier: tierFromAttestation(att) }
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
  return { text: textFromAttestation(att), tier: tierFromAttestation(att) }
}
