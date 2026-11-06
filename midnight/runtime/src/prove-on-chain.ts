import * as Rx from 'rxjs'
import type { FacadeState } from '@midnight-ntwrk/wallet-sdk-facade'
import { unshieldedToken } from '@midnight-ntwrk/ledger-v8'
import {
  deployContract,
  findDeployedContract,
} from '@midnight-ntwrk/midnight-js-contracts'
import type { Contract as CompactContract } from '@midnight-ntwrk/compact-js'
import { CompiledContract } from '@midnight-ntwrk/compact-js'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

import { buildFactCommitment } from './fact-commitment.js'
import { buildPullNullifier } from './pull-nullifier.js'
import {
  MIDNIGHT_CIRCUIT_CONFIGS,
  resolveContractAddressForFact,
  type MidnightShippedFactType,
} from './contract-registry.js'
import {
  createMidnightWallet,
  saveWalletState,
  type MidnightWalletContext,
} from './wallet.js'
import { createMidnightProviders } from './providers.js'
import { MIDNIGHT_CONFIG } from './config.js'
import { mnemonicToSeedBuffer } from './mnemonic-seed.js'
import {
  createMvrCleanCircuitWitness,
  type MvrCleanViolationSlot,
} from './mvr-clean-witness.js'
import {
  createCdlClassACircuitWitness,
  createEmptyCdlClassAWitness,
} from './cdl-class-a-witness.js'
import {
  createCdlClassCircuitWitness,
  createEmptyCdlClassWitness,
} from './cdl-class-witness.js'
import {
  createCdlEndorsementCircuitWitness,
  createCdlRestrictionCircuitWitness,
  createEmptyCdlEndorsementWitness,
  createEmptyCdlRestrictionWitness,
} from './cdl-mask-witness.js'
import {
  createMedCertCircuitWitness,
  createEmptyMedCertWitness,
} from './med-cert-witness.js'
import {
  createPreviousEmployerVerifiedCircuitWitness,
  createEmptyPreviousEmployerVerifiedWitness,
} from './previous-employer-verified-witness.js'

export interface SharedOnChainProveInput {
  candidateUserId: string
  factType: MidnightShippedFactType
  sourceCra: string
  sourcePullId: string
  asOfDateYmd: number
  disclosedFields: Record<string, unknown>
  mnemonic: string
}

export interface MvrOnChainProveInput extends SharedOnChainProveInput {
  factType: 'mvr_clean_36_months'
  windowStartYmd: number
  windowEndYmd: number
  violationSlots: MvrCleanViolationSlot[]
}

export interface CdlClassAOnChainProveInput extends SharedOnChainProveInput {
  factType: 'cdl_class_a'
  holdsClassA: boolean
}

export interface CdlClassOnChainProveInput extends SharedOnChainProveInput {
  factType: 'cdl_class'
  classCode: number
}

export interface CdlMaskOnChainProveInput extends SharedOnChainProveInput {
  factType: 'cdl_endorsements' | 'cdl_restrictions'
  mask: number
}

export interface MedCertOnChainProveInput extends SharedOnChainProveInput {
  factType: 'med_cert_valid'
  expirationYmd: number
}

export interface EmployerVerifiedOnChainProveInput extends SharedOnChainProveInput {
  factType: 'previous_employer_verified'
  employerVerified: boolean
}

export type OnChainProveInput =
  | MvrOnChainProveInput
  | CdlClassAOnChainProveInput
  | CdlClassOnChainProveInput
  | CdlMaskOnChainProveInput
  | MedCertOnChainProveInput
  | EmployerVerifiedOnChainProveInput

export interface OnChainProveResult {
  txHash: string
  proofId: string
  commitment: string
  contractAddress: string
  predicateVersion: string
  pullNullifier: string
  asOfDateYmd: number
  /** DUST spent on this prove (from FinalizedTxData.fees) — use for capacity planning. */
  paidFees: string
  estimatedFees: string
  predicateEnforced: boolean
}

function logProgress(message: string): void {
  console.error(`[MIDNIGHT] ${message}`)
}

// This SDK leaves `highestIndex` at 0. The number that matters is
// `highestRelevantWalletIndex` — how far this wallet has to read.
const CHECKPOINT_MS = 3 * 60 * 1000
const PROGRESS_LOG_MS = 15_000

type WalletProgress = {
  appliedIndex?: bigint
  highestRelevantWalletIndex?: bigint
  appliedId?: bigint
  highestTransactionId?: bigint
  isConnected?: boolean
  isStrictlyComplete?: () => boolean
}

