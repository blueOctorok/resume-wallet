#!/usr/bin/env npx tsx
/**
 * Measure Preprod tNIGHT / tDUST spend for one prove (capacity planning).
 *
 * Usage:
 *   npm run midnight:cost-benchmark -- --fact cdl_class_a --user <uuid>
 *   npm run midnight:cost-benchmark -- --fact previous_employer_verified --user <uuid> [--verification-request-id <uuid>]
 *
 * Fees are paid in DUST (generated from locked NIGHT). Track ΔtDust primarily;
 * ΔtNight is usually 0 on a prove (NIGHT stays locked; DUST is consumed).
 */
import { config } from 'dotenv'
import WebSocket from 'ws'
import { spawn } from 'node:child_process'
import path from 'node:path'
config({ path: '.env.local' })

if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket
}

type ShippedFact =
  | 'mvr_clean_36_months'
  | 'cdl_class_a'
  | 'previous_employer_verified'

interface WalletBalances {
  address: string
  tNight: string
  tDust: string
}

function parseArgs(argv: string[]) {
  let fact: ShippedFact = 'cdl_class_a'
  let userId = ''
  let verificationRequestId = ''
  let employmentId = ''

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--fact' && argv[i + 1]) fact = argv[++i] as ShippedFact
    else if (a === '--user' && argv[i + 1]) userId = argv[++i]
    else if (a === '--verification-request-id' && argv[i + 1]) verificationRequestId = argv[++i]
    else if (a === '--employment-id' && argv[i + 1]) employmentId = argv[++i]
  }

  if (!userId) {
    throw new Error(
      'Usage: midnight:cost-benchmark -- --fact <fact> --user <uuid> [--verification-request-id <uuid>]',
    )
  }
  return { fact, userId, verificationRequestId, employmentId }
}

function runWalletStatus(): Promise<WalletBalances> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'npx',
      ['tsx', 'scripts/wallet-status.ts', '--json'],
      {
        cwd: path.resolve(process.cwd(), 'midnight/runtime'),
        env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=16384' },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (c: Buffer) => {
      stdout += c.toString()
    })
    child.stderr.on('data', (c: Buffer) => {
      stderr += c.toString()
      process.stderr.write(c)
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `wallet:status exited ${code}`))
        return
      }
      try {
        resolve(JSON.parse(stdout.trim()) as WalletBalances)
      } catch {
        reject(new Error(`Invalid wallet:status JSON: ${stdout}`))
      }
    })
  })
}

function runProve(input: {
  fact: ShippedFact
  userId: string
  verificationRequestId?: string
  employmentId?: string
}): Promise<{
  attestationId?: string
  txHash?: string
  paidFees?: string
  estimatedFees?: string
  elapsedMs: number
}> {
  return new Promise((resolve, reject) => {
    const args = [
      'tsx',
      'scripts/midnight-prove-fact.ts',
      '--fact',
      input.fact,
      '--user',
      input.userId,
      '--json',
    ]
    if (input.verificationRequestId) {
      args.push('--verification-request-id', input.verificationRequestId)
    }
    if (input.employmentId) {
      args.push('--employment-id', input.employmentId)
    }

    const started = Date.now()
    const child = spawn('npx', args, {
      cwd: path.resolve(process.cwd()),
      env: { ...process.env, ATTESTATION_BACKEND: 'midnight' },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (c: Buffer) => {
      stdout += c.toString()
    })
    child.stderr.on('data', (c: Buffer) => {
      stderr += c.toString()
      process.stderr.write(c)
    })
    child.on('error', reject)
    child.on('close', (code) => {
      const elapsedMs = Date.now() - started
      if (code !== 0) {
        reject(new Error(stderr.trim() || `prove-fact exited ${code}`))
        return
      }
      try {
        const out = JSON.parse(stdout.trim()) as {
          attestationId?: string
          proof?: {
            txHash?: string
            paidFees?: string
            estimatedFees?: string
          }
        }
        resolve({
          attestationId: out.attestationId,
          txHash: out.proof?.txHash,
          paidFees: out.proof?.paidFees,
          estimatedFees: out.proof?.estimatedFees,
          elapsedMs,
        })
      } catch {
        resolve({ elapsedMs })
      }
    })
  })
}

async function main() {
  const { fact, userId, verificationRequestId, employmentId } = parseArgs(
    process.argv.slice(2),
  )

  console.error('[COST] Snapshot BEFORE prove...')
  const before = await runWalletStatus()
  console.error(`[COST] before tNight=${before.tNight} tDust=${before.tDust}`)

  console.error(`[COST] Proving ${fact} for ${userId}...`)
  const prove = await runProve({
    fact,
    userId,
    verificationRequestId: verificationRequestId || undefined,
    employmentId: employmentId || undefined,
  })

  console.error('[COST] Snapshot AFTER prove...')
  const after = await runWalletStatus()
  console.error(`[COST] after  tNight=${after.tNight} tDust=${after.tDust}`)

  const dNight = BigInt(before.tNight) - BigInt(after.tNight)
  const dDust = BigInt(before.tDust) - BigInt(after.tDust)

  // Prefer FinalizedTxData.fees — DUST regenerates toward a tank cap, so
  // before/after wallet snapshots often show ΔtDust = 0 even when a fee was paid.
  const paidFees = prove.paidFees ?? null
  const estimatedFees = prove.estimatedFees ?? null

  const report = {
    ok: true,
    network: process.env.MIDNIGHT_NETWORK ?? 'preprod',
    fact,
    userId,
    attestationId: prove.attestationId ?? null,
    txHash: prove.txHash ?? null,
    elapsedMs: prove.elapsedMs,
    fees: {
      paidFees,
      estimatedFees,
      source: paidFees != null ? 'tx.public.fees' : 'unavailable',
    },
    before,
    after,
    delta: {
      tNightSpent: dNight.toString(),
      tDustSpent: dDust.toString(),
    },
    notes: [
      'Authoritative fee = fees.paidFees (DUST raw units from FinalizedTxData).',
      'ΔtDust from wallet snapshots is often 0 — DUST regenerates to a tank cap between syncs.',
      'ΔtNight ≈ 0 on proves — NIGHT stays locked as DUST backing; fees burn DUST.',
      'Preprod faucet units ≠ mainnet economics; use DUST/prove ratios + safety factor for NIGHT sizing.',
    ],
  }

  console.log(JSON.stringify(report, null, 2))
}

main().catch((err) => {
  console.error('[COST] Failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
