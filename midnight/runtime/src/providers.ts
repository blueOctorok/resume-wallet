import * as Rx from 'rxjs'
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider'
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider'
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider'
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider'
import {
  createLedger9MidnightProvider,
  createLedger9WalletProvider,
} from '@midnight-ntwrk/midnight-js-types'
import { WatchTimeoutError } from '@midnight-ntwrk/midnight-js-types/errors'
import { Transaction } from '@midnightntwrk/ledger-v9'

import { MIDNIGHT_CONFIG, ZK_CONFIG_PATH } from './config.js'
import {
  MIDNIGHT_CIRCUIT_CONFIGS,
  type MidnightShippedFactType,
} from './contract-registry.js'
import type { MidnightWalletContext } from './wallet.js'

// Lifetime of the intents Midnight.js builds, the same hour 4.x had fixed.
// Midnight.js 5 also hands this to `balanceTx`, so the wallet's fee intent
// now gets the hour too (it used to fall back to 30 minutes).
const TX_TTL_SECONDS = 60 * 60

// The node reports a transaction finalized about 20 seconds after it is sent.
// Past this long without that report, the indexer is asked instead.
const NODE_QUIET_MS = 45 * 1000
// How long the indexer is then given to show the transaction.
const INDEXER_CHECK_MS = 2 * 60 * 1000

let nodeStoppedAnswering = false

/**
 * True once a sent transaction is on neither the node's report nor the
 * indexer. The node connections are made when the process starts and do not
 * always recover from a Blockfrost outage, so the worker saves the wallet and
 * restarts when it sees this.
 */
export function hasNodeStoppedAnswering(): boolean {
  return nodeStoppedAnswering
}

// One line per step of a prove, so a prove that stops answering shows where.
function logStep(message: string): void {
  console.error(`[MIDNIGHT] ${message}`)
}

export async function createMidnightProviders(
  walletCtx: MidnightWalletContext,
  factType: MidnightShippedFactType = 'mvr_clean_36_months',
) {
  const privateStatePassword = MIDNIGHT_CONFIG.privateStatePassword
  if (!privateStatePassword) {
    throw new Error('MIDNIGHT_PRIVATE_STATE_PASSWORD is required')
  }

  const cfg = MIDNIGHT_CIRCUIT_CONFIGS[factType]
  // Each circuit has its own compiled keys/ — must not always use mvr-clean-36.
  const zkConfigPath = cfg?.managedDir ?? ZK_CONFIG_PATH

  // Only the shielded public keys are read here. The facade's
  // `waitForSyncedState()` would also block on the full shielded catch-up,
  // and the caller has already waited for dust and unshielded.
  const shielded = await Rx.firstValueFrom(walletCtx.wallet.shielded.state)
  const accountId = walletCtx.unshieldedKeystore.getBech32Address().asString()
  const { wallet } = walletCtx

  // Midnight.js and the wallet each load their own ledger objects, so a
  // transaction crosses between them as bytes: `tx.serialize()` in, and the
  // wallet's own handle (which Midnight.js reads back through `serialize()`) out.
  const walletProvider = createLedger9WalletProvider({
    getCoinPublicKey: () => shielded.coinPublicKey.toHexString(),
    getEncryptionPublicKey: () => shielded.encryptionPublicKey.toHexString(),
    async balanceTx(tx, ttl) {
      logStep('Contract proof done. Adding the DUST fee')
      const recipe = await wallet.balanceUnboundTransaction(
        wallet.adoptTransaction(tx.serialize(), 'Unbound'),
        { ttl: ttl ?? new Date(Date.now() + TX_TTL_SECONDS * 1000) },
      )
      const signedRecipe = await wallet.signRecipe(recipe, walletCtx.unshieldedKeystore.signDataAsync)
      return wallet.finalizeRecipe(signedRecipe)
    },
  })

  const publicDataProvider = indexerPublicDataProvider(
    MIDNIGHT_CONFIG.indexer,
    MIDNIGHT_CONFIG.indexerWs,
  )

  // Submits through the wallet's relay, which is the public node.
  const midnightProvider = createLedger9MidnightProvider(async (tx) => {
    logStep('Fee added. Sending the transaction to the node')
    const finalized = wallet.adoptTransaction(tx.serialize(), 'Finalized')
    // The same id the wallet hands back once the node reports the transaction.
    const txId = tx.deserialize({ v9: Transaction }).identifiers().at(-1)
    if (!txId) throw new Error('The transaction has no identifier')

    // The SDK waits for the node's "finalized" report without a time limit.
    // On 2026-11-16 a transaction was on chain 5 seconds after it was sent and
    // that report never came. The indexer is the second witness: if it shows
    // the transaction, it landed, whatever the node did or did not say.
    let quietTimer: NodeJS.Timeout | undefined
    const seenByIndexer = new Promise<'indexer'>((resolve, reject) => {
      quietTimer = setTimeout(() => {
        logStep('The node has not answered. Asking the indexer whether the transaction landed')
        publicDataProvider
          .watchForTxData(txId, { maxWaitMs: INDEXER_CHECK_MS })
          .then(() => resolve('indexer'), reject)
      }, NODE_QUIET_MS)
    })
    try {
      const answeredBy = await Promise.race([
        wallet.submitTransaction(finalized).then(() => 'node' as const),
        seenByIndexer,
      ])
      logStep(
        answeredBy === 'node'
          ? 'Node finalized the transaction. Waiting for the indexer to show it'
          : 'The indexer shows the transaction on chain. The node never reported it',
      )
      return txId
    } catch (err) {
      if (err instanceof WatchTimeoutError) {
        nodeStoppedAnswering = true
        // Without this the fee's DUST stays set aside for the ledger's
        // three-hour grace period, and the wallet has nothing to pay with.
        await wallet.revert(finalized)
        logStep('The transaction is on neither the node nor the indexer. Its DUST is back in the wallet')
      }
      throw err
    } finally {
      clearTimeout(quietTimer)
    }
  })

  // 'require-if-present': the deployed circuits were compiled with compactc
  // 0.31, which writes no manifest to check the keys against.
  const zkConfigProvider = new NodeZkConfigProvider(zkConfigPath, {
    verify: 'require-if-present',
  })

  return {
    privateStateProvider: levelPrivateStateProvider({
      // Separate LevelDB per circuit so private state never cross-contaminates.
      privateStateStoreName: `storm-${cfg.contractName}-state`,
      accountId,
      privateStoragePasswordProvider: () => privateStatePassword,
    }),
    publicDataProvider,
    zkConfigProvider,
    proofProvider: httpClientProofProvider(
      MIDNIGHT_CONFIG.proofServer,
      zkConfigProvider,
      MIDNIGHT_CONFIG.proofServerAuthorization
        ? { headers: { Authorization: MIDNIGHT_CONFIG.proofServerAuthorization } }
        : undefined,
    ),
    walletProvider,
    midnightProvider,
    config: { networkId: MIDNIGHT_CONFIG.network, ttlSeconds: TX_TTL_SECONDS },
  }
}

export type MidnightProviders = Awaited<ReturnType<typeof createMidnightProviders>>
