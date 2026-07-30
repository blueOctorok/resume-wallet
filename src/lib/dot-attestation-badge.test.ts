import { describe, it, expect } from 'vitest'
import {
  matchMvrAttestation,
  matchEmploymentAttestation,
  resolveMvrFieldDotBadge,
  resolveMvrRowDotBadge,
  resolveEmploymentDotBadge,
  type AttestationBadgeSummary,
} from '@/lib/dot-attestation-badge'
import type { DotFieldProvenanceEntry } from '@/lib/dot-field-provenance'

const jwtMvr = (pull: string | null): AttestationBadgeSummary => ({
  factType: 'mvr_clean_36_months',
  proofKind: 'signed_jwt',
  sourceCra: 'accio',
  sourcePullId: pull,
  issuedAt: '2026-07-01T12:00:00.000Z',
})

const midnightMvr = (pull: string | null): AttestationBadgeSummary => ({
  factType: 'mvr_clean_36_months',
  proofKind: 'midnight_zk',
  provenanceTier: 'metadata',
  sourceCra: 'accio',
  sourcePullId: pull,
  issuedAt: '2026-07-01T12:00:00.000Z',
  txHash: 'tx-abc',
})

const midnightMvrIssuerSigned = (pull: string | null): AttestationBadgeSummary => ({
  ...midnightMvr(pull),
  provenanceTier: 'issuer_signed',
})

const entry = (order: string | null, accio: string | null): DotFieldProvenanceEntry => ({
  path: 'firstName',
  source: 'mvr',
  mvrResultId: 'res-1',
  orderId: order,
  accioOrderNumber: accio,
  asOf: '2026-06-15T00:00:00.000Z',
  value: 'Jane',
})

describe('matchMvrAttestation', () => {
  it('matches by source_pull_id to accio order number', () => {
    const hit = matchMvrAttestation([jwtMvr('ACC-9'), jwtMvr('OTHER')], {
      orderId: null,
      accioOrderNumber: 'ACC-9',
    })
    expect(hit?.sourcePullId).toBe('ACC-9')
  })

  it('matches by orderId', () => {
    const hit = matchMvrAttestation([jwtMvr('ord-uuid')], {
      orderId: 'ord-uuid',
      accioOrderNumber: 'ACC-9',
    })
    expect(hit?.sourcePullId).toBe('ord-uuid')
  })

  it('falls back to single MVR attestation when pull ids miss', () => {
    const hit = matchMvrAttestation([jwtMvr('unrelated')], {
      orderId: 'ord-1',
      accioOrderNumber: 'ACC-1',
    })
    // only one MVR — still unambiguous fallback per plan
    expect(hit?.sourcePullId).toBe('unrelated')
  })

  it('returns null when multiple MVR attestations and no pull match', () => {
    const hit = matchMvrAttestation([jwtMvr('a'), jwtMvr('b')], {
      orderId: 'x',
      accioOrderNumber: 'y',
    })
    expect(hit).toBeNull()
  })
})

describe('matchEmploymentAttestation', () => {
  it('matches previous_employer_verified by verification request id', () => {
    const rows: AttestationBadgeSummary[] = [
      {
        factType: 'previous_employer_verified',
        proofKind: 'signed_jwt',
        sourceCra: 'prior_employer',
        sourcePullId: 'evr-1',
        issuedAt: '2026-07-02T00:00:00.000Z',
      },
    ]
    expect(matchEmploymentAttestation(rows, { verificationRequestId: 'evr-1' })?.sourcePullId).toBe(
      'evr-1',
    )
  })
})

describe('resolveMvrFieldDotBadge', () => {
  it('keeps Accio issuer copy when no attestation', () => {
    const r = resolveMvrFieldDotBadge(entry('ord-1', 'ACC-1'), [])
    expect(r.tier).toBe('issuer_only')
    expect(r.text).toContain('Accio order #ACC-1')
    expect(r.text).not.toMatch(/Midnight|ZKnight/i)
  })

  it('uses Verified by ZKnight for signed_jwt — never Midnight', () => {
    const r = resolveMvrFieldDotBadge(entry('ord-1', 'ACC-1'), [jwtMvr('ACC-1')])
    expect(r.tier).toBe('storm_jwt')
    expect(r.text).toMatch(/^Verified by ZKnight on /)
    expect(r.text).not.toMatch(/Midnight|on-chain|(?<![Zz][Kk]night)\bZK\b/i)
    expect(r.text.toLowerCase()).not.toContain('midnight')
    expect(r.text.toLowerCase()).not.toContain('on-chain')
  })

  it('uses Verified by ZKnight for midnight_zk metadata tier — not Midnight marketing', () => {
    const r = resolveMvrFieldDotBadge(entry('ord-1', 'ACC-1'), [midnightMvr('ACC-1')])
    expect(r.tier).toBe('storm_jwt')
    expect(r.text).toMatch(/^Verified by ZKnight on /)
    expect(r.text).not.toMatch(/Proven on Midnight/i)
  })

  it('uses Proven on Midnight only for issuer_signed midnight_zk', () => {
    const r = resolveMvrFieldDotBadge(entry('ord-1', 'ACC-1'), [midnightMvrIssuerSigned('ACC-1')])
    expect(r.tier).toBe('midnight_zk')
    expect(r.text).toMatch(/^Proven on Midnight on /)
    expect(r.text).toContain('Accio')
  })
})

describe('resolveMvrRowDotBadge', () => {
  it('never upgrades PSP rows (no shipped PSP fact)', () => {
    const r = resolveMvrRowDotBadge(
      { kind: 'psp', accioOrderNumber: 'P-1', asOf: '2026-06-01T00:00:00.000Z' },
      [jwtMvr('P-1')],
    )
    expect(r.tier).toBe('issuer_only')
    expect(r.text).toContain('Accio order #P-1')
  })
})

describe('resolveEmploymentDotBadge', () => {
  it('keeps prior-employer issuer copy without attestation', () => {
    const r = resolveEmploymentDotBadge({
      status: 'VERIFIED',
      verifiedAt: '2026-07-01T00:00:00.000Z',
      verificationRequestId: 'evr-9',
    })
    expect(r.tier).toBe('issuer_only')
    expect(r.text).toContain('prior employer confirmed')
  })

  it('upgrades when EVR attestation matches', () => {
    const r = resolveEmploymentDotBadge(
      {
        status: 'VERIFIED',
        verifiedAt: '2026-07-01T00:00:00.000Z',
        verificationRequestId: 'evr-9',
      },
      [
        {
          factType: 'previous_employer_verified',
          proofKind: 'signed_jwt',
          sourceCra: 'prior_employer',
          sourcePullId: 'evr-9',
          issuedAt: '2026-07-02T00:00:00.000Z',
        },
      ],
    )
    expect(r.tier).toBe('storm_jwt')
    expect(r.text).toMatch(/^Verified by ZKnight on /)
  })
})
