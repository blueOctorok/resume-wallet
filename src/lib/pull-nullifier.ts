import { createHash } from 'node:crypto'

/** Deterministic nullifier for a screening pull — same id must not prove twice. */
export function buildPullNullifier(sourcePullId: string): string {
  const normalized = sourcePullId.trim()
  if (!normalized) {
    throw new Error('sourcePullId is required for pull nullifier')
  }
  return createHash('sha256').update(`storm:pull:${normalized}`).digest('hex')
}
