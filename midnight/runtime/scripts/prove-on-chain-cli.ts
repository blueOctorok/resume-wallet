#!/usr/bin/env npx tsx
/** JSON stdin → JSON stdout on-chain prove (no Storm DB). */
import { assertMidnightEnv } from '../src/config.js'
import { proveFactOnChain, type OnChainProveInput } from '../src/prove-on-chain.js'
import { assertCircuitCompiled } from '../src/contract-registry.js'
import { MIDNIGHT_CONFIG } from '../src/config.js'

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

async function main() {
  assertMidnightEnv()

  const raw = await readStdin()
  const input = JSON.parse(raw) as Omit<OnChainProveInput, 'mnemonic'>

  assertCircuitCompiled(input.factType)

  const result = await proveFactOnChain({
    ...input,
    mnemonic: MIDNIGHT_CONFIG.walletMnemonic,
  } as OnChainProveInput)

  process.stdout.write(JSON.stringify(result))
}

main().catch((err) => {
  process.stderr.write(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
