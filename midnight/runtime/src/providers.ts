import * as Rx from 'rxjs'
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider'
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider'
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider'
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider'
import {
  createLedger9MidnightProvider,
  createLedger9WalletProvider,
} from '@midnight-ntwrk/midnight-js-types'

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
      const recipe = await wallet.balanceUnboundTransaction(
        wallet.adoptTransaction(tx.serialize(), 'Unbound'),
        { ttl: ttl ?? new Date(Date.now() + TX_TTL_SECONDS * 1000) },
      )
      const signedRecipe = await wallet.signRecipe(recipe, walletCtx.unshieldedKeystore.signDataAsync)
      return wallet.finalizeRecipe(signedRecipe)
    },
  })

  // Submits through the wallet's relay, which is the public node.
  const midnightProvider = createLedger9MidnightProvider((tx) =>
    wallet.submitTransaction(wallet.adoptTransaction(tx.serialize(), 'Finalized')),
  )

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
    publicDataProvider: indexerPublicDataProvider(
      MIDNIGHT_CONFIG.indexer,
      MIDNIGHT_CONFIG.indexerWs,
    ),
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
