// Throwaway: read-only mainnet sync smoke test. Prints numbers and booleans only.
// No prove, no deploy, no registration, no cache write.
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import * as Rx from 'rxjs'
import { Token, type FacadeState } from '@midnightntwrk/wallet-sdk'
import { findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts'

import { MIDNIGHT_CONFIG } from '../src/config.js'
import { mnemonicToSeedBuffer } from '../src/mnemonic-seed.js'
import { createMidnightWallet } from '../src/wallet.js'
import { createMidnightProviders } from '../src/providers.js'
import { resolveContractAddressForFact, type MidnightShippedFactType } from '../src/contract-registry.js'
import { createMvrCleanCircuitWitness } from '../src/mvr-clean-witness.js'
import { createCdlClassACircuitWitness } from '../src/cdl-class-a-witness.js'
import { createCdlClassCircuitWitness } from '../src/cdl-class-witness.js'
import { createCdlEndorsementCircuitWitness, createCdlRestrictionCircuitWitness } from '../src/cdl-mask-witness.js'
import { createMedCertCircuitWitness } from '../src/med-cert-witness.js'
import { createPreviousEmployerVerifiedCircuitWitness } from '../src/previous-employer-verified-witness.js'

const SYNC_MS = Number(process.env.SMOKE_SYNC_MS ?? 150_000)
const SAMPLE_MS = 5_000

// Private-state LevelDB is created relative to cwd: keep it out of the repo.
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'mn-smoke-'))
process.chdir(scratch)

