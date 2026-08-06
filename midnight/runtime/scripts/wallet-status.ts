#!/usr/bin/env npx tsx
import { assertMidnightEnv, MIDNIGHT_CONFIG, resolveContractAddress } from '../src/config.js'
import { getWalletStatus } from '../src/prove-on-chain.js'

async function main() {
  assertMidnightEnv(false)
  const asJson = process.argv.includes('--json')

  const status = await getWalletStatus(MIDNIGHT_CONFIG.walletMnemonic)

  let contract: string | null = null
  try {
    contract = resolveContractAddress()
  } catch {
    contract = null
  }

  if (asJson) {
    // Machine-readable — cost-benchmark parses this from stdout.
    process.stdout.write(
      JSON.stringify({
        address: status.address,
        tNight: status.tNight,
        tDust: status.tDust,
        isSynced: status.isSynced,
        network: MIDNIGHT_CONFIG.network,
        contract,
      }),
    )
    return
  }

  console.log('[MIDNIGHT] Server wallet status')
  console.log(`  Network:  ${MIDNIGHT_CONFIG.network}`)
  console.log(`  Address:  ${status.address}`)
  console.log(`  tNIGHT:   ${status.tNight}`)
  console.log(`  tDUST:    ${status.tDust}`)
  console.log(`  Synced:   ${status.isSynced}`)
  console.log(
    contract
      ? `  Contract: ${contract}`
      : '  Contract: (not deployed — run npm run midnight:deploy)',
  )
}

main().catch((err) => {
  console.error('[MIDNIGHT] Status check failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
