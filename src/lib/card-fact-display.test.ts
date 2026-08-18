import { describe, expect, it } from 'vitest'
import { formatCardFactLabel, isMidnightPredicateProof } from '@/lib/card-fact-display'

describe('card-fact-display', () => {
  it('detects predicate-enforced Midnight proofs only', () => {
    expect(isMidnightPredicateProof({ kind: 'midnight_zk', predicateEnforced: true })).toBe(true)
    expect(isMidnightPredicateProof({ kind: 'midnight_zk' })).toBe(false)
    expect(isMidnightPredicateProof({ kind: 'signed_jwt' })).toBe(false)
  })

  it('formats billboard facts as short headlines', () => {
    expect(formatCardFactLabel('cdl_class', { class: 'A' }, 'License class')).toBe('Class A')
    expect(
      formatCardFactLabel('cdl_endorsements', { endorsements: 'T-DOUBLE TRIPLE TRAILER' }, ''),
    ).toBe('Doubles')
    expect(formatCardFactLabel('cdl_restrictions', { restrictions: 'none' }, '')).toBe(
      'No restrictions',
    )
    expect(formatCardFactLabel('med_cert_valid', { expiration: '2027-02-19' }, '')).toBe(
      'Med · Feb 2027',
    )
  })
})
