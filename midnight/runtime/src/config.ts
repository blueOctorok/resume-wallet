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

const SUPPORTED_NETWORKS = ['preprod', 'preview', 'mainnet'] as const
type MidnightNetwork = (typeof SUPPORTED_NETWORKS)[number]

function resolveNetwork(): MidnightNetwork {
  const raw = (process.env.MIDNIGHT_NETWORK?.trim() || 'preprod').toLowerCase()
  if ((SUPPORTED_NETWORKS as readonly string[]).includes(raw)) {
    return raw as MidnightNetwork
  }
  throw new Error(
    `MIDNIGHT_NETWORK=${raw} is not supported (use preprod | preview | mainnet)`,
  )
}

export const MIDNIGHT_CONFIG = {
  network: resolveNetwork(),
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

// Don't let a leftover preprod RPC ride along after flipping MIDNIGHT_NETWORK.
if (
  MIDNIGHT_CONFIG.network === 'mainnet' &&
  (MIDNIGHT_CONFIG.nodeRpc.includes('preprod') ||
    MIDNIGHT_CONFIG.indexer.includes('preprod'))
) {
  throw new Error(
    'MIDNIGHT_NETWORK=mainnet but RPC/indexer still point at Preprod — flip MIDNIGHT_NODE_RPC_URL and MIDNIGHT_INDEXER_* first',
  )
}

// Compiled artifact lives INSIDE the runtime package (not the source dir under
// compact/). This is load-bearing: the compiled contract imports
// @midnight-ntwrk/compact-runtime, which managed/node_modules links to the
// ledger 8 copy (0.16.0, see scripts/link-ledger8-runtime.mjs). That copy and
// Midnight.js must load the SAME onchain-runtime-v3 WASM instance. A second
// copy makes one side reject the other's objects ("expected instance of ...").
// Source .compact stays in compact/mvr-clean-36/.
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
      network?: string
    }
    // Preprod addresses in this file must not be used after a mainnet flip.
    if (raw.network && raw.network !== MIDNIGHT_CONFIG.network) {
      raw.contractAddress = undefined
    }
    if (raw.contractAddress?.trim()) return raw.contractAddress.trim()
  }

  throw new Error(
    'MIDNIGHT_CONTRACT_ADDRESS is not set — run npm run midnight:deploy first',
  )
}
