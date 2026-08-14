import type { SupabaseClient } from '@supabase/supabase-js'
import type { CardAttestedFact } from '@/types/career-card'
import { FACT_TYPE_UI, formatAttestationProvenance } from '@/lib/attestation-fact-ui'
import { ACTIVE_CARD_FACTS, type ShippedFactType } from '@/lib/fact-registry'

export type { CardAttestedFact }

/** Active attestations for career-card / resume display (not block_*). */
export async function loadCardAttestedFacts(
  supabase: SupabaseClient,
  candidateUserId: string,
): Promise<CardAttestedFact[]> {
  const { data: rows, error } = await supabase
    .from('attestations')
    .select('id, fact_type, fact_summary, issued_at, source_cra, source_pull_id')
    .eq('candidate_user_id', candidateUserId)
    .is('superseded_by', null)
    .order('issued_at', { ascending: false })

  if (error || !rows?.length) return []

  const seen = new Set<string>()
  const facts: CardAttestedFact[] = []
  for (const row of rows) {
    const factType = String(row.fact_type)
    if (seen.has(factType)) continue
    if (!(ACTIVE_CARD_FACTS as readonly string[]).includes(factType)) continue
    seen.add(factType)
    const ui = FACT_TYPE_UI[factType as ShippedFactType]
    facts.push({
      id: String(row.id),
      factType,
      label: (row.fact_summary as string) || ui?.label || factType,
      provenance: formatAttestationProvenance(
        (row.source_cra as string | null) ?? null,
        (row.source_pull_id as string | null) ?? null,
      ),
    })
  }
  return facts
}
