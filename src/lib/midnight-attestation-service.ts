import type { SupabaseClient } from '@supabase/supabase-js'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { assertDisclosureAllowsProve } from '@/lib/disclosure-preferences'
import { resolveAttestationFact, ACTIVE_CARD_FACTS, type ShippedFactType } from '@/lib/fact-registry'
import {
  getEmploymentVerificationForAttestation,
  getMvrAttestationContext,
} from '@/lib/block-data'
import { computeAsOfDateYmd } from '@/lib/mvr-clean-predicate'
import {
  classLetterToCode,
  endorsementMaskFromCodes,
  expirationToYmd,
  restrictionMaskFromCodes,
} from '@/lib/mvr-field-predicate'
import {
  proveFactOnMidnight,
  type MidnightOnChainProveInput,
  type MidnightOnChainProveResult,
} from '@/lib/midnight-prove-bridge'
import type {
  Attestation,
  AttestationInput,
  AttestationService,
  MidnightProofArtifact,
  ProofArtifact,
  VerificationResult,
  FactType,
} from '@/lib/attestation-service'
import { AttestationError } from '@/lib/attestation-service'
import { supersedePriorAttestations } from '@/lib/attestation-supersede'
import {
  assertMvrPullMatchesLatest,
  assertNoActiveAttestationForPull,
} from '@/lib/midnight-prove-guards'

export interface MidnightAttestationServiceConfig {
  getSupabase?: () => Promise<SupabaseClient>
  /** Override for tests — skips tsx subprocess. */
  proveOnChain?: (input: MidnightOnChainProveInput) => Promise<MidnightOnChainProveResult>
}

const MIDNIGHT_SHIPPED_FACTS: ReadonlySet<ShippedFactType> = new Set(ACTIVE_CARD_FACTS)

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

function mvrAnchorDate(completedAt: string | null, lastOrderedAt: string | null): Date {
  if (completedAt) return new Date(completedAt)
  if (lastOrderedAt) return new Date(lastOrderedAt)
  return new Date()
}

function buildMidnightProof(onChain: MidnightOnChainProveResult): MidnightProofArtifact {
  return {
    kind: 'midnight_zk',
    txHash: onChain.txHash,
    proofId: onChain.proofId,
    // P3.4-B flips to issuer_signed — until then UI stays on Storm+CRA copy.
    provenanceTier: 'metadata',
    ...(onChain.paidFees !== undefined ? { paidFees: onChain.paidFees } : {}),
    ...(onChain.estimatedFees !== undefined
      ? { estimatedFees: onChain.estimatedFees }
      : {}),
    ...(onChain.predicateEnforced ? { predicateEnforced: true } : {}),
  }
}

