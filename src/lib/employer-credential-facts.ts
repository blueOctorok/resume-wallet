import type { SupabaseClient } from '@supabase/supabase-js'
import type { FactType } from '@/lib/attestation-service'
import { AttestationError } from '@/lib/attestation-service'
import { attestationService } from '@/lib/attestation-service-registry'
import { attestationFromRow } from '@/lib/attestation-route-helpers'
import { loadDisclosureDenylistForAudience } from '@/lib/disclosure-preferences'
import { getFactDefinition, type ShippedFactType } from '@/lib/fact-registry'

export interface EmployerCredentialFact {
  id: string
  factType: ShippedFactType
  factSummary: string
  disclosedFields: Record<string, unknown>
  issuedAt: string
  expiresAt: string | null
  issuer: string
  sourceCra: string | null
  sourcePullId: string | null
}

/**
 * Lists cryptographically verified facts an employer may see for a candidate.
 * Uses attestationService.verifyAttestation — never reads block_* for badges.
 */
export async function listVerifiedCredentialFactsForEmployer(
  supabase: SupabaseClient,
  candidateUserId: string,
  companyId: string,
): Promise<EmployerCredentialFact[]> {
  const { data: rows, error } = await supabase
    .from('attestations')
    .select(
      'id, candidate_user_id, fact_type, fact_summary, disclosed_fields, issued_at, expires_at, proof_artifact, source_cra, source_pull_id, audience_id',
    )
    .eq('candidate_user_id', candidateUserId)
    .is('superseded_by', null)
    .or(`audience_id.is.null,audience_id.eq.${companyId}`)
    .order('issued_at', { ascending: false })

  if (error) {
    throw new AttestationError(`Failed to load attestations: ${error.message}`)
  }

  const deniedFacts = await loadDisclosureDenylistForAudience(
    supabase,
    candidateUserId,
    companyId,
  )

  const seenTypes = new Set<string>()
  const facts: EmployerCredentialFact[] = []

  for (const row of rows ?? []) {
    const factType = row.fact_type as string
    if (seenTypes.has(factType)) continue
    if (deniedFacts.has(factType)) continue
    if (!getFactDefinition(factType as FactType)) continue

    const attestation = attestationFromRow(row)
    const verification = await attestationService.verifyAttestation(attestation)
    if (!verification.valid) continue

    seenTypes.add(factType)
    facts.push({
      id: row.id as string,
      factType: factType as ShippedFactType,
      factSummary: verification.factSummary,
      disclosedFields: verification.disclosedFields,
      issuedAt: verification.issuedAt,
      expiresAt: (row.expires_at as string | null) ?? null,
      issuer: verification.issuer,
      sourceCra: (row.source_cra as string | null) ?? null,
      sourcePullId: (row.source_pull_id as string | null) ?? null,
    })
  }

  return facts
}
