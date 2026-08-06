#!/usr/bin/env npx tsx
/**
 * P3.3+ — Prove a shipped fact on Preprod + persist attestation row.
 *
 * Usage:
 *   npm run midnight:prove-fact -- --user <candidate-uuid>
 *   npm run midnight:prove-fact -- --user <uuid> --fact cdl_class_a
 *   npm run midnight:prove-fact -- --user <uuid> --fact previous_employer_verified --employment-id <uuid>
 */
import { config } from 'dotenv'
import WebSocket from 'ws'
config({ path: '.env.local' })

if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket
}

import type { FactType } from '@/lib/attestation-service'
import { resolveAttestationFact, type ShippedFactType } from '@/lib/fact-registry'
import { createMidnightAttestationService } from '@/lib/midnight-attestation-service'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

const SHIPPED: ShippedFactType[] = [
  'mvr_clean_36_months',
  'cdl_class_a',
  'previous_employer_verified',
]

function parseArgs(argv: string[]) {
  let userId = ''
  let factType: ShippedFactType = 'mvr_clean_36_months'
  let employmentId = ''
  let verificationRequestId = ''
  let asJson = false

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--user' && argv[i + 1]) userId = argv[++i]
    else if (arg === '--fact' && argv[i + 1]) factType = argv[++i] as ShippedFactType
    else if (arg === '--employment-id' && argv[i + 1]) employmentId = argv[++i]
    else if (arg === '--verification-request-id' && argv[i + 1]) verificationRequestId = argv[++i]
    else if (arg === '--json') asJson = true
  }

  if (!userId) {
    throw new Error(
      'Usage: midnight:prove-fact -- --user <candidate-uuid> [--fact mvr_clean_36_months|cdl_class_a|previous_employer_verified] [--json]',
    )
  }

  if (!SHIPPED.includes(factType)) {
    throw new Error(`Unsupported --fact ${factType}. Shipped: ${SHIPPED.join(', ')}`)
  }

  return { userId, factType, employmentId, verificationRequestId, asJson }
}

async function main() {
  process.env.ATTESTATION_BACKEND = 'midnight'

  const { userId, factType, employmentId, verificationRequestId, asJson } = parseArgs(
    process.argv.slice(2),
  )

  const parameters: Record<string, unknown> = {}
  if (employmentId) parameters.employmentId = employmentId
  if (verificationRequestId) parameters.verificationRequestId = verificationRequestId

  // EVR prove requires a request/employment id — default to latest verified row.
  if (
    factType === 'previous_employer_verified' &&
    !parameters.employmentId &&
    !parameters.verificationRequestId
  ) {
    const supabase = await getAdminSupabaseClient()
    const { data: latest } = await supabase
      .from('employment_verification_requests')
      .select('id')
      .eq('driver_id', userId)
      .in('status', ['VERIFIED', 'PARTIALLY_VERIFIED'])
      .not('verified_at', 'is', null)
      .order('verified_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!latest?.id) {
      throw new Error(
        'No verified EVR on file — pass --verification-request-id or --employment-id',
      )
    }
    parameters.verificationRequestId = latest.id as string
    console.error(`[MIDNIGHT] Using latest EVR request ${latest.id}`)
  }

  await resolveAttestationFact({
    candidateUserId: userId,
    factType: factType as FactType,
    parameters: Object.keys(parameters).length > 0 ? parameters : undefined,
  })

  const service = createMidnightAttestationService()
  const attestation = await service.proveFact({
    candidateUserId: userId,
    factType: factType as FactType,
    parameters: Object.keys(parameters).length > 0 ? parameters : undefined,
  })

  const out = {
    ok: true,
    attestationId: attestation.id,
    factType: attestation.factType,
    proof: attestation.proof,
    issuedAt: attestation.issuedAt,
  }

  if (asJson) {
    console.log(JSON.stringify(out, null, 2))
  } else {
    console.log('[MIDNIGHT] Attestation persisted')
    console.log(`  ID:     ${attestation.id}`)
    console.log(`  Fact:   ${attestation.factType}`)
    console.log(`  Tx:     ${attestation.proof.kind === 'midnight_zk' ? attestation.proof.txHash : 'n/a'}`)
    console.log(`  Proof:  ${attestation.proof.kind === 'midnight_zk' ? attestation.proof.proofId : 'n/a'}`)
  }
}

main().catch((err) => {
  console.error('[MIDNIGHT] Prove failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
