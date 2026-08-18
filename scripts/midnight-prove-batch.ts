#!/usr/bin/env npx tsx
/**
 * Batch-prove billboard MVR facts for driver-owned completed pulls.
 * Skips facts that already have an active attestation, or that fail resolve
 * (no class / no endorsements / unparseable Accio codes / no med cert).
 *
 * Usage:
 *   npm run midnight:prove-batch -- --dry-run
 *   npm run midnight:prove-batch -- --limit 20
 */
import { config } from 'dotenv'
import WebSocket from 'ws'
config({ path: '.env.local' })

if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket
}

import { AttestationError, type FactType } from '@/lib/attestation-service'
import { resolveAttestationFact, type ShippedFactType } from '@/lib/fact-registry'
import { createMidnightAttestationService } from '@/lib/midnight-attestation-service'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

const MVR_FACTS: ShippedFactType[] = [
  'cdl_class',
  'cdl_endorsements',
  'cdl_restrictions',
  'med_cert_valid',
]

function parseArgs(argv: string[]) {
  let dryRun = false
  let limit = 0
  const facts: ShippedFactType[] = []

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--dry-run') dryRun = true
    else if (arg === '--limit' && argv[i + 1]) limit = Number(argv[++i])
    else if (arg === '--fact' && argv[i + 1]) {
      const fact = argv[++i] as ShippedFactType
      if (!MVR_FACTS.includes(fact)) {
        throw new Error(`Unsupported --fact ${fact}. ${MVR_FACTS.join(', ')}`)
      }
      facts.push(fact)
    }
  }

  return { dryRun, limit, facts: facts.length > 0 ? facts : MVR_FACTS }
}

async function latestDriverOwnedUserIds(): Promise<string[]> {
  const supabase = await getAdminSupabaseClient()
  const { data, error } = await supabase
    .from('mvr_orders')
    .select('driver_user_id, completed_at')
    .eq('status', 'completed')
    .is('ordered_by_company_id', null)
    .not('accio_order_number', 'is', null)
    .order('completed_at', { ascending: false })

  if (error) throw new Error(error.message)

  const seen = new Set<string>()
  const userIds: string[] = []
  for (const row of data ?? []) {
    const id = String(row.driver_user_id ?? '')
    if (!id || seen.has(id)) continue
    seen.add(id)
    userIds.push(id)
  }
  return userIds
}

async function alreadyProven(
  userIds: string[],
  facts: ShippedFactType[],
): Promise<Set<string>> {
  const supabase = await getAdminSupabaseClient()
  const proven = new Set<string>()
  const chunk = 80
  for (let i = 0; i < userIds.length; i += chunk) {
    const slice = userIds.slice(i, i + chunk)
    const { data, error } = await supabase
      .from('attestations')
      .select('candidate_user_id, fact_type')
      .in('candidate_user_id', slice)
      .in('fact_type', facts)
      .is('superseded_by', null)
    if (error) throw new Error(error.message)
    for (const row of data ?? []) {
      proven.add(`${row.candidate_user_id}:${row.fact_type}`)
    }
  }
  return proven
}

function skipReason(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

async function main() {
  process.env.ATTESTATION_BACKEND = 'midnight'
  const { dryRun, limit, facts } = parseArgs(process.argv.slice(2))

  const userIds = await latestDriverOwnedUserIds()
  const proven = await alreadyProven(userIds, facts)
  const targets = limit > 0 ? userIds.slice(0, limit) : userIds

  console.log(
    `[MIDNIGHT] Batch ${dryRun ? 'dry-run' : 'prove'}: ${targets.length} drivers × ${facts.join(',')}`,
  )

  const service = dryRun ? null : createMidnightAttestationService()
  const counts = { proven: 0, skippedExisting: 0, skippedResolve: 0, ok: 0, failed: 0 }

  for (const userId of targets) {
    for (const factType of facts) {
      const key = `${userId}:${factType}`
      if (proven.has(key)) {
        counts.skippedExisting += 1
        continue
      }

      try {
        await resolveAttestationFact({
          candidateUserId: userId,
          factType: factType as FactType,
        })
      } catch (err) {
        counts.skippedResolve += 1
        console.log(`SKIP  ${userId.slice(0, 8)} ${factType} — ${skipReason(err)}`)
        continue
      }

      if (dryRun) {
        counts.ok += 1
        console.log(`READY ${userId.slice(0, 8)} ${factType}`)
        continue
      }

      try {
        const attestation = await service!.proveFact({
          candidateUserId: userId,
          factType: factType as FactType,
        })
        counts.ok += 1
        const tx =
          attestation.proof.kind === 'midnight_zk' ? attestation.proof.txHash.slice(0, 12) : 'n/a'
        console.log(`OK    ${userId.slice(0, 8)} ${factType} ${attestation.id} tx=${tx}`)
      } catch (err) {
        counts.failed += 1
        console.log(`FAIL  ${userId.slice(0, 8)} ${factType} — ${skipReason(err)}`)
      }
    }
  }

  console.log('[MIDNIGHT] Batch totals', counts)
}

main().catch((err) => {
  console.error('[MIDNIGHT] Batch failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