function readProgress(value: unknown): WalletProgress | undefined {
  if (!value || typeof value !== 'object') return undefined
  const record = value as { progress?: WalletProgress; state?: { progress?: WalletProgress } }
  return record.progress ?? record.state?.progress
}

function formatProgress(progress: WalletProgress | undefined): string {
  if (!progress) return 'missing'
  const applied = progress.appliedIndex ?? progress.appliedId ?? 0n
  const tip = progress.highestRelevantWalletIndex ?? progress.highestTransactionId ?? 0n
  const strict = typeof progress.isStrictlyComplete === 'function' ? progress.isStrictlyComplete() : false
  return `${applied}/${tip} connected=${Boolean(progress.isConnected)} strict=${strict}`
}

function makeSyncProgressLogger(): (s: FacadeState) => void {
  let lastLoggedAt = 0
  return (s) => {
    const now = Date.now()
    if (now - lastLoggedAt < PROGRESS_LOG_MS) return
    lastLoggedAt = now
    logProgress(
      `Sync progress: dust ${formatProgress(readProgress(s.dust))} unshielded ${formatProgress(readProgress(s.unshielded))} shielded ${formatProgress(readProgress(s.shielded))}`,
    )
  }
}

/**
 * A prove pays its fee in DUST generated from NIGHT. The contract call
 * carries no shielded coins, so the zswap reader is not part of the gate.
 * The facade's own `isSynced` also waits on shielded, which on mainnet is
 * millions of events this wallet never spends. That wait is what kept
 * proofs from starting.
 */
function isReadyToProve(s: FacadeState): boolean {
  return s.dust.progress.isStrictlyComplete() && s.unshielded.progress.isStrictlyComplete()
}

/**
 * Wait until dust and unshielded are caught up. No deadline. The wallet
 * file is written every few minutes while this waits.
 */
async function waitForWalletSync(walletCtx: MidnightWalletContext) {
  const checkpoint = setInterval(() => {
    logProgress('Saving wallet checkpoint')
    void saveWalletState(walletCtx)
  }, CHECKPOINT_MS)

  try {
    return await Rx.firstValueFrom(
      walletCtx.wallet.state().pipe(
        Rx.tap(makeSyncProgressLogger()),
        Rx.filter(isReadyToProve),
      ),
    )
  } finally {
    clearInterval(checkpoint)
  }
}

export async function registerDustIfNeeded(
  walletCtx: Awaited<ReturnType<typeof createMidnightWallet>>,
): Promise<void> {
  logProgress('Syncing wallet. Waiting for dust and unshielded only. Shielded keeps reading in the background.')
  const state = await waitForWalletSync(walletCtx)
  logProgress('Wallet ready to prove')

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
        Rx.filter(isReadyToProve),
        Rx.filter((s) => s.dust.balance(new Date()) > 0n),
      ),
    )
  }

  await saveWalletState(walletCtx)
}

async function loadCompiledContractForFact(
  factType: MidnightShippedFactType,
  witnesses: unknown,
) {
  const cfg = MIDNIGHT_CIRCUIT_CONFIGS[factType]
  const contractPath = path.join(cfg.managedDir, 'contract', 'index.js')
  const module = (await import(pathToFileURL(contractPath).href)) as {
    Contract: new (w: unknown) => CompactContract
  }

  const ContractCtor = module.Contract as unknown as new (w: unknown) => CompactContract
  const compiledContract = CompiledContract.make(cfg.contractName, ContractCtor).pipe(
    CompiledContract.withWitnesses(witnesses),
    CompiledContract.withCompiledFileAssets(cfg.managedDir),
  )

  return { compiledContract, module }
}

function emptyWitnessForFact(factType: MidnightShippedFactType): unknown {
  switch (factType) {
    case 'mvr_clean_36_months':
      return createMvrCleanCircuitWitness(
        Array.from({ length: 32 }, () => ({ dateYmd: 0, active: false })),
      )
    case 'cdl_class_a':
      return createEmptyCdlClassAWitness()
    case 'cdl_class':
      return createEmptyCdlClassWitness()
    case 'cdl_endorsements':
      return createEmptyCdlEndorsementWitness()
    case 'cdl_restrictions':
      return createEmptyCdlRestrictionWitness()
    case 'med_cert_valid':
      return createEmptyMedCertWitness()
    case 'previous_employer_verified':
      return createEmptyPreviousEmployerVerifiedWitness()
  }
}

