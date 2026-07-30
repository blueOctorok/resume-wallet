import { describe, it, expect } from 'vitest'
import {
  formatAttestationProvenance,
  formatAttestationVerificationLine,
  formatAttestationVerifyDetails,
  formatVerifiedByStormLine,
  provenanceTierFromProof,
} from '@/lib/attestation-fact-ui'

describe('attestation-fact-ui', () => {
  it('formatVerifiedByStormLine combines date and CRA citation', () => {
    const line = formatVerifiedByStormLine('2026-06-01T12:00:00.000Z', 'accio', 'order-99')
    expect(line).toMatch(/^Verified by ZKnight on /)
    expect(line).toContain('Derived from Accio pull order-99')
    expect(line).not.toMatch(/on-chain|(?<![Zz][Kk]night)\bZK\b|Midnight/i)
  })

  it('formatAttestationProvenance defaults to Verified by Storm', () => {
    expect(formatAttestationProvenance(null, null)).toBe('Verified by ZKnight')
  })

  it('gates Midnight copy until issuer_signed', () => {
    const metadata = formatAttestationVerificationLine({
      issuedAt: '2026-06-01T12:00:00.000Z',
      sourceCra: 'accio',
      sourcePullId: 'order-99',
      proofKind: 'midnight_zk',
      provenanceTier: 'metadata',
      txHash: 'tx-1',
    })
    expect(metadata).toMatch(/^Verified by ZKnight on /)
    expect(metadata).not.toMatch(/Midnight/i)

    const issuerSigned = formatAttestationVerificationLine({
      issuedAt: '2026-06-01T12:00:00.000Z',
      sourceCra: 'accio',
      sourcePullId: 'order-99',
      proofKind: 'midnight_zk',
      provenanceTier: 'issuer_signed',
    })
    expect(issuerSigned).toMatch(/^Proven on Midnight on /)
  })

  it('verify details show tx without trust-the-math until issuer_signed', () => {
    const lines = formatAttestationVerifyDetails({
      issuedAt: '2026-06-01T12:00:00.000Z',
      proofKind: 'midnight_zk',
      provenanceTier: 'metadata',
      txHash: 'tx-abc',
      proofId: 'tx-abc',
    })
    expect(lines.some((l) => l.includes('tx-abc'))).toBe(true)
    expect(lines.some((l) => l.includes('P3.4-B'))).toBe(true)
    expect(lines.join(' ')).not.toMatch(/trust the math/i)
  })

  it('provenanceTierFromProof defaults midnight_zk to metadata', () => {
    expect(
      provenanceTierFromProof({ kind: 'midnight_zk', txHash: 'a', proofId: 'a' }),
    ).toBe('metadata')
  })
})
