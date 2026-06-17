#!/usr/bin/env npx tsx
import { assertMidnightEnv, MIDNIGHT_CONFIG, resolveContractAddress } from '../src/config.js'
import { getWalletStatus } from '../src/prove-on-chain.js'

async function main() {
  assertMidnightEnv(false)

  const status = await getWalletStatus(MIDNIGHT_CONFIG.walletMnemonic)
  console.log('[MIDNIGHT] Server wallet status')
  console.log(`  Network:  ${MIDNIGHT_CONFIG.network}`)
  console.log(`  Address:  ${status.address}`)
  console.log(`  tNIGHT:   ${status.tNight}`)
  console.log(`  tDUST:    ${status.tDust}`)
  console.log(`  Synced:   ${status.isSynced}`)

  try {
    const contract = resolveContractAddress()
    console.log(`  Contract: ${contract}`)
  } catch {
    console.log('  Contract: (not deployed — run npm run midnight:deploy)')
  }
}

main().catch((err) => {
  console.error('[MIDNIGHT] Status check failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
