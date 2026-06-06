import { describe, it, expect } from 'vitest'
import { AttestationError } from '@/lib/attestation-service'
import { isUuid, mapAttestationErrorToStatus } from '@/lib/attestation-route-helpers'

describe('attestation-route-helpers', () => {
  it('isUuid accepts valid v4 ids', () => {
    expect(isUuid('11111111-1111-4111-8111-111111111111')).toBe(true)
    expect(isUuid('not-a-uuid')).toBe(false)
  })

  it('mapAttestationErrorToStatus maps provenance gate to 403', () => {
    const err = new AttestationError('Provenance gate: fact "x" is self-reported and cannot be attested')
    expect(mapAttestationErrorToStatus(err)).toBe(403)
  })

  it('mapAttestationErrorToStatus maps unknown fact to 400', () => {
    const err = new AttestationError('Unknown or unsupported fact type: foo')
    expect(mapAttestationErrorToStatus(err)).toBe(400)
  })

  it('mapAttestationErrorToStatus maps attest failures to 422', () => {
    const err = new AttestationError('No completed MVR on file — cannot attest clean driving record')
    expect(mapAttestationErrorToStatus(err)).toBe(422)
  })
})
