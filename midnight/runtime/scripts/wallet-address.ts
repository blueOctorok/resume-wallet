#!/usr/bin/env npx tsx
/** Print unshielded address without waiting for chain sync (verify vs Lace). */
import { assertMidnightEnv, MIDNIGHT_CONFIG } from '../src/config.js'
import { mnemonicToSeedBuffer } from '../src/mnemonic-seed.js'
import { createMidnightWallet } from '../src/wallet.js'

async function main() {
  assertMidnightEnv(false)
  const seed = mnemonicToSeedBuffer(MIDNIGHT_CONFIG.walletMnemonic)
  const ctx = await createMidnightWallet(seed)
  const address = ctx.unshieldedKeystore.getBech32Address().asString()
  console.log('[MIDNIGHT] Lace-compatible unshielded address (no sync):')
  console.log(`  ${address}`)
  console.log('  Compare to Lace → Receive → Unshielded')
  await ctx.wallet.stop()
}

main().catch((err) => {
  console.error('[MIDNIGHT] Address check failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
