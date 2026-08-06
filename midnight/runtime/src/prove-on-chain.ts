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
} from './wallet.js'
import { createMidnightProviders } from './providers.js'
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

export interface CdlOnChainProveInput extends SharedOnChainProveInput {
  factType: 'cdl_class_a'
  holdsClassA: boolean
}

export interface EmployerVerifiedOnChainProveInput extends SharedOnChainProveInput {
  factType: 'previous_employer_verified'
  employerVerified: boolean
}

export type OnChainProveInput =
  | MvrOnChainProveInput
  | CdlOnChainProveInput
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
}

function logProgress(message: string): void {
  console.error(`[MIDNIGHT] ${message}`)
}

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
    case 'previous_employer_verified':
      return createEmptyPreviousEmployerVerifiedWitness()
  }
}

export async function deployMidnightContract(
  factType: MidnightShippedFactType,
  mnemonic: string,
): Promise<{ contractAddress: string }> {
  const seed = mnemonicToSeedBuffer(mnemonic)
  const walletCtx = await createMidnightWallet(seed)

  try {
    await registerDustIfNeeded(walletCtx)
    const { compiledContract } = await loadCompiledContractForFact(
      factType,
      emptyWitnessForFact(factType),
    )
    const providers = await createMidnightProviders(walletCtx, factType)
    const deployed = await deployContract(providers, {
      compiledContract,
      args: [],
    })
    return { contractAddress: deployed.deployTxData.public.contractAddress }
  } finally {
    await walletCtx.wallet.stop()
  }
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

  const seed = mnemonicToSeedBuffer(input.mnemonic)
  const contractAddress = resolveContractAddressForFact(input.factType)
  const cfg = MIDNIGHT_CIRCUIT_CONFIGS[input.factType]

  logProgress('Initializing wallet...')
  const walletCtx = await createMidnightWallet(seed)

  try {
    await registerDustIfNeeded(walletCtx)

    const witnesses =
      input.factType === 'mvr_clean_36_months'
        ? createMvrCleanCircuitWitness(input.violationSlots)
        : input.factType === 'cdl_class_a'
          ? createCdlClassACircuitWitness(input.holdsClassA)
          : createPreviousEmployerVerifiedCircuitWitness(input.employerVerified)

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
      } else if (input.factType === 'cdl_class_a') {
        tx = await contract.callTx.proveCdlClassA(asOfDate, pullNullifier, commitment)
      } else {
        tx = await contract.callTx.provePreviousEmployerVerified(
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
          : input.factType === 'cdl_class_a'
            ? 'v1-class-a-from-mvr'
            : 'v1-evr-verified',
    }
  } finally {
    await walletCtx.wallet.stop()
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

    const state = await Rx.firstValueFrom(
      walletCtx.wallet.state().pipe(
        Rx.tap(makeSyncProgressLogger()),
        Rx.filter((s) => s.isSynced),
      ),
    )
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
