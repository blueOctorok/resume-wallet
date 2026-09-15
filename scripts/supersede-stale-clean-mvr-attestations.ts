#!/usr/bin/env npx tsx
/**
 * Void `mvr_clean_36_months` attestations that the corrected accident parser
 * now contradicts (Sept 2026).
 *
 * Accidents never parsed, so `proveMvrClean36Months` only ever saw violations.
 * A driver with a reportable crash and no moving violations could therefore be
 * issued — and proven on Midnight — as "Clean MVR". The predicate now gates on
 * accidents too; this retires the attestations issued under the old one.
 *
 * Re-evaluates each live attestation against its OWN disclosed window using
 * `hasDatedEventInWindow` from the fact registry, so the script and the issuer
 * can never disagree. Attestations that are still true are left alone.
 *
 * Dry run (default):  npx tsx scripts/supersede-stale-clean-mvr-attestations.ts
 * Apply:              npx tsx scripts/supersede-stale-clean-mvr-attestations.ts --apply
 */
import { config } from 'dotenv'
import WebSocket from 'ws'
config({ path: '.env.local' })

if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket
}

import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { hasDatedEventInWindow } from '@/lib/fact-registry'
import type { MvrAccident } from '@/types/driver-profile'

const APPLY = process.argv.includes('--apply')

async function main() {
  const supabase = await getAdminSupabaseClient()

  // source_cra IS NOT NULL skips the tombstone rows, which share fact_type.
  const { data: rows, error } = await supabase
    .from('attestations')
    .select('id, candidate_user_id, fact_type, fact_summary, disclosed_fields, issued_at')
    .eq('fact_type', 'mvr_clean_36_months')
    .is('superseded_by', null)
    .not('source_cra', 'is', null)

  if (error) throw new Error(`Failed to load clean-MVR attestations: ${error.message}`)

  console.log(
    `[SUPERSEDE] ${rows?.length ?? 0} live clean-MVR attestations${APPLY ? '' : ' (DRY RUN)'}\n`,
  )

  let voided = 0

  for (const row of rows ?? []) {
    const fields = (row.disclosed_fields ?? {}) as Record<string, string>
    const windowStart = new Date(fields.verificationWindowStart)
    const windowEnd = new Date(fields.verificationWindowEnd)
    if (Number.isNaN(windowStart.getTime()) || Number.isNaN(windowEnd.getTime())) {
      console.warn(`[SUPERSEDE] ${row.id}: unusable disclosed window — skipping`)
      continue
    }

    const { data: mvr } = await supabase
      .from('block_driver_mvr')
      .select('accidents')
      .eq('user_id', row.candidate_user_id)
      .maybeSingle()

    const accidents = (mvr?.accidents ?? []) as MvrAccident[]
    if (!hasDatedEventInWindow(accidents, windowStart, windowEnd)) continue

    const offending = accidents
      .filter((a) => hasDatedEventInWindow([a], windowStart, windowEnd))
      .map((a) => `${a.date} ${a.description}`.trim())

    voided++
    console.log(
      `[SUPERSEDE] ${row.id} (candidate ${row.candidate_user_id})\n` +
        `  window ${fields.verificationWindowStart} → ${fields.verificationWindowEnd}\n` +
        `  accidents in window: ${offending.join(' | ')}`,
    )

    if (!APPLY) continue

    // Attestations are immutable — insert a tombstone, then point the stale row
    // at it. Never edit the original (attestation-architecture.mdc).
    const tombstoneId = crypto.randomUUID()
    const { error: tombstoneError } = await supabase.from('attestations').insert({
      id: tombstoneId,
      candidate_user_id: row.candidate_user_id,
      fact_type: row.fact_type,
      fact_summary:
        'Superseded — issued before accidents were parsed; MVR shows an accident in the window',
      disclosed_fields: { reason: 'accident_parsing_fix_2026_09' },
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

    console.log(`  → superseded by ${tombstoneId}`)
  }

  console.log(
    `\n[SUPERSEDE] ${APPLY ? 'voided' : 'would void'} ${voided} of ${rows?.length ?? 0} attestations`,
  )
  if (!APPLY) console.log('[SUPERSEDE] Dry run only — re-run with --apply to write.')
}

main().catch((err) => {
  console.error('[SUPERSEDE] Failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
