import { describe, it, expect } from 'vitest'
import {
  formatAttestationProvenance,
  formatVerifiedByStormLine,
} from '@/lib/attestation-fact-ui'

describe('attestation-fact-ui', () => {
  it('formatVerifiedByStormLine combines date and CRA citation', () => {
    const line = formatVerifiedByStormLine('2026-06-01T12:00:00.000Z', 'accio', 'order-99')
    expect(line).toMatch(/^Verified by ZKnight on /)
    expect(line).toContain('Derived from Accio pull order-99')
    expect(line).not.toMatch(/on-chain|ZK|Midnight/i)
  })

  it('formatAttestationProvenance defaults to Verified by Storm', () => {
    expect(formatAttestationProvenance(null, null)).toBe('Verified by ZKnight')
  })
})
