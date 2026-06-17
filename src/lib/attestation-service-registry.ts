import type { AttestationService } from '@/lib/attestation-service'
import { resolveAttestationFact } from '@/lib/fact-registry'
import { createSignedJwtAttestationService } from '@/lib/signed-jwt-attestation-service'
import { createMidnightAttestationService } from '@/lib/midnight-attestation-service'

let cachedJwt: AttestationService | null = null
let cachedMidnight: AttestationService | null = null

function resolveImplementation(): AttestationService {
  if (process.env.ATTESTATION_BACKEND === 'midnight') {
    if (!cachedMidnight) {
      cachedMidnight = createMidnightAttestationService()
    }
    return cachedMidnight
  }

  if (!cachedJwt) {
    cachedJwt = createSignedJwtAttestationService({
      resolveFact: resolveAttestationFact,
    })
  }
  return cachedJwt
}

/** Swappable attestation backend — import this, never the signed-JWT impl directly. */
export const attestationService: AttestationService = {
  proveFact: (input) => resolveImplementation().proveFact(input),
  verifyAttestation: (attestation) =>
    resolveImplementation().verifyAttestation(attestation),
}
