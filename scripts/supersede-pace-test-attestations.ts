#!/usr/bin/env npx tsx
/**
 * P3.4-A backfill — supersede Pace-derived Preprod test attestations.
 *
 * Targets (EXECUTION_CHECKLIST — proven before driver-owned FCRA gate):
 * - 167040f7-dfd5-4d3d-b15c-53b6c09b83bc (candidate 0897bf34-…)
 * - f871bef0-dd41-49cd-8bbc-4b561ef03f5b (candidate ab0114b1-…)
 */
import { config } from 'dotenv'
import WebSocket from 'ws'
config({ path: '.env.local' })

if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket
}

import { getAdminSupabaseClient } from '@/utils/supabase/admin'

/** Full UUIDs — never ILIKE a uuid column (Postgres: operator does not exist: uuid ~~*). */
const PACE_DERIVED_ATTESTATION_IDS = [
  '167040f7-dfd5-4d3d-b15c-53b6c09b83bc',
  'f871bef0-dd41-49cd-8bbc-4b561ef03f5b',
]

async function main() {
  const supabase = await getAdminSupabaseClient()

  const { data: rows, error } = await supabase
    .from('attestations')
    .select('id, candidate_user_id, fact_type, superseded_by, proof_artifact')
    .in('id', PACE_DERIVED_ATTESTATION_IDS)

  if (error) {
    throw new Error(`Failed to load Pace-derived attestations: ${error.message}`)
  }

  const targets = (rows ?? []).filter((row) => {
    if (row.superseded_by) return false
    const proof = row.proof_artifact as { kind?: string }
    return proof?.kind === 'midnight_zk'
  })

  if (targets.length === 0) {
    console.log('[SUPERSEDE] No Pace-derived midnight_zk attestations to void')
    return
  }

  // One tombstone per candidate — superseded_by may point across rows, but keep
  // the void artifact owned by the same user as the row being superseded.
  for (const row of targets) {
    const tombstoneId = crypto.randomUUID()

    const { error: tombstoneError } = await supabase.from('attestations').insert({
      id: tombstoneId,
      candidate_user_id: row.candidate_user_id,
      fact_type: row.fact_type,
      fact_summary: 'Superseded — Pace-derived Preprod test attestation (P3.4-A backfill)',
      disclosed_fields: { reason: 'pace_derived_backfill' },
      proof_artifact: {
        kind: 'midnight_zk',
        txHash: 'superseded',
        proofId: 'superseded',
        provenanceTier: 'metadata',
      },
      source_cra: null,
      source_pull_id: null,
    })

    if (tombstoneError) {
      throw new Error(`Failed to insert tombstone for ${row.id}: ${tombstoneError.message}`)
    }

    const { error: updateError } = await supabase
      .from('attestations')
      .update({ superseded_by: tombstoneId })
      .eq('id', row.id)

    if (updateError) {
      throw new Error(`Failed to supersede ${row.id}: ${updateError.message}`)
    }

    console.log(`[SUPERSEDE] Marked ${row.id} superseded by ${tombstoneId}`)
  }
}

main().catch((err) => {
  console.error('[SUPERSEDE] Failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
