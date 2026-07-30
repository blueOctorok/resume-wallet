import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { MIDNIGHT_CONFIG, DEPLOYMENT_JSON_PATH } from './config.js'

const runtimeDir = path.dirname(fileURLToPath(import.meta.url))

export type MidnightShippedFactType =
  | 'mvr_clean_36_months'
  | 'cdl_class_a'
  | 'previous_employer_verified'

export interface MidnightCircuitConfig {
  factType: MidnightShippedFactType
  contractName: string
  managedDir: string
  envVar: string
  deploymentKey: string
  callMethod:
    | 'proveCleanMvr'
    | 'proveCdlClassA'
    | 'provePreviousEmployerVerified'
}

export const MIDNIGHT_CIRCUIT_CONFIGS: Record<MidnightShippedFactType, MidnightCircuitConfig> = {
  mvr_clean_36_months: {
    factType: 'mvr_clean_36_months',
    contractName: 'mvr-clean-36',
    managedDir: path.join(runtimeDir, '..', 'managed', 'mvr-clean-36'),
    envVar: 'MIDNIGHT_CONTRACT_ADDRESS',
    deploymentKey: 'mvr_clean_36_months',
    callMethod: 'proveCleanMvr',
  },
  cdl_class_a: {
    factType: 'cdl_class_a',
    contractName: 'cdl-class-a',
    managedDir: path.join(runtimeDir, '..', 'managed', 'cdl-class-a'),
    envVar: 'MIDNIGHT_CONTRACT_ADDRESS_CDL_CLASS_A',
    deploymentKey: 'cdl_class_a',
    callMethod: 'proveCdlClassA',
  },
  previous_employer_verified: {
    factType: 'previous_employer_verified',
    contractName: 'previous-employer-verified',
    managedDir: path.join(runtimeDir, '..', 'managed', 'previous-employer-verified'),
    envVar: 'MIDNIGHT_CONTRACT_ADDRESS_PREVIOUS_EMPLOYER',
    deploymentKey: 'previous_employer_verified',
    callMethod: 'provePreviousEmployerVerified',
  },
}

interface DeploymentJson {
  contractAddress?: string
  contracts?: Partial<Record<MidnightShippedFactType, string>>
}

export function resolveContractAddressForFact(factType: MidnightShippedFactType): string {
  const cfg = MIDNIGHT_CIRCUIT_CONFIGS[factType]
  const fromEnv = process.env[cfg.envVar]?.trim()
  if (fromEnv) return fromEnv

  if (fs.existsSync(DEPLOYMENT_JSON_PATH)) {
    const raw = JSON.parse(fs.readFileSync(DEPLOYMENT_JSON_PATH, 'utf8')) as DeploymentJson
    const fromMap = raw.contracts?.[factType]?.trim()
    if (fromMap) return fromMap
    // Backward compat — legacy single-address deployment is the MVR contract.
    if (factType === 'mvr_clean_36_months' && raw.contractAddress?.trim()) {
      return raw.contractAddress.trim()
    }
  }

  if (factType === 'mvr_clean_36_months' && MIDNIGHT_CONFIG.contractAddress) {
    return MIDNIGHT_CONFIG.contractAddress
  }

  throw new Error(
    `${cfg.envVar} is not set — deploy ${cfg.contractName} and add the address to .env.local or midnight/deployment.json`,
  )
}

export function assertCircuitCompiled(factType: MidnightShippedFactType): void {
  const cfg = MIDNIGHT_CIRCUIT_CONFIGS[factType]
  const contractJs = path.join(cfg.managedDir, 'contract', 'index.js')
  if (!fs.existsSync(contractJs)) {
    throw new Error(
      `Compact contract not compiled for ${factType} — run: npm run midnight:compile`,
    )
  }
}
