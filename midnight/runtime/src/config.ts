// MUST be first: installs Node 22 Iterator Helpers on Node 20 before any
// wallet-SDK code runs. config.ts is imported by every script, so this single
// import guarantees the polyfill is in place before transaction balancing.
import './iterator-helpers.js'
import { config } from 'dotenv'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  installProofServerAuthFetch,
  resolveProofServerEndpoint,
} from './proof-server-url.js'

const runtimeDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(runtimeDir, '../../..')

// Load Storm .env.local from repo root (gitignored).
config({ path: path.join(repoRoot, '.env.local') })

export const REPO_ROOT = repoRoot

const rawIndexer =
  process.env.MIDNIGHT_INDEXER_URL?.trim() ||
  'https://indexer.preprod.midnight.network/api/v4/graphql'
const rawIndexerWs =
  process.env.MIDNIGHT_INDEXER_WS_URL?.trim() ||
  'wss://indexer.preprod.midnight.network/api/v4/graphql/ws'

const proofServerEndpoint = resolveProofServerEndpoint({
  url: process.env.MIDNIGHT_PROOF_SERVER_URL?.trim() || 'http://127.0.0.1:6300',
  user: process.env.MIDNIGHT_PROOF_SERVER_USER?.trim(),
  password: process.env.MIDNIGHT_PROOF_SERVER_PASSWORD?.trim(),
})
// undici rejects userinfo in URLs — install Authorization injection before
// WalletFacade / Effect HttpClient touch the proof server.
installProofServerAuthFetch(proofServerEndpoint)

export const MIDNIGHT_CONFIG = {
  network: process.env.MIDNIGHT_NETWORK?.trim() || 'preprod',
  /** Clean origin (no user:pass) — safe for undici + cross-fetch. */
  proofServer: proofServerEndpoint.url,
  /** Basic auth when password set (separate env or legacy user:pass@host URL). */
  proofServerAuthorization: proofServerEndpoint.authorization,
  nodeRpc:
    process.env.MIDNIGHT_NODE_RPC_URL?.trim() ||
    'https://rpc.preprod.midnight.network',
  indexer: rawIndexer,
  indexerWs: rawIndexerWs,
  contractAddress: process.env.MIDNIGHT_CONTRACT_ADDRESS?.trim() || '',
  privateStatePassword: process.env.MIDNIGHT_PRIVATE_STATE_PASSWORD?.trim() || '',
  walletMnemonic: process.env.MIDNIGHT_WALLET_MNEMONIC?.trim() || '',
} as const

// Compiled artifact lives INSIDE the runtime package (not the source dir under
// compact/). This is load-bearing: the compiled contract imports
// @midnight-ntwrk/compact-runtime, and it must resolve to the SAME node_modules
// (and therefore the same WASM instance) as compact-js. A symlinked artifact dir
// resolves to a second WASM copy and breaks deploy with "expected instance of
// ContractMaintenanceAuthority". Source .compact stays in compact/mvr-clean-36/.
export const ZK_CONFIG_PATH = path.join(
  runtimeDir,
  '..',
  'managed',
  'mvr-clean-36',
)

export const DEPLOYMENT_JSON_PATH = path.join(repoRoot, 'midnight/deployment.json')

export function assertMidnightEnv(requirePrivateStatePassword = true): void {
  if (!MIDNIGHT_CONFIG.walletMnemonic) {
    throw new Error('MIDNIGHT_WALLET_MNEMONIC is not set in .env.local')
  }
  if (requirePrivateStatePassword && !MIDNIGHT_CONFIG.privateStatePassword) {
    throw new Error(
      'MIDNIGHT_PRIVATE_STATE_PASSWORD is not set in .env.local (encrypts local contract private state)',
    )
  }
}

export function resolveContractAddress(): string {
  if (MIDNIGHT_CONFIG.contractAddress) return MIDNIGHT_CONFIG.contractAddress

  if (fs.existsSync(DEPLOYMENT_JSON_PATH)) {
    const raw = JSON.parse(fs.readFileSync(DEPLOYMENT_JSON_PATH, 'utf8')) as {
      contractAddress?: string
    }
    if (raw.contractAddress?.trim()) return raw.contractAddress.trim()
  }

  throw new Error(
    'MIDNIGHT_CONTRACT_ADDRESS is not set — run npm run midnight:deploy first',
  )
}
