#!/usr/bin/env npx tsx
import fs from 'node:fs'
import { assertMidnightEnv, DEPLOYMENT_JSON_PATH, MIDNIGHT_CONFIG } from '../src/config.js'
import { deployMvrCleanContract } from '../src/prove-on-chain.js'
import { mnemonicToHexSeed } from '../src/mnemonic-seed.js'
import { assertContractCompiled } from '../src/wallet.js'

async function main() {
  assertMidnightEnv()
  assertContractCompiled()

  console.log('[MIDNIGHT] Deploying mvr-clean-36 contract to Preprod...')
  const { contractAddress } = await deployMvrCleanContract(MIDNIGHT_CONFIG.walletMnemonic)

  const deployment = {
    contractAddress,
    network: MIDNIGHT_CONFIG.network,
    deployedAt: new Date().toISOString(),
    hexSeed: mnemonicToHexSeed(MIDNIGHT_CONFIG.walletMnemonic),
  }

  fs.writeFileSync(DEPLOYMENT_JSON_PATH, JSON.stringify(deployment, null, 2))

  console.log('[MIDNIGHT] Contract deployed')
  console.log(`  Address: ${contractAddress}`)
  console.log(`  Saved:   ${DEPLOYMENT_JSON_PATH}`)
  console.log('')
  console.log('Add to .env.local:')
  console.log(`  MIDNIGHT_CONTRACT_ADDRESS=${contractAddress}`)
}

main().catch((err) => {
  console.error('[MIDNIGHT] Deploy failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