async function buildOnChainInput(
  supabase: SupabaseClient,
  input: AttestationInput,
  material: Awaited<ReturnType<typeof resolveAttestationFact>>,
): Promise<MidnightOnChainProveInput> {
  if (!material.sourceCra || !material.sourcePullId) {
    throw new AttestationError('Missing source_cra or source_pull_id for Midnight attestation')
  }

  const factType = input.factType as ShippedFactType

  await assertNoActiveAttestationForPull(supabase, {
    candidateUserId: input.candidateUserId,
    factType,
    sourcePullId: material.sourcePullId,
    audienceId: input.audienceId,
  })

  if (
    factType === 'cdl_class' ||
    factType === 'cdl_endorsements' ||
    factType === 'cdl_restrictions' ||
    factType === 'med_cert_valid' ||
    factType === 'cdl_class_a'
  ) {
    const mvrCtx = await getMvrAttestationContext(supabase, input.candidateUserId)
    if (!mvrCtx) {
      throw new AttestationError('No driver-owned completed MVR on file — cannot build predicate witness')
    }

    assertMvrPullMatchesLatest(mvrCtx.accioOrderNumber, material.sourcePullId)

    const anchor = mvrAnchorDate(mvrCtx.completedAt, mvrCtx.mvr.last_ordered_at)
    const asOfDateYmd = computeAsOfDateYmd(anchor)
    const base = {
      candidateUserId: input.candidateUserId,
      sourceCra: material.sourceCra,
      sourcePullId: material.sourcePullId,
      asOfDateYmd,
      disclosedFields: material.disclosedFields,
    }

    if (factType === 'cdl_class_a') {
      return { ...base, factType: 'cdl_class_a', holdsClassA: true }
    }

    try {
      if (factType === 'cdl_class') {
      const letter = String(material.disclosedFields.class ?? '')
      const classCode =
        typeof material.disclosedFields.classCode === 'number'
          ? material.disclosedFields.classCode
          : classLetterToCode(letter)
      return { ...base, factType: 'cdl_class', classCode }
    }

    if (factType === 'cdl_endorsements') {
      const mask =
        typeof material.disclosedFields.mask === 'number'
          ? material.disclosedFields.mask
          : endorsementMaskFromCodes(
              String(material.disclosedFields.endorsements ?? '')
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            )
      return { ...base, factType: 'cdl_endorsements', mask }
    }

    if (factType === 'cdl_restrictions') {
      const raw = String(material.disclosedFields.restrictions ?? '')
      const mask =
        typeof material.disclosedFields.mask === 'number'
          ? material.disclosedFields.mask
          : restrictionMaskFromCodes(
              !raw || raw.toLowerCase() === 'none'
                ? []
                : raw.split(',').map((s) => s.trim()).filter(Boolean),
            )
      return { ...base, factType: 'cdl_restrictions', mask }
    }

    const expirationYmd =
      typeof material.disclosedFields.expirationYmd === 'number'
        ? material.disclosedFields.expirationYmd
        : expirationToYmd(
            typeof material.disclosedFields.expiration === 'string'
              ? material.disclosedFields.expiration
              : null,
          )
    if (!expirationYmd) {
      throw new AttestationError(
        'Midnight med-cert proof requires a parseable expiration date on the Accio MVR',
      )
    }
    return { ...base, factType: 'med_cert_valid', expirationYmd }
    } catch (err) {
      if (err instanceof AttestationError) throw err
      throw new AttestationError(
        err instanceof Error ? err.message : 'Failed to encode MVR field for Midnight',
      )
    }
  }

  const employmentId =
    typeof input.parameters?.employmentId === 'string' ? input.parameters.employmentId : undefined
  const verificationRequestId =
    typeof input.parameters?.verificationRequestId === 'string'
      ? input.parameters.verificationRequestId
      : undefined

  const evrRow = await getEmploymentVerificationForAttestation(supabase, input.candidateUserId, {
    employmentId,
    verificationRequestId,
  })

  if (!evrRow?.verified_at) {
    throw new AttestationError('No verified prior-employer response on file')
  }

  if (!evrRow.dkimValid) {
    throw new AttestationError(
      'Midnight EV proof requires a DKIM-valid inbound reply from the invited employer domain — form responses stay Verified by Provven only',
    )
  }

  const verifiedAt = new Date(evrRow.verified_at)
  const asOfDateYmd = computeAsOfDateYmd(verifiedAt)

  return {
    candidateUserId: input.candidateUserId,
    factType: 'previous_employer_verified',
    sourceCra: material.sourceCra,
    sourcePullId: material.sourcePullId,
    asOfDateYmd,
    disclosedFields: material.disclosedFields,
    employerVerified: true,
  }
}

export function createMidnightAttestationService(
  config: MidnightAttestationServiceConfig = {},
): AttestationService {
  const getSupabase = config.getSupabase ?? getAdminSupabaseClient
  const proveOnChain = config.proveOnChain ?? proveFactOnMidnight

  return {
    async proveFact(input: AttestationInput): Promise<Attestation> {
      const factType = input.factType as ShippedFactType
      if (!MIDNIGHT_SHIPPED_FACTS.has(factType)) {
        throw new AttestationError(
          `Midnight backend does not support ${input.factType} — shipped facts: ${[...MIDNIGHT_SHIPPED_FACTS].join(', ')}`,
        )
      }

      const supabase = await getSupabase()
      await assertDisclosureAllowsProve(supabase, input)

      const material = await resolveAttestationFact(input)
      const onChainInput = await buildOnChainInput(supabase, input, material)
      const onChain = await proveOnChain(onChainInput)

      const attestationId = crypto.randomUUID()
      const issuedAt = new Date().toISOString()
      const expiresAt = material.expiresAt ?? defaultExpiresAt()
      const proof = buildMidnightProof(onChain)

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

      return {
        valid: true,
        ...base,
        issuer: 'storm-midnight',
      }
    },
  }
}
