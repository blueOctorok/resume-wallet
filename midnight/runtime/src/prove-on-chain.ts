import * as Rx from 'rxjs'
import { DefaultForkSchedule, Token, type FacadeState } from '@midnightntwrk/wallet-sdk'
import {
  findDeployedContract,
  type Ledger8Contract,
} from '@midnight-ntwrk/midnight-js-contracts'

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
import { createCdlClassACircuitWitness } from './cdl-class-a-witness.js'
import { createCdlClassCircuitWitness } from './cdl-class-witness.js'
import {
  createCdlEndorsementCircuitWitness,
  createCdlRestrictionCircuitWitness,
} from './cdl-mask-witness.js'
import { createMedCertCircuitWitness } from './med-cert-witness.js'
import { createPreviousEmployerVerifiedCircuitWitness } from './previous-employer-verified-witness.js'

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
      `Sync progress: dust ${formatProgress(readProgress(s.dust))} unshielded ${formatProgress(readProgress(s.unshielded))} shielded ${formatProgress(readProgress(s.shielded))} ledger ${formatLedger(s)}`,
    )
  }
}

/** Which ledger the wallet can transact on, and which readers hold it back. */
function formatLedger(s: FacadeState): string {
  const phase = s.protocol
  if (phase._tag === 'Crossing') return `8->9 waiting on ${phase.behind.join(',')}`
  return phase.version >= DefaultForkSchedule.v9 ? '9' : '8'
}

/**
 * A prove pays its fee in DUST generated from NIGHT. The contract call
 * carries no shielded coins, so the zswap reader does not have to reach the
 * tip. The facade's own `isSynced` waits for that, which on mainnet is
 * millions of events this wallet never spends, and it kept proofs from
 * starting.
 *
 * All three readers do have to be past the ledger 9 hand-over. The wallet
 * builds and accepts transactions on the oldest ledger any of its readers
 * is still on, so until the slowest one crosses it cannot balance the
 * ledger 9 transaction a prove produces.
 */
function isReadyToProve(s: FacadeState): boolean {
  return (
    s.dust.progress.isStrictlyComplete() &&
    s.unshielded.progress.isStrictlyComplete() &&
    s.activeProtocolVersion >= DefaultForkSchedule.v9
  )
}

/**
 * Wait until dust and unshielded are caught up and every reader is on
 * ledger 9. No deadline. The wallet file is written every few minutes
 * while this waits.
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
  logProgress('Syncing wallet. Waiting for dust and unshielded, and for shielded to reach ledger 9. Shielded then keeps reading in the background.')
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
      walletCtx.unshieldedKeystore.signDataAsync,
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

// The deployed contracts, loaded on demand so a prove imports one of them.
// These are the ledger 8 builds (compactc 0.31). Midnight.js takes such a
// contract as a plain `new Contract(witnesses)` and can only call it.
const CONTRACT_MODULES = {
  mvr_clean_36_months: () => import('../managed/mvr-clean-36/contract/index.js'),
  cdl_class_a: () => import('../managed/cdl-class-a/contract/index.js'),
  cdl_class: () => import('../managed/cdl-class/contract/index.js'),
  cdl_endorsements: () => import('../managed/cdl-endorsements/contract/index.js'),
  cdl_restrictions: () => import('../managed/cdl-restrictions/contract/index.js'),
  med_cert_valid: () => import('../managed/med-cert-valid/contract/index.js'),
  previous_employer_verified: () =>
    import('../managed/previous-employer-verified/contract/index.js'),
} satisfies Record<MidnightShippedFactType, () => Promise<unknown>>

/**
 * Deploys are off until the circuits are recompiled. Every Midnight network
 * is on ledger 9 now, which still accepts calls to the ledger 8 builds in
 * managed/ but refuses to deploy them.
 */
