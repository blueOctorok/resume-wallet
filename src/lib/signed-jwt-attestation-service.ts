import { SignJWT, jwtVerify, type JWTPayload } from 'jose'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import type {
  Attestation,
  AttestationInput,
  AttestationService,
  ProofArtifact,
  ResolveAttestationFact,
  VerificationResult,
  FactType,
} from '@/lib/attestation-service'
import { AttestationError } from '@/lib/attestation-service'

const DEFAULT_ISSUER = 'storm'
const DEFAULT_TTL_MS = 365 * 24 * 60 * 60 * 1000

export interface SignedJwtAttestationServiceConfig {
  resolveFact: ResolveAttestationFact
  getSupabase?: () => Promise<SupabaseClient>
  jwtSecret?: string
  issuer?: string
}

interface AttestationJwtClaims extends JWTPayload {
  attId: string
  candidateUserId: string
  factType: FactType
  factSummary: string
  disclosedFields: Record<string, unknown>
  audienceId?: string
  sourceCra?: string
  sourcePullId?: string
}

function getJwtSecretBytes(config?: SignedJwtAttestationServiceConfig): Uint8Array {
  const raw =
    config?.jwtSecret ??
    process.env.ATTESTATION_JWT_PRIVATE_KEY ??
    process.env.ATTESTATION_JWT_SECRET
  if (!raw?.trim()) {
    throw new AttestationError(
      'ATTESTATION_JWT_PRIVATE_KEY (or ATTESTATION_JWT_SECRET) is not configured'
    )
  }
  return new TextEncoder().encode(raw.trim())
}

function getIssuer(config?: SignedJwtAttestationServiceConfig): string {
  return (config?.issuer ?? process.env.ATTESTATION_ISSUER ?? DEFAULT_ISSUER).trim()
}

function defaultExpiresAt(): string {
  return new Date(Date.now() + DEFAULT_TTL_MS).toISOString()
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

async function supersedePriorRows(
  supabase: SupabaseClient,
  input: AttestationInput,
  newId: string
): Promise<void> {
  let query = supabase
    .from('attestations')
    .select('id')
    .eq('candidate_user_id', input.candidateUserId)
    .eq('fact_type', input.factType)
    .is('superseded_by', null)

  if (input.audienceId) {
    query = query.eq('audience_id', input.audienceId)
  } else {
    query = query.is('audience_id', null)
  }

  const { data: priorRows, error } = await query
  if (error) {
    throw new AttestationError(`Failed to load prior attestations: ${error.message}`)
  }

  for (const row of priorRows ?? []) {
    const { error: updateError } = await supabase
      .from('attestations')
      .update({ superseded_by: newId })
      .eq('id', row.id)

    if (updateError) {
      throw new AttestationError(`Failed to supersede attestation ${row.id}: ${updateError.message}`)
    }
  }
}

export function createSignedJwtAttestationService(
  config: SignedJwtAttestationServiceConfig
): AttestationService {
  const getSupabase = config.getSupabase ?? getAdminSupabaseClient
  const secretBytes = getJwtSecretBytes(config)
  const issuer = getIssuer(config)

  return {
    async proveFact(input: AttestationInput): Promise<Attestation> {
      const material = await config.resolveFact(input)
      const supabase = await getSupabase()
      const attestationId = crypto.randomUUID()
      const issuedAt = new Date().toISOString()
      const expiresAt = material.expiresAt ?? defaultExpiresAt()
      const expSeconds = Math.floor(new Date(expiresAt).getTime() / 1000)

      const jwt = await new SignJWT({
        attId: attestationId,
        candidateUserId: input.candidateUserId,
        factType: input.factType,
        factSummary: material.factSummary,
        disclosedFields: material.disclosedFields,
        ...(input.audienceId ? { audienceId: input.audienceId } : {}),
        ...(material.sourceCra ? { sourceCra: material.sourceCra } : {}),
        ...(material.sourcePullId ? { sourcePullId: material.sourcePullId } : {}),
      } satisfies AttestationJwtClaims)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuer(issuer)
        .setSubject(input.candidateUserId)
        .setJti(attestationId)
        .setIssuedAt()
        .setExpirationTime(expSeconds)
        .sign(secretBytes)

      const proof: ProofArtifact = { kind: 'signed_jwt', jwt, issuer }

      await supersedePriorRows(supabase, input, attestationId)

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
          source_cra: material.sourceCra ?? null,
          source_pull_id: material.sourcePullId ?? null,
          audience_id: input.audienceId ?? null,
          proof_artifact: proof,
        })
        .select('id, fact_type, fact_summary, disclosed_fields, issued_at, expires_at, proof_artifact')
        .single()

      if (insertError || !inserted) {
        throw new AttestationError(
          `Failed to persist attestation: ${insertError?.message ?? 'no data'}`
        )
      }

      return rowToAttestation(inserted)
    },

    async verifyAttestation(attestation: Attestation): Promise<VerificationResult> {
      const base = {
        factType: attestation.factType,
        factSummary: attestation.factSummary,
        disclosedFields: attestation.disclosedFields,
        issuedAt: attestation.issuedAt,
        issuer,
      }

      if (attestation.proof.kind !== 'signed_jwt') {
        return { valid: false, ...base, reason: 'Unsupported proof kind for Phase 2 verifier' }
      }

      try {
        const { payload } = await jwtVerify(attestation.proof.jwt, secretBytes, {
          issuer,
        })

        const claims = payload as AttestationJwtClaims

        if (claims.attId && attestation.id && claims.attId !== attestation.id) {
          return { valid: false, ...base, reason: 'JWT attestation id does not match record' }
        }

        if (claims.factType !== attestation.factType) {
          return { valid: false, ...base, reason: 'JWT fact type does not match attestation' }
        }

        const disclosedFields =
          (claims.disclosedFields as Record<string, unknown> | undefined) ??
          attestation.disclosedFields

        if (attestation.id) {
          try {
            const supabase = await getSupabase()
            const { data: row } = await supabase
              .from('attestations')
              .select('query_count')
              .eq('id', attestation.id)
              .maybeSingle()

            if (row) {
              await supabase
                .from('attestations')
                .update({ query_count: (row.query_count ?? 0) + 1 })
                .eq('id', attestation.id)
            }
          } catch {
            // Non-fatal — verification still succeeds without query_count bump
          }
        }

        return {
          valid: true,
          factType: attestation.factType,
          factSummary: claims.factSummary ?? attestation.factSummary,
          disclosedFields,
          issuedAt: attestation.issuedAt,
          issuer: attestation.proof.issuer,
        }
      } catch (err) {
        const reason =
          err instanceof Error ? err.message : 'JWT verification failed'
        return { valid: false, ...base, reason }
      }
    },
  }
}
