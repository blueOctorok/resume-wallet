import type { SupabaseClient } from '@supabase/supabase-js'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { assertDisclosureAllowsProve } from '@/lib/disclosure-preferences'
import { resolveAttestationFact } from '@/lib/fact-registry'
import { getMvrAttestationContext } from '@/lib/block-data'
import {
  assertMvrCleanPredicatePasses,
  buildMvrCleanWitnessPayload,
} from '@/lib/mvr-clean-predicate'
import {
  proveFactOnMidnight,
  type MidnightOnChainProveInput,
  type MidnightOnChainProveResult,
} from '@/lib/midnight-prove-bridge'
import type {
  Attestation,
  AttestationInput,
  AttestationService,
  ProofArtifact,
  VerificationResult,
  FactType,
} from '@/lib/attestation-service'
import { AttestationError } from '@/lib/attestation-service'
import { supersedePriorAttestations } from '@/lib/attestation-supersede'

export interface MidnightAttestationServiceConfig {
  getSupabase?: () => Promise<SupabaseClient>
  /** Override for tests — skips tsx subprocess. */
  proveOnChain?: (input: MidnightOnChainProveInput) => Promise<MidnightOnChainProveResult>
}

function rowToAttestation(row: {
  id: string
  fact_type: string
  fact_summary: string
  disclosed_fields: Record<string, unknown>
  issued_at: string
  expires_at: string | null
  proof_artifact: ProofArtifact
}): Attestation {
  return {
    id: row.id,
    factType: row.fact_type as FactType,
    factSummary: row.fact_summary,
    disclosedFields: row.disclosed_fields ?? {},
    issuedAt: row.issued_at,
    expiresAt: row.expires_at ?? undefined,
    proof: row.proof_artifact,
  }
}

const DEFAULT_TTL_MS = 365 * 24 * 60 * 60 * 1000

function defaultExpiresAt(): string {
  return new Date(Date.now() + DEFAULT_TTL_MS).toISOString()
}

export function createMidnightAttestationService(
  config: MidnightAttestationServiceConfig = {},
): AttestationService {
  const getSupabase = config.getSupabase ?? getAdminSupabaseClient
  const proveOnChain = config.proveOnChain ?? proveFactOnMidnight

  return {
    async proveFact(input: AttestationInput): Promise<Attestation> {
      if (input.factType !== 'mvr_clean_36_months') {
        throw new AttestationError(
          `Midnight backend (P3.3) only supports mvr_clean_36_months — got ${input.factType}`,
        )
      }

      const supabase = await getSupabase()
      await assertDisclosureAllowsProve(supabase, input)

      const material = await resolveAttestationFact(input)
      if (!material.sourceCra || !material.sourcePullId) {
        throw new AttestationError('Missing source_cra or source_pull_id for Midnight attestation')
      }

      const mvrCtx = await getMvrAttestationContext(supabase, input.candidateUserId)
      if (!mvrCtx) {
        throw new AttestationError('No completed MVR on file — cannot build predicate witness')
      }

      const anchor = mvrCtx.completedAt
        ? new Date(mvrCtx.completedAt)
        : mvrCtx.mvr.last_ordered_at
          ? new Date(mvrCtx.mvr.last_ordered_at)
          : new Date()

      const witnessPayload = buildMvrCleanWitnessPayload({
        anchor,
        violations: mvrCtx.mvr.violations ?? [],
      })
      assertMvrCleanPredicatePasses(witnessPayload)

      const onChain = await proveOnChain({
        candidateUserId: input.candidateUserId,
        factType: input.factType,
        sourceCra: material.sourceCra,
        sourcePullId: material.sourcePullId,
        disclosedFields: material.disclosedFields,
        windowStartYmd: witnessPayload.window.windowStartYmd,
        windowEndYmd: witnessPayload.window.windowEndYmd,
        violationSlots: witnessPayload.slots,
      })

      const attestationId = crypto.randomUUID()
      const issuedAt = new Date().toISOString()
      const expiresAt = material.expiresAt ?? defaultExpiresAt()

      const proof: ProofArtifact = {
        kind: 'midnight_zk',
        txHash: onChain.txHash,
        proofId: onChain.proofId,
      }

      const { data: inserted, error: insertError } = await supabase
        .from('attestations')
        .insert({
          id: attestationId,
          candidate_user_id: input.candidateUserId,
          fact_type: input.factType,
          fact_summary: material.factSummary,
          disclosed_fields: material.disclosedFields,
          issued_at: issuedAt,
          expires_at: expiresAt,
          valid_until: material.validUntil ?? null,
          source_cra: material.sourceCra,
          source_pull_id: material.sourcePullId,
          audience_id: input.audienceId ?? null,
          proof_artifact: proof,
        })
        .select('id, fact_type, fact_summary, disclosed_fields, issued_at, expires_at, proof_artifact')
        .single()

      if (insertError || !inserted) {
        throw new AttestationError(
          `Failed to persist attestation: ${insertError?.message ?? 'no data'}`,
        )
      }

      await supersedePriorAttestations(supabase, input, attestationId)

      return rowToAttestation(inserted)
    },

    async verifyAttestation(attestation: Attestation): Promise<VerificationResult> {
      const base = {
        factType: attestation.factType,
        factSummary: attestation.factSummary,
        disclosedFields: attestation.disclosedFields,
        issuedAt: attestation.issuedAt,
        issuer: 'storm-midnight',
      }

      if (attestation.proof.kind !== 'midnight_zk') {
        return {
          valid: false,
          ...base,
          reason: 'Unsupported proof kind for Midnight verifier',
        }
      }

      if (!attestation.proof.txHash?.trim()) {
        return { valid: false, ...base, reason: 'Missing txHash on midnight_zk proof' }
      }

      // P3.3: tx submitted + persisted — indexer read verification ships in P3.5.
      return {
        valid: true,
        ...base,
        issuer: 'storm-midnight',
      }
    },
  }
}
