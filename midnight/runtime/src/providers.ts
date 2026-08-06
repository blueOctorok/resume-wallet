import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider'
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider'
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider'
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider'
import type { FinalizedTransaction } from '@midnight-ntwrk/ledger-v8'

import { MIDNIGHT_CONFIG, ZK_CONFIG_PATH } from './config.js'
import {
  MIDNIGHT_CIRCUIT_CONFIGS,
  type MidnightShippedFactType,
} from './contract-registry.js'
import type { MidnightWalletContext } from './wallet.js'

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

  const state = await walletCtx.wallet.waitForSyncedState()
  const accountId = walletCtx.unshieldedKeystore.getBech32Address().asString()

  const walletProvider = {
    getCoinPublicKey: () => state.shielded.coinPublicKey.toHexString(),
    getEncryptionPublicKey: () => state.shielded.encryptionPublicKey.toHexString(),
    async balanceTx(tx: unknown, ttl?: Date) {
      const recipe = await walletCtx.wallet.balanceUnboundTransaction(
        tx as Parameters<MidnightWalletContext['wallet']['balanceUnboundTransaction']>[0],
        {
          shieldedSecretKeys: walletCtx.shieldedSecretKeys,
          dustSecretKey: walletCtx.dustSecretKey,
        },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
      )

      const signedRecipe = await walletCtx.wallet.signRecipe(recipe, (payload) =>
        walletCtx.unshieldedKeystore.signData(payload),
      )

      return walletCtx.wallet.finalizeRecipe(signedRecipe)
    },
    submitTx: (tx: FinalizedTransaction) => walletCtx.wallet.submitTransaction(tx),
  }

  const zkConfigProvider = new NodeZkConfigProvider(zkConfigPath)

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
    ),
    walletProvider,
    midnightProvider: walletProvider,
  }
}

export type MidnightProviders = Awaited<ReturnType<typeof createMidnightProviders>>