export async function deployMidnightContract(
  factType: MidnightShippedFactType,
): Promise<{ contractAddress: string }> {
  throw new Error(
    `Cannot deploy ${MIDNIGHT_CIRCUIT_CONFIGS[factType].contractName}: its compiled circuit is a ledger 8 build, and a ledger 9 network only accepts calls to those. Recompile the circuits with compactc 0.36.0 and move the deploy path to the ledger 9 contract API first.`,
  )
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

    logProgress(`Loading compiled contract + providers (${input.factType})...`)
    const providers = await createMidnightProviders(walletCtx, input.factType)
    const attach = async <C extends Ledger8Contract>(compiledContract: C) => {
      logProgress(`Locating deployed contract ${contractAddress.slice(0, 12)}...`)
      const contract = await findDeployedContract(providers, { contractAddress, compiledContract })
      logProgress('Generating ZK predicate proof + submitting transaction (slow step)...')
      return contract
    }

    const asOfDate = BigInt(input.asOfDateYmd)
    // One case per fact: each contract has its own witness and its own circuit
    // arguments, and keeping them side by side lets the compiler check both
    // against the generated contract types.
    const callCircuit = async () => {
      switch (input.factType) {
        case 'mvr_clean_36_months': {
          const { Contract } = await CONTRACT_MODULES.mvr_clean_36_months()
          const contract = await attach(new Contract<unknown>(createMvrCleanCircuitWitness(input.violationSlots)))
          return contract.callTx.proveCleanMvr(
            BigInt(input.windowStartYmd),
            BigInt(input.windowEndYmd),
            asOfDate,
            pullNullifier,
            commitment,
          )
        }
        case 'previous_employer_verified': {
          const { Contract } = await CONTRACT_MODULES.previous_employer_verified()
          const contract = await attach(
            new Contract<unknown>(createPreviousEmployerVerifiedCircuitWitness(input.employerVerified)),
          )
          return contract.callTx.provePreviousEmployerVerified(asOfDate, pullNullifier, commitment)
        }
        case 'cdl_class_a': {
          const { Contract } = await CONTRACT_MODULES.cdl_class_a()
          const contract = await attach(new Contract<unknown>(createCdlClassACircuitWitness(input.holdsClassA)))
          return contract.callTx.proveCdlClassA(asOfDate, pullNullifier, commitment)
        }
        case 'cdl_class': {
          const { Contract } = await CONTRACT_MODULES.cdl_class()
          const contract = await attach(new Contract<unknown>(createCdlClassCircuitWitness(input.classCode)))
          return contract.callTx.proveCdlClass(
            BigInt(input.classCode),
            asOfDate,
            pullNullifier,
            commitment,
          )
        }
        case 'cdl_endorsements': {
          const { Contract } = await CONTRACT_MODULES.cdl_endorsements()
          const contract = await attach(new Contract<unknown>(createCdlEndorsementCircuitWitness(input.mask)))
          return contract.callTx.proveCdlEndorsements(
            BigInt(input.mask),
            asOfDate,
            pullNullifier,
            commitment,
          )
        }
        case 'cdl_restrictions': {
          const { Contract } = await CONTRACT_MODULES.cdl_restrictions()
          const contract = await attach(new Contract<unknown>(createCdlRestrictionCircuitWitness(input.mask)))
          return contract.callTx.proveCdlRestrictions(
            BigInt(input.mask),
            asOfDate,
            pullNullifier,
            commitment,
          )
        }
        case 'med_cert_valid': {
          const { Contract } = await CONTRACT_MODULES.med_cert_valid()
          const contract = await attach(new Contract<unknown>(createMedCertCircuitWitness(input.expirationYmd)))
          return contract.callTx.proveMedCertValid(
            BigInt(input.expirationYmd),
            asOfDate,
            pullNullifier,
            commitment,
          )
        }
      }
    }

    const tx = await callCircuit().catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err)
      const cause =
        err instanceof Error && err.cause instanceof Error ? err.cause.message : ''
      throw new Error(
        cause ? `${cfg.callMethod} failed: ${msg} — ${cause}` : `${cfg.callMethod} failed: ${msg}`,
        { cause: err instanceof Error ? err : undefined },
      )
    })

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

export async function getWalletStatus(mnemonic: string) {
  const seed = mnemonicToSeedBuffer(mnemonic)
  const walletCtx = await createMidnightWallet(seed)
  const address = walletCtx.unshieldedKeystore.getBech32Address().asString()

  try {
    logProgress('Syncing wallet (first run can take several minutes)...')
    logProgress(`Unshielded address: ${address}`)

    const state = await waitForWalletSync(walletCtx)
    await saveWalletState(walletCtx)

    const tNight = state.unshielded.balances[Token.night] ?? 0n
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