export async function deployMidnightContract(
  factType: MidnightShippedFactType,
  mnemonic: string,
): Promise<{ contractAddress: string }> {
  if (MIDNIGHT_CONFIG.network === 'mainnet' && !MIDNIGHT_CONFIG.deployNodeRpc) {
    throw new Error(
      'Mainnet contractDeploy needs MIDNIGHT_DEPLOY_RPC_URL (Foundation keyed node). Leave MIDNIGHT_NODE_RPC_URL on public rpc.mainnet.',
    )
  }

  const seed = mnemonicToSeedBuffer(mnemonic)
  const walletCtx = await createMidnightWallet(seed)

  try {
    await registerDustIfNeeded(walletCtx)
    const { compiledContract } = await loadCompiledContractForFact(
      factType,
      emptyWitnessForFact(factType),
    )
    if (MIDNIGHT_CONFIG.deployNodeRpc) {
      logProgress('Deploy will submit via Foundation keyed RPC (sync stays on public node)')
    }
    logProgress('Creating providers (proof server + indexer)...')
    const providers = await createMidnightProviders(walletCtx, factType, {
      submitViaDeployRpc: Boolean(MIDNIGHT_CONFIG.deployNodeRpc),
    })
    // The silent wait is almost always this: ZK prove of the deploy tx.
    // Keyed submit happens only after prove+balance finish — often 10–30+ min.
    logProgress('Proving contractDeploy (slow — no keyed submit until this finishes)...')
    const deployed = await deployContract(providers, {
      compiledContract,
      args: [],
    })
    return { contractAddress: deployed.deployTxData.public.contractAddress }
  } finally {
    await walletCtx.wallet.stop()
  }
}

let heldWallet: MidnightWalletContext | null = null

/** One wallet for the life of the worker. Later proves reuse it. */
export async function openHeldMidnightWallet(): Promise<void> {
  if (heldWallet) return
  logProgress('Opening the worker wallet')
  const seed = mnemonicToSeedBuffer(MIDNIGHT_CONFIG.walletMnemonic)
  heldWallet = await createMidnightWallet(seed)
  await registerDustIfNeeded(heldWallet)
  // Shielded keeps reading after the prove gate opens. Keep saving so a
  // restart does not lose that background progress.
  const wallet = heldWallet
  setInterval(() => void saveWalletState(wallet), CHECKPOINT_MS).unref()
}

export async function checkpointHeldWallet(): Promise<void> {
  if (!heldWallet) return
  await saveWalletState(heldWallet)
}

