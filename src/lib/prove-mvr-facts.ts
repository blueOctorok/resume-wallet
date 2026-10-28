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

/**
 * Prove the Accio record onto the career card.
 * A fact the report does not contain (no endorsements, no med card) is skipped.
 * A failed proof does not stop the others.
 */
export async function proveCompletedMvrFacts(
  userId: string,
  deps?: { resolve?: ResolveFn; prove?: ProveFn },
): Promise<{ proven: ShippedFactType[]; skipped: ShippedFactType[] }> {
  const resolve = deps?.resolve ?? resolveAttestationFact
  const prove = deps?.prove ?? ((input: AttestationInput) => attestationService.proveFact(input))
  const proven: ShippedFactType[] = []
  const skipped: ShippedFactType[] = []

  for (const factType of MVR_CARD_FACTS) {
    const input: AttestationInput = { candidateUserId: userId, factType }
    try {
      await resolve(input)
    } catch (err) {
      if (!(err instanceof AttestationError)) {
        console.warn('[MVR PROOF] resolve', factType, err)
      }
      skipped.push(factType)
      continue
    }

    try {
      await prove(input)
      proven.push(factType)
    } catch (err) {
      console.warn('[MVR PROOF]', factType, err instanceof Error ? err.message : err)
      skipped.push(factType)
    }
  }

  return { proven, skipped }
}
