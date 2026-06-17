#!/usr/bin/env npx tsx
import { assertMidnightEnv, MIDNIGHT_CONFIG } from '../src/config.js'
import { registerDustIfNeeded, getWalletStatus } from '../src/prove-on-chain.js'
import { createMidnightWallet } from '../src/wallet.js'
import { mnemonicToSeedBuffer } from '../src/mnemonic-seed.js'

async function main() {
  assertMidnightEnv()

  console.log('[MIDNIGHT] Wallet status (before DUST registration):')
  const before = await getWalletStatus(MIDNIGHT_CONFIG.walletMnemonic)
  console.log(`  Address: ${before.address}`)
  console.log(`  tNIGHT:  ${before.tNight}`)
  console.log(`  tDUST:   ${before.tDust}`)

  const seed = mnemonicToSeedBuffer(MIDNIGHT_CONFIG.walletMnemonic)
  const walletCtx = await createMidnightWallet(seed)

  try {
    console.log('[MIDNIGHT] Registering tNIGHT UTXOs for DUST generation...')
    await registerDustIfNeeded(walletCtx)
    console.log('[MIDNIGHT] DUST registration complete')
  } finally {
    await walletCtx.wallet.stop()
  }

  const after = await getWalletStatus(MIDNIGHT_CONFIG.walletMnemonic)
  console.log(`  tDUST (after): ${after.tDust}`)
}

main().catch((err) => {
  console.error('[MIDNIGHT] DUST registration failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
