/**
 * Attestation service contract — Phase 2 selective disclosure.
 * Implementations: signed JWT (P2.2), swap via attestation-service-registry.
 */

export type FactType =
  | 'mvr_clean_36_months'
  | 'mvr_no_dui_ever'
  | 'cdl_class_a'
  | 'cdl_endorsement_hazmat'
  | 'cdl_valid_through'
  | 'dot_application_complete'
  | 'employment_history_no_gaps'
  | 'previous_employer_verified'

export interface AttestationService {
  /**
   * Prove a specific fact about a candidate. Returns a verifiable artifact.
   */
  proveFact(input: AttestationInput): Promise<Attestation>

  /**
   * Verify an attestation independently. Used by carrier UIs and verification endpoints.
   */
  verifyAttestation(attestation: Attestation): Promise<VerificationResult>
}

export interface AttestationInput {
  candidateUserId: string
  factType: FactType
  parameters?: Record<string, unknown>
  audienceId?: string
}

export interface Attestation {
  id: string
  factType: FactType
  factSummary: string
  disclosedFields: Record<string, unknown>
  issuedAt: string
  expiresAt?: string
  proof: ProofArtifact
}

export type AttestationProvenanceTier = 'metadata' | 'issuer_signed'

export type MidnightProofArtifact = {
  kind: 'midnight_zk'
  txHash: string
  proofId: string
  /** metadata until P3.4-B in-circuit issuer signature — gates Midnight marketing copy. */
  provenanceTier?: AttestationProvenanceTier
  /** Preprod/mainnet DUST fee raw units (from tx.fees) — ops only, not shown in UI. */
  paidFees?: string
  estimatedFees?: string
}

export type ProofArtifact =
  | { kind: 'signed_jwt'; jwt: string; issuer: string }
  | MidnightProofArtifact

export interface VerificationResult {
  valid: boolean
  factType: FactType
  factSummary: string
  disclosedFields: Record<string, unknown>
  issuedAt: string
  issuer: string
  reason?: string
}

/** Resolved fact payload — populated by fact-registry (P2.3) before signing. */
export interface ResolvedAttestationFact {
  factSummary: string
  disclosedFields: Record<string, unknown>
  expiresAt?: string
  validUntil?: string
  sourceCra?: string
  sourcePullId?: string
}

export type ResolveAttestationFact = (
  input: AttestationInput
) => Promise<ResolvedAttestationFact>

export class AttestationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AttestationError'
  }
}
