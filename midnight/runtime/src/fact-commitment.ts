import { createHash } from 'node:crypto'

/** Deterministic commitment for an attestation fact — stored on-chain, no PII. */
export function buildFactCommitment(input: {
  candidateUserId: string
  factType: string
  sourceCra: string
  sourcePullId: string
  /** YYYYMMDD from screening completion — binds cert to that pull event (P3.4-A). */
  asOfDateYmd: number
  disclosedFields: Record<string, unknown>
}): string {
  const payload = JSON.stringify({
    candidateUserId: input.candidateUserId,
    factType: input.factType,
    sourceCra: input.sourceCra,
    sourcePullId: input.sourcePullId,
    asOfDateYmd: input.asOfDateYmd,
    disclosedFields: sortKeys(input.disclosedFields),
  })
  return createHash('sha256').update(payload).digest('hex')
}

function sortKeys(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.keys(obj)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = obj[key]
      return acc
    }, {})
}
