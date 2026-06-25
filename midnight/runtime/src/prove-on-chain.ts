import * as Rx from 'rxjs'
import type { FacadeState } from '@midnight-ntwrk/wallet-sdk-facade'
import { unshieldedToken } from '@midnight-ntwrk/ledger-v8'
import {
  deployContract,
  findDeployedContract,
} from '@midnight-ntwrk/midnight-js-contracts'

import { buildFactCommitment } from './fact-commitment.js'
import {
  loadCompiledContract,
  createMidnightWallet,
  saveWalletState,
  createEmptyMvrCleanWitness,
} from './wallet.js'
import { createMidnightProviders } from './providers.js'
import { mnemonicToSeedBuffer } from './mnemonic-seed.js'
import { MIDNIGHT_CONFIG, resolveContractAddress } from './config.js'
import {
  createMvrCleanCircuitWitness,
  type MvrCleanViolationSlot,
} from './mvr-clean-witness.js'

export interface OnChainProveInput {
  candidateUserId: string
  factType: string
  sourceCra: string
  sourcePullId: string
  disclosedFields: Record<string, unknown>
  /** P3.4-A — public window bounds (YYYYMMDD ints). */
  windowStartYmd: number
  windowEndYmd: number
  /** Fixed 32-slot violation witness for the predicate circuit. */
  violationSlots: MvrCleanViolationSlot[]
  mnemonic: string
}

export interface OnChainProveResult {
  txHash: string
  proofId: string
  commitment: string
  contractAddress: string
  predicateVersion: string
}

/**
 * Progress logging goes to STDERR on purpose: the prove CLI writes its JSON
 * result to STDOUT, and the bridge parses that stdout. Keeping diagnostics on
 * stderr lets us stream live progress without corrupting the machine-readable
 * output. (Standard Unix split: data → stdout, diagnostics → stderr.)
 */
function logProgress(message: string): void {
  console.error(`[MIDNIGHT] ${message}`)
}

/**
 * Returns an RxJS `tap` callback that logs incremental sync progress, de-duped so
 * we only print when the applied block index actually advances (the state stream
 * emits far more often than the chain tip moves). Progress lives on the shielded
 * sub-state's `.progress` — there is no `syncProgress` on the top-level state.
 */
function makeSyncProgressLogger(): (s: FacadeState) => void {
  let lastApplied = -1n
  return (s) => {
    const progress = s.shielded?.progress
    if (!progress || progress.appliedIndex === lastApplied) return
    lastApplied = progress.appliedIndex
    logProgress(
      `Sync progress: block ${progress.appliedIndex}/${progress.highestIndex}`,
    )
  }
}

export async function registerDustIfNeeded(
  walletCtx: Awaited<ReturnType<typeof createMidnightWallet>>,
): Promise<void> {
  logProgress('Syncing wallet (first run after a restart can take several minutes)...')
  const state = await Rx.firstValueFrom(
    walletCtx.wallet.state().pipe(
      Rx.tap(makeSyncProgressLogger()),
      Rx.filter((s) => s.isSynced),
    ),
  )
  logProgress('Wallet synced')

  // Single exit so we always persist the freshest synced checkpoint below.
  if (state.dust.balance(new Date()) <= 0n) {
    logProgress('No DUST balance — registering tNIGHT UTXOs for DUST generation...')

    const nightUtxos = state.unshielded.availableCoins.filter(
      (c: { meta?: { registeredForDustGeneration?: boolean } }) =>
        !c.meta?.registeredForDustGeneration,
    )

    if (nightUtxos.length === 0) {
      throw new Error('No unregistered tNIGHT UTXOs available for DUST registration')
    }

    const recipe = await walletCtx.wallet.registerNightUtxosForDustGeneration(
      nightUtxos,
      walletCtx.unshieldedKeystore.getPublicKey(),
      (payload) => walletCtx.unshieldedKeystore.signData(payload),
    )

    await walletCtx.wallet.submitTransaction(await walletCtx.wallet.finalizeRecipe(recipe))

    await Rx.firstValueFrom(
      walletCtx.wallet.state().pipe(
        Rx.throttleTime(5000),
        Rx.filter((s) => s.isSynced),
        Rx.filter((s) => s.dust.balance(new Date()) > 0n),
      ),
    )
  }

  // Cache the synced state so the next CLI run resumes incrementally.
  await saveWalletState(walletCtx)
}

