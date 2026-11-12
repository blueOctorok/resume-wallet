import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Buffer } from 'buffer'

import {
  createKeystore,
  DustWallet,
  InMemoryTransactionHistoryStorage,
  mergeWalletEntries,
  PublicKey,
  ShieldedWallet,
  UnshieldedWallet,
  WalletEntrySchema,
  WalletFacade,
  WalletSeeds,
} from '@midnightntwrk/wallet-sdk'

import { MIDNIGHT_CONFIG, ZK_CONFIG_PATH } from './config.js'

export function toRelayUrl(nodeRpc: string): URL {
  if (nodeRpc.startsWith('https://')) {
    return new URL(nodeRpc.replace(/^https:\/\//, 'wss://'))
  }
  if (nodeRpc.startsWith('http://')) {
    return new URL(nodeRpc.replace(/^http:\/\//, 'ws://'))
  }
  return new URL(nodeRpc)
}

/** Incremental merkle restore dies if the cache is days behind the indexer. */
const MAX_WALLET_CACHE_AGE_MS = 14 * 24 * 60 * 60 * 1000

const walletDir = path.dirname(fileURLToPath(import.meta.url))

// Persisted wallet sync state (gitignored). Restoring it skips a full chain scan.
// A quiet week between MVRs must not throw the cache away. A bad restore still
// falls back to a full sync. Keyed by network. Never commit this file.
// The `-ledger9` name keeps this SDK away from the file the ledger 8 SDK wrote
// (`<network>.json`), which it could not restore. That older file is left alone.
const WALLET_CACHE_DIR = path.join(walletDir, '..', '.wallet-cache')
const WALLET_CACHE_PATH = path.join(
  WALLET_CACHE_DIR,
  `${MIDNIGHT_CONFIG.network}-ledger9.json`,
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
    const savedAtMs = raw.savedAt ? Date.parse(raw.savedAt) : NaN
    if (!Number.isFinite(savedAtMs) || Date.now() - savedAtMs > MAX_WALLET_CACHE_AGE_MS) {
      console.error(
        `[MIDNIGHT] Wallet cache is stale (${raw.savedAt ?? 'no savedAt'}) — cold-syncing on public RPC`,
      )
      return null
    }
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

export async function createMidnightWallet(seed: Buffer) {
  const networkId = MIDNIGHT_CONFIG.network
  // Account 0, index 0, roles Zswap / NightExternal / Dust: the same three
  // seeds the ledger 8 runtime derived by hand, so the addresses are unchanged.
  const seeds = WalletSeeds.fromMasterSeed(seed)
  const unshieldedKeystore = createKeystore(
    { kind: 'schnorr', secret: seeds.unshielded },
    networkId,
  )

  // `forks` is left out on purpose: the SDK default (protocol version 2000000)
  // is the version the ledger 9 release notes give for the hand-over.
  const walletConfig = {
    networkId,
    indexerClientConnection: {
      indexerHttpUrl: MIDNIGHT_CONFIG.indexer,
      indexerWsUrl: MIDNIGHT_CONFIG.indexerWs,
    },
    provingServerUrl: new URL(MIDNIGHT_CONFIG.proofServer),
    // Always the public node. Keyed Foundation RPC is submit-only — wiring it
    // here as relayURL reports tip height 0 and breaks merkle sync.
    relayURL: toRelayUrl(MIDNIGHT_CONFIG.nodeRpc),
    txHistoryStorage: new InMemoryTransactionHistoryStorage(WalletEntrySchema, mergeWalletEntries),
    costParameters: {
      additionalFeeOverhead: 300_000_000_000_000n,
      feeBlocksMargin: 5,
    },
    // Preprod DUST sync WASM OOM workaround (servicedesk#42) — default batch size 10 fails on DustSpendProcessed.
    batchUpdates: { size: 5000 },
    // The ledger 9 upgrade wiped DUST and the chain re-issued it as ledger 9
    // events. A wallet that reads the 1.6 million older dust events throws the
    // result away at the hand-over, so a cold start begins at the hand-over.
    // Only a fresh start uses this; a restore continues from its saved place.
    skipLedgerV8DustHistory: true,
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
          : ShieldedWallet(config).startWithSeed(seeds.shielded),
      unshielded: async (config) =>
        useSaved && saved
          ? UnshieldedWallet(config).restore(saved.unshielded)
          : UnshieldedWallet(config).startWithPublicKey(
              PublicKey.fromKeyStore(unshieldedKeystore),
            ),
      dust: async (config) =>
        useSaved && saved
          ? DustWallet(config).restore(saved.dust)
          : DustWallet(config).startWithSeed(seeds.dust),
    })

  let wallet: WalletFacade
  try {
    wallet = await initWallet()
    await wallet.start(seeds)
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
    await wallet.start(seeds)
  }

  return { wallet, unshieldedKeystore }
}

function serializeFailure(err: unknown): string {
  const lines: string[] = []
  const seen = new Set<unknown>()
  // The wasm error sits about eight levels down: ParseError → issue →
  // issues[] → issue → issue → issue → actual. Stopping early printed only
  // "ParseError" and hid the real reason for six days.
  const visit = (value: unknown, depth: number) => {
    if (!value || depth > 12 || seen.has(value) || typeof value !== 'object') return
    seen.add(value)
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1)
      return
    }
    const record = value as {
      message?: unknown
      actual?: unknown
      cause?: unknown
      issue?: unknown
      issues?: unknown
    }
    if (typeof record.message === 'string' && record.message.length < 400 && !record.message.includes('readonly')) {
      const name = value instanceof Error && value.name !== 'Error' ? `${value.name}: ` : ''
      lines.push(`${name}${record.message.replaceAll('\n', ' ')}`)
    }
    visit(record.actual, depth + 1)
    visit(record.cause, depth + 1)
    visit(record.issue, depth + 1)
    visit(record.issues, depth + 1)
  }
  visit(err, 0)
  if (lines.length === 0) return err instanceof Error ? err.name : String(err)
  return lines.join(' | ').slice(0, 500)
}

/**
 * Each reader is serialized on its own, so one reader that cannot serialize
 * does not block saving the other two. A failed part keeps the copy already
 * on disk. (The mainnet failures seen in November were the WASM memory filling
 * up, fixed by patches/effect+3.22.4.patch, not the size of the state.)
 */
async function serializeOrKeep(
  label: string,
  serialize: () => Promise<string>,
  previous: string | undefined,
): Promise<string | null> {
  try {
    return await serialize()
  } catch (err) {
    // The SDK wraps the wasm failure in a schema tree. The useful text is the
    // nested `actual` / `cause`, and the schema print is too large to keep.
    const reason = serializeFailure(err)
    if (previous) {
      console.error(`[MIDNIGHT] ${label} did not serialize, keeping the saved copy: ${reason}`)
      return previous
    }
    console.error(`[MIDNIGHT] ${label} did not serialize and there is no saved copy: ${reason}`)
    return null
  }
}

/**
 * Serialize the wallet's synced state to disk so the next run can restore() it
 * and skip the full chain re-scan. Best-effort: a cache write must never break a
 * prove/deploy flow, so all errors are swallowed (worst case: next run cold-syncs).
 */
export async function saveWalletState(ctx: MidnightWalletContext): Promise<void> {
  try {
    const previous = loadWalletState() ?? undefined
    const [shielded, unshielded, dust] = await Promise.all([
      serializeOrKeep('shielded', () => ctx.wallet.shielded.serializeState(), previous?.shielded),
      serializeOrKeep('unshielded', () => ctx.wallet.unshielded.serializeState(), previous?.unshielded),
      serializeOrKeep('dust', () => ctx.wallet.dust.serializeState(), previous?.dust),
    ])
    if (shielded === null || unshielded === null || dust === null) return
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
    console.error(`[MIDNIGHT] Could not save wallet cache: ${serializeFailure(err)}`)
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
