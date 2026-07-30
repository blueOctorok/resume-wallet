import type { AttestationBadgeSummary } from '@/lib/dot-attestation-badge'
import type { MidnightProofArtifact, ProofArtifact } from '@/lib/attestation-service'
import { provenanceTierFromProof } from '@/lib/attestation-fact-ui'

export function proofKindFromArtifact(artifact: unknown): string {
  if (!artifact || typeof artifact !== 'object') return 'signed_jwt'
  const kind = (artifact as ProofArtifact).kind
  return typeof kind === 'string' && kind.length > 0 ? kind : 'signed_jwt'
}

export function midnightFieldsFromArtifact(artifact: unknown): Pick<
  AttestationBadgeSummary,
  'txHash' | 'proofId' | 'provenanceTier'
> {
  if (!artifact || typeof artifact !== 'object') {
    return { txHash: null, proofId: null, provenanceTier: 'metadata' }
  }
  const proof = artifact as ProofArtifact
  if (proof.kind !== 'midnight_zk') {
    return { txHash: null, proofId: null, provenanceTier: 'metadata' }
  }
  const midnight = proof as MidnightProofArtifact
  return {
    txHash: midnight.txHash ?? null,
    proofId: midnight.proofId ?? null,
    provenanceTier: provenanceTierFromProof(proof),
  }
}
