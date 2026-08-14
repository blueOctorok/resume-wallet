import type { Attestation, AttestationService } from '@/lib/attestation-service'
import { resolveAttestationFact } from '@/lib/fact-registry'
import { createSignedJwtAttestationService } from '@/lib/signed-jwt-attestation-service'
import { createMidnightAttestationService } from '@/lib/midnight-attestation-service'

let cachedJwt: AttestationService | null = null
let cachedMidnight: AttestationService | null = null

function jwtService(): AttestationService {
  if (!cachedJwt) {
    cachedJwt = createSignedJwtAttestationService({
      resolveFact: resolveAttestationFact,
    })
  }
  return cachedJwt
}

function midnightService(): AttestationService {
  if (!cachedMidnight) {
    cachedMidnight = createMidnightAttestationService()
  }
  return cachedMidnight
}

function proveBackend(): AttestationService {
  return process.env.ATTESTATION_BACKEND === 'midnight' ? midnightService() : jwtService()
}

/** Verify follows the artifact already on the row — not the current prove env. */
function verifyBackend(attestation: Attestation): AttestationService {
  return attestation.proof.kind === 'midnight_zk' ? midnightService() : jwtService()
}

/** Swappable attestation backend — import this, never the signed-JWT impl directly. */
export const attestationService: AttestationService = {
  proveFact: (input) => proveBackend().proveFact(input),
  verifyAttestation: (attestation) => verifyBackend(attestation).verifyAttestation(attestation),
}
