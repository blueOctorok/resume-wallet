#!/usr/bin/env npx tsx
/** JSON stdin → JSON stdout on-chain prove (no Storm DB). */
import { assertMidnightEnv, MIDNIGHT_CONFIG } from '../src/config.js'
import { proveCleanMvrOnChain } from '../src/prove-on-chain.js'
import { assertContractCompiled } from '../src/wallet.js'
import type { OnChainProveInput } from '../src/prove-on-chain.js'

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

async function main() {
  assertMidnightEnv()
  assertContractCompiled()

  const raw = await readStdin()
  const input = JSON.parse(raw) as Omit<OnChainProveInput, 'mnemonic'>

  const result = await proveCleanMvrOnChain({
    ...input,
    mnemonic: MIDNIGHT_CONFIG.walletMnemonic,
  })

  process.stdout.write(JSON.stringify(result))
}

main().catch((err) => {
  process.stderr.write(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
