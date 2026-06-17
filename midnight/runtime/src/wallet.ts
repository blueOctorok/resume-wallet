import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { WebSocket } from 'ws'
import { Buffer } from 'buffer'

import type { Contract as CompactContract } from '@midnight-ntwrk/compact-js'
import { CompiledContract } from '@midnight-ntwrk/compact-js'
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id'
import * as ledger from '@midnight-ntwrk/ledger-v8'
import { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade'
import { DustWallet } from '@midnight-ntwrk/wallet-sdk-dust-wallet'
import { HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk-hd'
import { ShieldedWallet } from '@midnight-ntwrk/wallet-sdk-shielded'
import {
  createKeystore,
  PublicKey,
  UnshieldedWallet,
} from '@midnight-ntwrk/wallet-sdk-unshielded-wallet'
import { InMemoryTransactionHistoryStorage } from '@midnight-ntwrk/wallet-sdk-abstractions'

import { MIDNIGHT_CONFIG, ZK_CONFIG_PATH } from './config.js'

function toRelayUrl(nodeRpc: string): URL {
  if (nodeRpc.startsWith('https://')) {
    return new URL(nodeRpc.replace(/^https:\/\//, 'wss://'))
  }
  if (nodeRpc.startsWith('http://')) {
    return new URL(nodeRpc.replace(/^http:\/\//, 'ws://'))
  }
  return new URL(nodeRpc)
}

// @ts-expect-error SDK expects WebSocket on global in Node
globalThis.WebSocket = WebSocket

setNetworkId(MIDNIGHT_CONFIG.network as 'preprod')

const CONTRACT_NAME = 'mvr-clean-36'

const walletDir = path.dirname(fileURLToPath(import.meta.url))

// Persisted wallet sync state lives here (gitignored). Restoring it on the next
// run makes the wallet resume from the saved block height instead of re-scanning
// the whole chain — turning a multi-minute cold sync into a quick incremental one.
// Keyed by network so preprod/testnet caches never collide. Contains wallet
// financial state, so it must never be committed.
const WALLET_CACHE_DIR = path.join(walletDir, '..', '.wallet-cache')
const WALLET_CACHE_PATH = path.join(
  WALLET_CACHE_DIR,
  `${MIDNIGHT_CONFIG.network}.json`,
)

interface SerializedWalletState {
  network: string
  shielded: string
  unshielded: string
  dust: string
  savedAt: string
}

function loadWalletState(): Omit<SerializedWalletState, 'network' | 'savedAt'> | null {
  try {
    if (!fs.existsSync(WALLET_CACHE_PATH)) return null
    const raw = JSON.parse(
      fs.readFileSync(WALLET_CACHE_PATH, 'utf8'),
    ) as Partial<SerializedWalletState>
    // Ignore a cache from a different network or an older/garbled schema.
    if (raw.network !== MIDNIGHT_CONFIG.network) return null
    if (
      typeof raw.shielded === 'string' &&
      typeof raw.unshielded === 'string' &&
      typeof raw.dust === 'string'
    ) {
      return { shielded: raw.shielded, unshielded: raw.unshielded, dust: raw.dust }
    }
    return null
  } catch {
    return null
  }
}

function clearWalletState(): void {
  try {
    fs.rmSync(WALLET_CACHE_PATH, { force: true })
  } catch {
    // best-effort
  }
}

let compiledContractPromise: Promise<ReturnType<typeof buildCompiledContract>> | null =
  null

function buildCompiledContract(module: {
  Contract: new (witnesses: Record<string, never>) => CompactContract
}) {
  const ContractCtor = module.Contract as unknown as new (
    witnesses: Record<string, never>,
  ) => CompactContract

  return CompiledContract.make(CONTRACT_NAME, ContractCtor).pipe(
    CompiledContract.withVacantWitnesses,
    CompiledContract.withCompiledFileAssets(ZK_CONFIG_PATH),
  )
}

export async function loadCompiledContract() {
  if (!compiledContractPromise) {
    compiledContractPromise = (async () => {
      const contractPath = path.join(ZK_CONFIG_PATH, 'contract', 'index.js')
      if (!fs.existsSync(contractPath)) {
        throw new Error(
          'Compact contract not compiled — run: npm run midnight:compile',
        )
      }

      const module = (await import(pathToFileURL(contractPath).href)) as {
        Contract: new (witnesses: Record<string, never>) => CompactContract
        ledger: (state: unknown) => { factCommitment: string }
      }
      return {
        module,
        compiledContract: buildCompiledContract(module),
      }
    })()
  }
  return compiledContractPromise
}

export function deriveKeysFromSeed(seed: Buffer) {
  const hdWallet = HDWallet.fromSeed(seed)
  if (hdWallet.type !== 'seedOk') throw new Error('Invalid wallet seed')

  const result = hdWallet.hdWallet
    .selectAccount(0)
    .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
    .deriveKeysAt(0)

  if (result.type !== 'keysDerived') throw new Error('Key derivation failed')

  hdWallet.hdWallet.clear()
  return result.keys
}

export async function createMidnightWallet(seed: Buffer) {
  const keys = deriveKeysFromSeed(seed)
  const networkId = MIDNIGHT_CONFIG.network

  const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(keys[Roles.Zswap])
  const dustSecretKey = ledger.DustSecretKey.fromSeed(keys[Roles.Dust])
  const unshieldedKeystore = createKeystore(keys[Roles.NightExternal], networkId)

  const walletConfig = {
    networkId,
    indexerClientConnection: {
      indexerHttpUrl: MIDNIGHT_CONFIG.indexer,
      indexerWsUrl: MIDNIGHT_CONFIG.indexerWs,
    },
    provingServerUrl: new URL(MIDNIGHT_CONFIG.proofServer),
    relayURL: toRelayUrl(MIDNIGHT_CONFIG.nodeRpc),
    txHistoryStorage: new InMemoryTransactionHistoryStorage(),
    costParameters: {
      additionalFeeOverhead: 300_000_000_000_000n,
      feeBlocksMargin: 5,
    },
    // Preprod DUST sync WASM OOM workaround (servicedesk#42) — default batch size 10 fails on DustSpendProcessed.
    batchUpdates: { size: 5000 },
  }

  const saved = loadWalletState()
  // When a cache exists we restore from it; on any restore failure (SDK upgrade,
  // Preprod reset, corrupt file) we fall back to a cold sync. `useSaved` is read
  // inside the initializers at call time, so flipping it before the retry forces
  // the cold path without rebuilding the init object.
  let useSaved = saved !== null

  // Inline the init object inside an arrow so it keeps the SDK's contextual typing
  // for `config` (extracting to a const would erase it and make `config` `any`).
  const initWallet = () =>
    WalletFacade.init({
      configuration: walletConfig,
      shielded: async (config) =>
        useSaved && saved
          ? ShieldedWallet(config).restore(saved.shielded)
          : ShieldedWallet(config).startWithSecretKeys(shieldedSecretKeys),
      unshielded: async (config) =>
        useSaved && saved
          ? UnshieldedWallet(config).restore(saved.unshielded)
          : UnshieldedWallet(config).startWithPublicKey(
              PublicKey.fromKeyStore(unshieldedKeystore),
            ),
      dust: async (config) =>
        useSaved && saved
          ? DustWallet(config).restore(saved.dust)
          : DustWallet(config).startWithSecretKey(
              dustSecretKey,
              ledger.LedgerParameters.initialParameters().dust,
            ),
    })

  let wallet: WalletFacade
  try {
    wallet = await initWallet()
    await wallet.start(shieldedSecretKeys, dustSecretKey)
  } catch (err) {
    if (!useSaved) throw err
    // Saved state was unusable — discard it and do a clean full sync.
    console.error(
      `[MIDNIGHT] Wallet cache restore failed, doing a full sync: ${
        err instanceof Error ? err.message : String(err)
      }`,
    )
    useSaved = false
    clearWalletState()
    wallet = await initWallet()
    await wallet.start(shieldedSecretKeys, dustSecretKey)
  }

  return { wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore }
}

/**
 * Serialize the wallet's synced state to disk so the next run can restore() it
 * and skip the full chain re-scan. Best-effort: a cache write must never break a
 * prove/deploy flow, so all errors are swallowed (worst case: next run cold-syncs).
 */
export async function saveWalletState(ctx: MidnightWalletContext): Promise<void> {
  try {
    const [shielded, unshielded, dust] = await Promise.all([
      ctx.wallet.shielded.serializeState(),
      ctx.wallet.unshielded.serializeState(),
      ctx.wallet.dust.serializeState(),
    ])
    const payload: SerializedWalletState = {
      network: MIDNIGHT_CONFIG.network,
      shielded,
      unshielded,
      dust,
      savedAt: new Date().toISOString(),
    }
    fs.mkdirSync(WALLET_CACHE_DIR, { recursive: true })
    fs.writeFileSync(WALLET_CACHE_PATH, JSON.stringify(payload))
  } catch (err) {
    console.error(
      `[MIDNIGHT] Could not save wallet cache: ${
        err instanceof Error ? err.message : String(err)
      }`,
    )
  }
}

export type MidnightWalletContext = Awaited<ReturnType<typeof createMidnightWallet>>

export function assertContractCompiled(): void {
  const contractJs = path.join(ZK_CONFIG_PATH, 'contract', 'index.js')
  if (!fs.existsSync(contractJs)) {
    throw new Error(
      'Compact contract not compiled — run: npm run midnight:compile',
    )
  }
}
