#!/usr/bin/env npx tsx
/**
 * Deploy Midnight fact circuits to whatever MIDNIGHT_NETWORK is set to.
 *
 * Usage:
 *   npm run midnight:deploy                          # all shipped circuits
 *   npm run midnight:deploy -- --fact cdl_class_a    # one circuit
 */
import fs from 'node:fs'
import { assertMidnightEnv, DEPLOYMENT_JSON_PATH, MIDNIGHT_CONFIG } from '../src/config.js'
import { deployMidnightContract } from '../src/prove-on-chain.js'
import { mnemonicToHexSeed } from '../src/mnemonic-seed.js'
import {
  assertCircuitCompiled,
  MIDNIGHT_CIRCUIT_CONFIGS,
  type MidnightShippedFactType,
} from '../src/contract-registry.js'

const ALL_FACTS = Object.keys(MIDNIGHT_CIRCUIT_CONFIGS) as MidnightShippedFactType[]

function parseFacts(argv: string[]): MidnightShippedFactType[] {
  const facts: MidnightShippedFactType[] = []
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--fact' && argv[i + 1]) {
      const fact = argv[++i] as MidnightShippedFactType
      if (!MIDNIGHT_CIRCUIT_CONFIGS[fact]) {
        throw new Error(`Unknown --fact ${fact}. Options: ${ALL_FACTS.join(', ')}`)
      }
      facts.push(fact)
      continue
    }
    // Bare fact ids (npm sometimes strips repeated --fact flags)
    if (MIDNIGHT_CIRCUIT_CONFIGS[arg as MidnightShippedFactType]) {
      facts.push(arg as MidnightShippedFactType)
    }
  }
  return facts.length > 0 ? facts : ALL_FACTS
}

interface DeploymentJson {
  contractAddress?: string
  network: string
  deployedAt: string
  hexSeed: string
  contracts: Partial<Record<MidnightShippedFactType, string>>
}

async function main() {
  assertMidnightEnv()
  const facts = parseFacts(process.argv.slice(2))

  for (const fact of facts) {
    assertCircuitCompiled(fact)
  }

  let existing: Partial<DeploymentJson> = {}
  if (fs.existsSync(DEPLOYMENT_JSON_PATH)) {
    existing = JSON.parse(fs.readFileSync(DEPLOYMENT_JSON_PATH, 'utf8')) as DeploymentJson
  }

  const contracts: Partial<Record<MidnightShippedFactType, string>> = {
    ...(existing.contracts ?? {}),
  }
  // Preserve legacy single-address field if present
  if (existing.contractAddress && !contracts.mvr_clean_36_months) {
    contracts.mvr_clean_36_months = existing.contractAddress
  }

  const envLines: string[] = []

  for (const fact of facts) {
    const cfg = MIDNIGHT_CIRCUIT_CONFIGS[fact]
    console.log(
      `[MIDNIGHT] Deploying ${cfg.contractName} (${fact}) to ${MIDNIGHT_CONFIG.network}...`,
    )
    try {
      const { contractAddress } = await deployMidnightContract(
        fact,
        MIDNIGHT_CONFIG.walletMnemonic,
      )
      contracts[fact] = contractAddress
      envLines.push(`${cfg.envVar}=${contractAddress}`)
      console.log(`[MIDNIGHT] ${fact} → ${contractAddress}`)

      // Persist after each success so a later fact failure doesn't lose addresses.
      const partial: DeploymentJson = {
        contractAddress: contracts.mvr_clean_36_months ?? existing.contractAddress,
        network: MIDNIGHT_CONFIG.network,
        deployedAt: new Date().toISOString(),
        hexSeed: mnemonicToHexSeed(MIDNIGHT_CONFIG.walletMnemonic),
        contracts,
      }
      fs.writeFileSync(DEPLOYMENT_JSON_PATH, JSON.stringify(partial, null, 2))
    } catch (err) {
      console.error(
        `[MIDNIGHT] Deploy failed for ${fact}:`,
        err instanceof Error ? err.message : err,
      )
      throw err
    }
  }

  console.log('')
  console.log('[MIDNIGHT] Deployment saved:', DEPLOYMENT_JSON_PATH)
  console.log('Add/update in .env.local:')
  for (const line of envLines) console.log(`  ${line}`)
}

main().catch((err) => {
  console.error('[MIDNIGHT] Deploy failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
