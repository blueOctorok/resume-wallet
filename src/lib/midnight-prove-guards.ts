import type { SupabaseClient } from '@supabase/supabase-js'
import { AttestationError } from '@/lib/attestation-service'
import type { ShippedFactType } from '@/lib/fact-registry'
import { buildPullNullifier } from '@/lib/pull-nullifier'

/**
 * P3.4-A — block re-proving the same Accio order / EVR id after supersede.
 * On-chain nullifier is the authoritative replay gate; this is the off-chain mirror.
 */
export async function assertNoActiveAttestationForPull(
  supabase: SupabaseClient,
  input: {
    candidateUserId: string
    factType: ShippedFactType
    sourcePullId: string
    audienceId?: string
  },
): Promise<void> {
  const pullNullifier = buildPullNullifier(input.sourcePullId)

  let query = supabase
    .from('attestations')
    .select('id, source_pull_id')
    .eq('candidate_user_id', input.candidateUserId)
    .eq('fact_type', input.factType)
    .is('superseded_by', null)

  if (input.audienceId) {
    query = query.eq('audience_id', input.audienceId)
  } else {
    query = query.is('audience_id', null)
  }

  const { data: rows, error } = await query
  if (error) {
    throw new AttestationError(`Failed to check pull replay: ${error.message}`)
  }

  for (const row of rows ?? []) {
    const existingPull = String(row.source_pull_id ?? '').trim()
    if (!existingPull) continue
    if (buildPullNullifier(existingPull) === pullNullifier) {
      throw new AttestationError(
        `Screening pull ${input.sourcePullId} already has an active ${input.factType} attestation — supersede before re-proving`,
      )
    }
  }
}

/** MVR facts must prove only the latest completed driver-owned pull. */
export function assertMvrPullMatchesLatest(
  latestAccioOrderNumber: string,
  materialPullId: string,
): void {
  if (latestAccioOrderNumber.trim() !== materialPullId.trim()) {
    throw new AttestationError(
      'Only the latest completed driver-owned MVR can be attested — order a fresh pull or wait for completion',
    )
  }
}