const redact = (text: string) =>
  text
    .replace(/project_id=[^ :)&"]*/g, 'project_id=REDACTED')
    .replace(/(https?|wss?):\/\/[^\s"')]+/g, '$1://REDACTED')
    .slice(0, 1500)
const describe = (err: unknown) => {
  const parts: string[] = []
  let cur: unknown = err
  for (let i = 0; cur && i < 6; i++) {
    parts.push(cur instanceof Error ? `${cur.name}: ${cur.message}` : String(cur))
    cur = cur instanceof Error ? cur.cause : undefined
  }
  return redact(parts.join(' <- '))
}
const out = (label: string, value: unknown) =>
  console.log(`${label} ${JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))}`)
const sha = (value: string) => crypto.createHash('sha256').update(value).digest('hex')

let firstError: string | null = null
const noteError = (where: string, err: unknown) => {
  if (!firstError) {
    firstError = `${where}: ${describe(err)}`
    out('FIRST_ERROR', firstError)
  }
}
process.on('unhandledRejection', (err) => noteError('unhandledRejection', err))
process.on('uncaughtException', (err) => noteError('uncaughtException', err))

const progressOf = (reader: { progress: object }) => {
  const p = reader.progress as {
    appliedIndex?: bigint
    highestRelevantWalletIndex?: bigint
    appliedId?: bigint
    highestTransactionId?: bigint
    isConnected?: boolean
    isStrictlyComplete?: () => boolean
  }
  return {
    applied: Number(p.appliedIndex ?? p.appliedId ?? 0n),
    tip: Number(p.highestRelevantWalletIndex ?? p.highestTransactionId ?? 0n),
    connected: Boolean(p.isConnected),
    strict: p.isStrictlyComplete?.() ?? false,
  }
}

out('START', {
  node: process.version,
  network: MIDNIGHT_CONFIG.network,
  hasNativeWebSocket: typeof globalThis.WebSocket === 'function',
  syncMs: SYNC_MS,
})

const before = JSON.parse(fs.readFileSync('/tmp/wallet-identity-before.json', 'utf8')) as Record<string, string>
const ctx = await createMidnightWallet(mnemonicToSeedBuffer(MIDNIGHT_CONFIG.walletMnemonic))
out('WALLET_STARTED', true)

let latest: FacadeState | null = null
let emissions = 0
const sub = ctx.wallet.state().subscribe({
  next: (s) => {
    latest = s
    emissions++
  },
  error: (err) => noteError('state stream', err),
})

// Read-only: locate each deployed contract and let Midnight.js compare the
// local verifier keys with the chain. Builds and submits nothing.
const contracts: Array<[MidnightShippedFactType, () => Promise<unknown>]> = [
  ['mvr_clean_36_months', async () => new (await import('../managed/mvr-clean-36/contract/index.js')).Contract<unknown>(createMvrCleanCircuitWitness(Array.from({ length: 32 }, () => ({ dateYmd: 0, active: false }))))],
  ['cdl_class_a', async () => new (await import('../managed/cdl-class-a/contract/index.js')).Contract<unknown>(createCdlClassACircuitWitness(false))],
  ['cdl_class', async () => new (await import('../managed/cdl-class/contract/index.js')).Contract<unknown>(createCdlClassCircuitWitness(0))],
  ['cdl_endorsements', async () => new (await import('../managed/cdl-endorsements/contract/index.js')).Contract<unknown>(createCdlEndorsementCircuitWitness(0))],
  ['cdl_restrictions', async () => new (await import('../managed/cdl-restrictions/contract/index.js')).Contract<unknown>(createCdlRestrictionCircuitWitness(0))],
  ['med_cert_valid', async () => new (await import('../managed/med-cert-valid/contract/index.js')).Contract<unknown>(createMedCertCircuitWitness(0))],
  ['previous_employer_verified', async () => new (await import('../managed/previous-employer-verified/contract/index.js')).Contract<unknown>(createPreviousEmployerVerifiedCircuitWitness(false))],
]
const locateAll = async () => {
  for (const [fact, make] of contracts) {
    const startedAt = Date.now()
    try {
      const providers = await createMidnightProviders(ctx, fact)
      const compiledContract = (await make()) as Parameters<typeof findDeployedContract>[1]['compiledContract']
      const found = await findDeployedContract(providers, {
        contractAddress: resolveContractAddressForFact(fact),
        compiledContract,
      })
      out('LOCATE', { fact, ok: true, ms: Date.now() - startedAt, circuits: Object.keys(found.callTx) })
    } catch (err) {
      out('LOCATE', { fact, ok: false, ms: Date.now() - startedAt, error: describe(err) })
    }
  }
}
const locating = locateAll()

const startedAt = Date.now()
const samples: Array<{ t: number; dust: number; shielded: number; unshielded: number; rss: number }> = []
while (Date.now() - startedAt < SYNC_MS) {
  await new Promise((resolve) => setTimeout(resolve, SAMPLE_MS))
  const s = latest as FacadeState | null
  if (!s) {
    out('SAMPLE', { t: Math.round((Date.now() - startedAt) / 1000), state: 'none yet' })
    continue
  }
  const mem = process.memoryUsage()
  const row = {
    t: Math.round((Date.now() - startedAt) / 1000),
    dust: progressOf(s.dust),
    shielded: progressOf(s.shielded),
    unshielded: progressOf(s.unshielded),
    rssMb: Math.round(mem.rss / 1048576),
    heapMb: Math.round(mem.heapUsed / 1048576),
    phase: s.protocol,
    versions: s.protocolVersion,
    active: s.activeProtocolVersion,
    emissions,
    liveness: (s.unshielded.progress as { indexerLiveness?: { _tag?: string; reason?: string } }).indexerLiveness,
  }
  samples.push({ t: row.t, dust: row.dust.applied, shielded: row.shielded.applied, unshielded: row.unshielded.applied, rss: row.rssMb })
  out('SAMPLE', row)
}
await locating

const s = latest as FacadeState | null
if (s) {
  const first = samples[0]
  const last = samples.at(-1)
  if (first && last && last.t > first.t) {
    const dt = last.t - first.t
    out('RATES_PER_SEC', {
      overSeconds: dt,
      dust: Math.round((last.dust - first.dust) / dt),
      shielded: Math.round((last.shielded - first.shielded) / dt),
      unshielded: Math.round((last.unshielded - first.unshielded) / dt),
      rssFirstMb: first.rss,
      rssLastMb: last.rss,
      rssMaxMb: Math.max(...samples.map((x) => x.rss)),
    })
  }
  const coins = s.unshielded.availableCoins
  out('SUMMARY', {
    nightCoinsAvailable: coins.length,
    nightCoinsRegisteredForDust: coins.filter((c) => c.meta?.registeredForDustGeneration).length,
    nightCoinsPending: s.unshielded.pendingCoins.length,
    balanceKeys: Object.keys(s.unshielded.balances).length,
    nightKeyPresent: Token.night in s.unshielded.balances,
    nightBalancePositive: (s.unshielded.balances[Token.night] ?? 0n) > 0n,
    dustCoinsAvailable: s.dust.availableCoins.length,
    dustBalancePositive: s.dust.balance(new Date()) > 0n,
    isSynced: s.isSynced,
  })
  out('IDENTITY_FROM_RUNNING_WALLET', {
    unshieldedAddress: sha(ctx.unshieldedKeystore.getBech32Address().asString()) === before.unshieldedAddressSha256,
    shieldedCoinPublicKey: sha(s.shielded.coinPublicKey.toHexString()) === before.shieldedCoinPublicKeySha256,
    shieldedEncryptionPublicKey: sha(s.shielded.encryptionPublicKey.toHexString()) === before.shieldedEncryptionPublicKeySha256,
    dustPublicKey: sha(s.dust.publicKey.toString()) === before.dustPublicKeySha256,
  })
  // Same calls the 3-minute checkpoint makes; lengths only, nothing written.
  for (const [label, serialize] of [
    ['shielded', () => ctx.wallet.shielded.serializeState()],
    ['unshielded', () => ctx.wallet.unshielded.serializeState()],
    ['dust', () => ctx.wallet.dust.serializeState()],
  ] as const) {
    const t0 = Date.now()
    try {
      out('SERIALIZE', { reader: label, ok: true, chars: (await serialize()).length, ms: Date.now() - t0 })
    } catch (err) {
      out('SERIALIZE', { reader: label, ok: false, error: describe(err) })
    }
  }
}

sub.unsubscribe()
try {
  await ctx.wallet.stop()
  out('STOPPED', true)
} catch (err) {
  out('STOPPED', { ok: false, error: describe(err) })
}
out('DONE', { firstError, scratchFiles: fs.readdirSync(scratch) })
fs.rmSync(scratch, { recursive: true, force: true })
process.exit(0)
