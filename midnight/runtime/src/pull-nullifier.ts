import { createHash } from 'node:crypto'

/** Must match `src/lib/pull-nullifier.ts` — runtime is a separate package. */
export function buildPullNullifier(sourcePullId: string): string {
  const normalized = sourcePullId.trim()
  if (!normalized) {
    throw new Error('sourcePullId is required for pull nullifier')
  }
  return createHash('sha256').update(`storm:pull:${normalized}`).digest('hex')
}
