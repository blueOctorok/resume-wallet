import type { SupabaseClient } from '@supabase/supabase-js'
import type { AttestationInput } from '@/lib/attestation-service'
import { AttestationError } from '@/lib/attestation-service'

/**
 * Mark prior active attestations as superseded by `newId`.
 *
 * Must run **after** the new row is inserted — `superseded_by` FK references
 * `attestations(id)`, so the successor row must exist first.
 */
export async function supersedePriorAttestations(
  supabase: SupabaseClient,
  input: AttestationInput,
  newId: string,
): Promise<void> {
  let query = supabase
    .from('attestations')
    .select('id')
    .eq('candidate_user_id', input.candidateUserId)
    .eq('fact_type', input.factType)
    .is('superseded_by', null)
    .neq('id', newId)

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