export async function deployMvrCleanContract(mnemonic: string): Promise<{
  contractAddress: string
}> {
  const seed = mnemonicToSeedBuffer(mnemonic)
  const walletCtx = await createMidnightWallet(seed)

  try {
    await registerDustIfNeeded(walletCtx)

    const { compiledContract } = await loadCompiledContract(createEmptyMvrCleanWitness())
    const providers = await createMidnightProviders(walletCtx)

    const deployed = await deployContract(providers, {
      compiledContract,
      args: [],
    })

    const contractAddress = deployed.deployTxData.public.contractAddress
    return { contractAddress }
  } finally {
    await walletCtx.wallet.stop()
  }
}

export async function proveCleanMvrOnChain(
  input: OnChainProveInput,
): Promise<OnChainProveResult> {
  const commitment = buildFactCommitment(input)
  const seed = mnemonicToSeedBuffer(input.mnemonic)
  const contractAddress = resolveContractAddress()

  const witnesses = createMvrCleanCircuitWitness(input.violationSlots)
  const windowStart = BigInt(input.windowStartYmd)
  const windowEnd = BigInt(input.windowEndYmd)

  logProgress('Initializing wallet...')
  const walletCtx = await createMidnightWallet(seed)

  try {
    await registerDustIfNeeded(walletCtx)

    logProgress('Loading compiled contract + providers...')
    const { compiledContract } = await loadCompiledContract(witnesses)
    const providers = await createMidnightProviders(walletCtx)

    logProgress(`Locating deployed contract ${contractAddress.slice(0, 12)}...`)
    const contract = await findDeployedContract(providers, {
      contractAddress,
      compiledContract,
    })

    logProgress('Generating ZK predicate proof + submitting transaction (slow step)...')
    let tx
    try {
      tx = await contract.callTx.proveCleanMvr(windowStart, windowEnd, commitment)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const cause =
        err instanceof Error && err.cause instanceof Error ? err.cause.message : ''
      throw new Error(
        cause ? `proveCleanMvr failed: ${msg} — ${cause}` : `proveCleanMvr failed: ${msg}`,
        { cause: err instanceof Error ? err : undefined },
      )
    }
    const txHash = tx.public.txId
    const proofId = txHash
    logProgress(`Transaction submitted: ${txHash}`)

    return {
      txHash,
      proofId,
      commitment,
      contractAddress,
      predicateVersion: 'v1-any-violation-in-window',
    }
  } finally {
    await walletCtx.wallet.stop()
  }
}

export async function readOnChainCommitment(
  contractAddress: string,
  mnemonic: string,
): Promise<string | null> {
  const { module } = await loadCompiledContract(createEmptyMvrCleanWitness())
  const walletCtx = await createMidnightWallet(mnemonicToSeedBuffer(mnemonic))

  try {
    const providers = await createMidnightProviders(walletCtx)
    const state = await providers.publicDataProvider.queryContractState(contractAddress)
    if (!state) return null
    const ledgerState = module.ledger(state.data)
    return ledgerState.factCommitment || null
  } finally {
    await walletCtx.wallet.stop()
  }
}

export async function getWalletStatus(mnemonic: string) {
  const seed = mnemonicToSeedBuffer(mnemonic)
  const walletCtx = await createMidnightWallet(seed)
  const address = walletCtx.unshieldedKeystore.getBech32Address().asString()

  try {
    logProgress('Syncing wallet (first run can take several minutes)...')
    logProgress(`Unshielded address: ${address}`)

    const state = await Rx.firstValueFrom(
      walletCtx.wallet.state().pipe(
        Rx.tap(makeSyncProgressLogger()),
        Rx.filter((s) => s.isSynced),
      ),
    )
    // Cache the synced state so subsequent CLI runs resume incrementally.
    await saveWalletState(walletCtx)

    const tNight =
      state.unshielded.balances[unshieldedToken().raw] ?? 0n
    const tDust = state.dust.balance(new Date())

    return {
      address,
      tNight: tNight.toString(),
      tDust: tDust.toString(),
      isSynced: state.isSynced,
    }
  } finally {
    await walletCtx.wallet.stop()
  }
}
