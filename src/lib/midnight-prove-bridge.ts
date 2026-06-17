import { spawn } from 'node:child_process'
import path from 'node:path'

export interface MidnightOnChainProveInput {
  candidateUserId: string
  factType: string
  sourceCra: string
  sourcePullId: string
  disclosedFields: Record<string, unknown>
}

export interface MidnightOnChainProveResult {
  txHash: string
  proofId: string
  commitment: string
  contractAddress: string
}

const REPO_ROOT = path.resolve(process.cwd())
const CLI_PATH = path.join(REPO_ROOT, 'midnight/runtime/scripts/prove-on-chain-cli.ts')

/** Run Midnight prove via tsx subprocess — keeps heavy SDK out of Next.js bundle. */
export function proveFactOnMidnight(
  input: MidnightOnChainProveInput,
): Promise<MidnightOnChainProveResult> {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['tsx', CLI_PATH], {
      cwd: REPO_ROOT,
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
      // Stream the subprocess's progress (it logs to stderr) to our stderr so the
      // user sees live "syncing / proving / submitting" markers instead of a
      // silent multi-minute hang. stdout stays untouched for JSON parsing.
      process.stderr.write(chunk)
    })

    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Midnight prove exited ${code}`))
        return
      }
      try {
        resolve(JSON.parse(stdout.trim()) as MidnightOnChainProveResult)
      } catch {
        reject(new Error(`Invalid Midnight prove output: ${stdout}`))
      }
    })

    child.stdin.write(JSON.stringify(input))
    child.stdin.end()
  })
}
