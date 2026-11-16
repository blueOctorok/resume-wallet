import type { AttestationInput } from '@/lib/attestation-service'
import { AttestationError } from '@/lib/attestation-service'
import { attestationService } from '@/lib/attestation-service-registry'
import { resolveAttestationFact, type ShippedFactType } from '@/lib/fact-registry'

/** Billboard facts a driver-owned Accio MVR can prove. Not the barcode read. */
export const MVR_CARD_FACTS: readonly ShippedFactType[] = [
  'cdl_class',
  'cdl_endorsements',
  'cdl_restrictions',
  'med_cert_valid',
]

type ProveFn = (input: AttestationInput) => Promise<unknown>
type ResolveFn = (input: AttestationInput) => Promise<unknown>

export interface MvrFactProveResult {
  proven: ShippedFactType[]
  /** Will not succeed on a retry: not on the report, already recorded, or the circuit rejected the data. */
  skipped: ShippedFactType[]
  /** Worth another try: the node, the database, or a proof that landed with no row. */
  failed: ShippedFactType[]
}

/**
 * A retry cannot fix these. "pull already proven" is the exception: the chain
 * already has the proof, and the missing database row is not a reason to stop.
 */
export function isPermanentFactFailure(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err)
  if (message.includes('pull already proven')) return false
  if (err instanceof AttestationError) return true
  if (message.includes('not in the circuit table')) return true
  if (message.includes('failed assert')) return true
  return false
}

/**
 * Prove the Accio record onto the career card.
 * A fact the report does not contain (no endorsements, no med card) is skipped.
 * A failed proof does not stop the others.
 * `alreadySettled` facts are left alone — proved earlier, or permanently skipped.
 */
export async function proveCompletedMvrFacts(
  userId: string,
  deps?: { resolve?: ResolveFn; prove?: ProveFn; alreadySettled?: readonly ShippedFactType[] },
): Promise<MvrFactProveResult> {
  const resolve = deps?.resolve ?? resolveAttestationFact
  const prove = deps?.prove ?? ((input: AttestationInput) => attestationService.proveFact(input))
  const settled = new Set(deps?.alreadySettled ?? [])
  const proven: ShippedFactType[] = []
  const skipped: ShippedFactType[] = []
  const failed: ShippedFactType[] = []

  for (const factType of MVR_CARD_FACTS) {
    if (settled.has(factType)) continue
    const input: AttestationInput = { candidateUserId: userId, factType }
    try {
      await resolve(input)
    } catch (err) {
      if (isPermanentFactFailure(err)) {
        if (!(err instanceof AttestationError)) {
          console.warn('[MVR PROOF] resolve', factType, err)
        }
        skipped.push(factType)
      } else {
        console.warn('[MVR PROOF] resolve', factType, err)
        failed.push(factType)
      }
      continue
    }

    try {
      await prove(input)
      proven.push(factType)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.warn('[MVR PROOF]', factType, message)
      if (message.includes('pull already proven')) {
        console.warn(`[MVR PROOF] ${factType} is on chain with no database row`)
      }
      if (isPermanentFactFailure(err)) skipped.push(factType)
      else failed.push(factType)
    }
  }

  return { proven, skipped, failed }
}
