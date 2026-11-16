#!/usr/bin/env npx tsx
/**
 * One wallet for the Fly worker. Stays up, saves itself while it catches up,
 * then proves one fact per stdin line. Progress stays on stderr so stdout
 * is only JSON lines the parent can read.
 */
import readline from 'node:readline'
import { assertMidnightEnv, MIDNIGHT_CONFIG } from '../src/config.js'
import { assertCircuitCompiled } from '../src/contract-registry.js'
import { hasNodeStoppedAnswering } from '../src/providers.js'
import {
  checkpointHeldWallet,
  openHeldMidnightWallet,
  proveFactOnChain,
  type OnChainProveInput,
} from '../src/prove-on-chain.js'

let stopping = false
let proving = false

function saveAndStop(): void {
  process.stderr.write('[MIDNIGHT] saving the wallet, then stopping\n')
  void checkpointHeldWallet().finally(() => {
    process.exit(0)
  })
}

process.on('SIGTERM', () => {
  stopping = true
  // A prove sets its fee's DUST aside until the transaction lands. Stopping
  // in the middle saves the wallet with that DUST still set aside, and the
  // ledger only gives it back after three hours. Fly waits five minutes
  // after SIGTERM (kill_timeout), which is enough to finish the prove.
  if (proving) {
    process.stderr.write('[MIDNIGHT] finishing the prove in progress before stopping\n')
    return
  }
  saveAndStop()
})

function writeLine(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value)}\n`)
}

async function main() {
  assertMidnightEnv()
  await openHeldMidnightWallet()
  if (stopping) return
  writeLine({ ready: true })

  const lines = readline.createInterface({ input: process.stdin })
  for await (const line of lines) {
    if (stopping) return
    const trimmed = line.trim()
    if (!trimmed) continue
    proving = true
    try {
      const input = JSON.parse(trimmed) as Omit<OnChainProveInput, 'mnemonic'>
      assertCircuitCompiled(input.factType)
      const result = await proveFactOnChain({
        ...input,
        mnemonic: MIDNIGHT_CONFIG.walletMnemonic,
      } as OnChainProveInput)
      writeLine({ ok: true, result })
    } catch (err) {
      writeLine({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      })
      if (hasNodeStoppedAnswering()) {
        // The DUST is already back in the wallet. Exit code 1 makes Fly start
        // the worker again with new node connections.
        process.stderr.write('[MIDNIGHT] saving the wallet, then restarting for new node connections\n')
        await checkpointHeldWallet()
        process.exit(1)
      }
    } finally {
      proving = false
    }
    if (stopping) {
      saveAndStop()
      return
    }
  }
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
