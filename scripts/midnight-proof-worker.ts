/**
 * Stays running on Fly. When a driver-owned MVR has a license class and no
 * Midnight proof, prove the Accio facts. The proof server on Fly only
 * calculates a proof when this process asks.
 *
 * The wallet lives in its own process (midnight/runtime). This file must not
 * import that package: the app loader asks for a CommonJS build the package
 * does not ship, and the worker exits before it syncs.
 */
import { config } from 'dotenv'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import path from 'node:path'
import readline from 'node:readline'
import WebSocket from 'ws'
import type {
  MidnightOnChainProveInput,
  MidnightOnChainProveResult,
} from '../src/lib/midnight-prove-types'

config({ path: '.env.local' })

if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket
}

const CLI_PATH = path.join(process.cwd(), 'midnight/runtime/scripts/held-wallet-cli.ts')

interface HeldWallet {
  child: ChildProcessWithoutNullStreams
  ready: Promise<void>
  prove: (input: MidnightOnChainProveInput) => Promise<MidnightOnChainProveResult>
  stop: () => void
}

function startHeldWallet(): HeldWallet {
  const child = spawn('npx', ['tsx', CLI_PATH], {
    cwd: process.cwd(),
    env: process.env,
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  child.stderr.on('data', (chunk: Buffer) => {
    process.stderr.write(chunk)
  })

  const pending: string[] = []
  const waiters: Array<(line: string) => void> = []
  let shuttingDown = false

  readline.createInterface({ input: child.stdout }).on('line', (line) => {
    const waiter = waiters.shift()
    if (waiter) waiter(line)
    else pending.push(line)
  })

  function nextLine(): Promise<string> {
    const queued = pending.shift()
    if (queued !== undefined) return Promise.resolve(queued)
    return new Promise((resolve) => {
      waiters.push(resolve)
    })
  }

  child.on('exit', (code) => {
    if (shuttingDown) {
      process.exit(0)
      return
    }
    console.error(`[MVR PROOF WORKER] wallet process exited ${code ?? 1}`)
    process.exit(code ?? 1)
  })

  async function nextMessage(): Promise<{ ready?: boolean; ok?: boolean; result?: MidnightOnChainProveResult; error?: string }> {
    for (;;) {
      const line = await nextLine()
      try {
        return JSON.parse(line) as { ready?: boolean; ok?: boolean; result?: MidnightOnChainProveResult; error?: string }
      } catch {
        process.stderr.write(`${line}\n`)
      }
    }
  }

  const ready = nextMessage().then((message) => {
    if (!message.ready) throw new Error('wallet did not become ready')
  })

  return {
    child,
    ready,
    prove: async (input) => {
      await ready
      child.stdin.write(`${JSON.stringify(input)}\n`)
      const message = await nextMessage()
      if (!message.ok || !message.result) {
        throw new Error(message.error || 'Midnight prove failed')
      }
      return message.result
    },
    stop() {
      shuttingDown = true
    },
  }
}

const signal = { stopping: false }
const held = startHeldWallet()

process.on('SIGTERM', () => {
  signal.stopping = true
  console.log('[MVR PROOF WORKER] asking the wallet to save, then stopping')
  held.stop()
  held.child.kill('SIGTERM')
})

async function main() {
  process.env.ATTESTATION_BACKEND = 'midnight'
  // Does not return until the wallet has caught up. Checkpoints happen in
  // the wallet process, so a restart continues from the volume.
  await held.ready

  const { createMidnightAttestationService } = await import('@/lib/midnight-attestation-service')
  const { proveCompletedMvrFacts } = await import('@/lib/prove-mvr-facts')
  const { runMvrProofWorker } = await import('@/lib/mvr-proof-worker')

  const service = createMidnightAttestationService({
    proveOnChain: (input) => held.prove(input),
  })

  await runMvrProofWorker(signal, (userId) =>
    proveCompletedMvrFacts(userId, {
      prove: (attestation) => service.proveFact(attestation),
    }),
  )
}

main().catch((err) => {
  console.error('[MVR PROOF WORKER] fatal:', err instanceof Error ? err.message : err)
  process.exit(1)
})
