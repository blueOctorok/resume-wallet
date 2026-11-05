#!/usr/bin/env npx tsx
/**
 * One wallet for the Fly worker. Stays up, saves itself while it catches up,
 * then proves one fact per stdin line. Progress stays on stderr so stdout
 * is only JSON lines the parent can read.
 */
import readline from 'node:readline'
import { assertMidnightEnv, MIDNIGHT_CONFIG } from '../src/config.js'
import { assertCircuitCompiled } from '../src/contract-registry.js'
import {
  checkpointHeldWallet,
  openHeldMidnightWallet,
  proveFactOnChain,
  type OnChainProveInput,
} from '../src/prove-on-chain.js'

let stopping = false

process.on('SIGTERM', () => {
  stopping = true
  process.stderr.write('[MIDNIGHT] saving the wallet, then stopping\n')
  void checkpointHeldWallet().finally(() => {
    process.exit(0)
  })
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
    }
  }
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
