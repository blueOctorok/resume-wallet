/**
 * Stays running on Fly. When a driver-owned MVR has a license class and no
 * Midnight proof, prove the Accio facts. The proof server on Fly only
 * calculates a proof when this process asks.
 */
import { config } from 'dotenv'
import WebSocket from 'ws'

config({ path: '.env.local' })

if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket
}

const signal = { stopping: false }

process.on('SIGTERM', () => {
  signal.stopping = true
  console.log('[MVR PROOF WORKER] stopping after the current proof')
})

async function main() {
  process.env.ATTESTATION_BACKEND = 'midnight'
  const { runMvrProofWorker } = await import('@/lib/mvr-proof-worker')
  await runMvrProofWorker(signal)
}

main().catch((err) => {
  console.error('[MVR PROOF WORKER] fatal:', err instanceof Error ? err.message : err)
  process.exit(1)
})