export async function proveFactOnChain(input: OnChainProveInput): Promise<OnChainProveResult> {
  const pullNullifier = buildPullNullifier(input.sourcePullId)
  const commitment = buildFactCommitment({
    candidateUserId: input.candidateUserId,
    factType: input.factType,
    sourceCra: input.sourceCra,
    sourcePullId: input.sourcePullId,
    asOfDateYmd: input.asOfDateYmd,
    disclosedFields: input.disclosedFields,
  })

  const contractAddress = resolveContractAddressForFact(input.factType)
  const cfg = MIDNIGHT_CIRCUIT_CONFIGS[input.factType]
  const reuseHeld = heldWallet !== null
  const walletCtx = heldWallet ?? (await createMidnightWallet(mnemonicToSeedBuffer(input.mnemonic)))

  try {
    if (!reuseHeld) logProgress('Initializing wallet...')
    // Already-synced wallet returns immediately. A catch-up that slipped
    // behind waits here, and the checkpoint timer keeps writing the file.
    await registerDustIfNeeded(walletCtx)

    const witnesses =
      input.factType === 'mvr_clean_36_months'
        ? createMvrCleanCircuitWitness(input.violationSlots)
        : input.factType === 'previous_employer_verified'
          ? createPreviousEmployerVerifiedCircuitWitness(input.employerVerified)
          : input.factType === 'cdl_class_a'
            ? createCdlClassACircuitWitness(input.holdsClassA)
            : input.factType === 'cdl_class'
              ? createCdlClassCircuitWitness(input.classCode)
              : input.factType === 'cdl_endorsements'
                ? createCdlEndorsementCircuitWitness(input.mask)
                : input.factType === 'cdl_restrictions'
                  ? createCdlRestrictionCircuitWitness(input.mask)
                  : createMedCertCircuitWitness(input.expirationYmd)

    logProgress(`Loading compiled contract + providers (${input.factType})...`)
    const { compiledContract } = await loadCompiledContractForFact(input.factType, witnesses)
    const providers = await createMidnightProviders(walletCtx, input.factType)

    logProgress(`Locating deployed contract ${contractAddress.slice(0, 12)}...`)
    const contract = await findDeployedContract(providers, {
      contractAddress,
      compiledContract,
    })

    const asOfDate = BigInt(input.asOfDateYmd)
    logProgress('Generating ZK predicate proof + submitting transaction (slow step)...')

    let tx
    try {
      if (input.factType === 'mvr_clean_36_months') {
        tx = await contract.callTx.proveCleanMvr(
          BigInt(input.windowStartYmd),
          BigInt(input.windowEndYmd),
          asOfDate,
          pullNullifier,
          commitment,
        )
      } else if (input.factType === 'previous_employer_verified') {
        tx = await contract.callTx.provePreviousEmployerVerified(
          asOfDate,
          pullNullifier,
          commitment,
        )
      } else if (input.factType === 'cdl_class_a') {
        tx = await contract.callTx.proveCdlClassA(asOfDate, pullNullifier, commitment)
      } else if (input.factType === 'cdl_class') {
        tx = await contract.callTx.proveCdlClass(
          BigInt(input.classCode),
          asOfDate,
          pullNullifier,
          commitment,
        )
      } else if (input.factType === 'cdl_endorsements') {
        tx = await contract.callTx.proveCdlEndorsements(
          BigInt(input.mask),
          asOfDate,
          pullNullifier,
          commitment,
        )
      } else if (input.factType === 'cdl_restrictions') {
        tx = await contract.callTx.proveCdlRestrictions(
          BigInt(input.mask),
          asOfDate,
          pullNullifier,
          commitment,
        )
      } else {
        tx = await contract.callTx.proveMedCertValid(
          BigInt(input.expirationYmd),
          asOfDate,
          pullNullifier,
          commitment,
        )
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const cause =
        err instanceof Error && err.cause instanceof Error ? err.cause.message : ''
      throw new Error(
        cause ? `${cfg.callMethod} failed: ${msg} — ${cause}` : `${cfg.callMethod} failed: ${msg}`,
        { cause: err instanceof Error ? err : undefined },
      )
    }

    const txHash = tx.public.txId
    const paidFees = tx.public.fees?.paidFees ?? '0'
    const estimatedFees = tx.public.fees?.estimatedFees ?? '0'
    logProgress(`Transaction submitted: ${txHash}`)
    logProgress(`Fees paid=${paidFees} estimated=${estimatedFees} (DUST raw units)`)

    return {
      txHash,
      proofId: txHash,
      commitment,
      contractAddress,
      pullNullifier,
      asOfDateYmd: input.asOfDateYmd,
      paidFees,
      estimatedFees,
      predicateVersion:
        input.factType === 'mvr_clean_36_months'
          ? 'v1-any-violation-in-window'
          : input.factType === 'previous_employer_verified'
            ? 'v1-evr-dkim'
            : input.factType === 'cdl_class_a'
              ? 'v1-cdl-class-a-boolean'
              : `v1-mvr-field-${input.factType}`,
      predicateEnforced:
        input.factType === 'cdl_class' ||
        input.factType === 'cdl_endorsements' ||
        input.factType === 'cdl_restrictions' ||
        input.factType === 'med_cert_valid' ||
        input.factType === 'mvr_clean_36_months',
    }
  } finally {
    // The worker's wallet stays open. A one-shot prove closes its own.
    if (!reuseHeld) {
      await saveWalletState(walletCtx)
      await walletCtx.wallet.stop()
    }
  }
}

/** @deprecated Use proveFactOnChain — kept for existing imports. */
export async function proveCleanMvrOnChain(input: MvrOnChainProveInput): Promise<OnChainProveResult> {
  return proveFactOnChain(input)
}

export async function deployMvrCleanContract(mnemonic: string) {
  return deployMidnightContract('mvr_clean_36_months', mnemonic)
}

export async function getWalletStatus(mnemonic: string) {
  const seed = mnemonicToSeedBuffer(mnemonic)
  const walletCtx = await createMidnightWallet(seed)
  const address = walletCtx.unshieldedKeystore.getBech32Address().asString()

  try {
    logProgress('Syncing wallet (first run can take several minutes)...')
    logProgress(`Unshielded address: ${address}`)

    const state = await waitForWalletSync(walletCtx)
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
