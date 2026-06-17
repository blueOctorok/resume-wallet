#!/usr/bin/env npx tsx
/**
 * P3.3 — Prove mvr_clean_36_months on Preprod + persist attestation row.
 *
 * Usage:
 *   npm run midnight:prove-fact -- --user <candidate-uuid>
 *   npm run midnight:prove-fact -- --user <uuid> --json
 */
import { config } from 'dotenv'
import WebSocket from 'ws'
config({ path: '.env.local' })

// @supabase/supabase-js constructs a RealtimeClient inside createClient(), which
// throws on Node < 22 ("no native WebSocket"). These scripts never use realtime,
// but we still need a global WebSocket to exist. Node 22+ already has one, so only
// polyfill when missing. Set before the (lazy) createClient call in main().
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket
}

import { resolveAttestationFact } from '@/lib/fact-registry'
import { createMidnightAttestationService } from '@/lib/midnight-attestation-service'

function parseArgs(argv: string[]) {
  let userId = ''
  let asJson = false

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--user' && argv[i + 1]) userId = argv[++i]
    else if (arg === '--json') asJson = true
  }

  if (!userId) {
    throw new Error('Usage: midnight:prove-fact -- --user <candidate-uuid> [--json]')
  }

  return { userId, asJson }
}

async function main() {
  process.env.ATTESTATION_BACKEND = 'midnight'

  const { userId, asJson } = parseArgs(process.argv.slice(2))

  // Preflight fact resolution (clear error if no MVR data).
  await resolveAttestationFact({
    candidateUserId: userId,
    factType: 'mvr_clean_36_months',
  })

  const service = createMidnightAttestationService()
  const attestation = await service.proveFact({
    candidateUserId: userId,
    factType: 'mvr_clean_36_months',
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
    console.log(`  Tx:     ${attestation.proof.kind === 'midnight_zk' ? attestation.proof.txHash : 'n/a'}`)
    console.log(`  Proof:  ${attestation.proof.kind === 'midnight_zk' ? attestation.proof.proofId : 'n/a'}`)
  }
}

main().catch((err) => {
  console.error('[MIDNIGHT] Prove failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
