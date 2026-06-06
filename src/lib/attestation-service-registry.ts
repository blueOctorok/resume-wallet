import type { AttestationService } from '@/lib/attestation-service'
import { AttestationError } from '@/lib/attestation-service'
import { resolveAttestationFact } from '@/lib/fact-registry'
import { createSignedJwtAttestationService } from '@/lib/signed-jwt-attestation-service'

let cachedService: AttestationService | null = null

function resolveImplementation(): AttestationService {
  if (process.env.ATTESTATION_BACKEND === 'midnight') {
    throw new AttestationError(
      'ATTESTATION_BACKEND=midnight is not available until Phase 3'
    )
  }

  if (!cachedService) {
    cachedService = createSignedJwtAttestationService({
      resolveFact: resolveAttestationFact,
    })
  }

  return cachedService
}

/** Swappable attestation backend — import this, never the signed-JWT impl directly. */
export const attestationService: AttestationService = {
  proveFact: (input) => resolveImplementation().proveFact(input),
  verifyAttestation: (attestation) =>
    resolveImplementation().verifyAttestation(attestation),
}
