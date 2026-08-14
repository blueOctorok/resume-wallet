import { describe, expect, it } from 'vitest'
import {
  classLetterToCode,
  endorsementMaskFromCodes,
  expirationToYmd,
  restrictionMaskFromCodes,
} from '@/lib/mvr-field-predicate'

describe('mvr-field-predicate', () => {
  it('encodes class letters as ASCII', () => {
    expect(classLetterToCode('A')).toBe(65)
    expect(classLetterToCode('b')).toBe(66)
    expect(() => classLetterToCode('Class A')).toThrow(/A–Z/)
  })

  it('builds endorsement masks from letters or Accio words', () => {
    expect(endorsementMaskFromCodes(['H', 'N'])).toBe(1 | 2)
    expect(endorsementMaskFromCodes(['Hazmat', 'Tanker'])).toBe(1 | 2)
    expect(() => endorsementMaskFromCodes([])).toThrow(/empty/)
    expect(() => endorsementMaskFromCodes(['Q'])).toThrow(/circuit table/)
  })

  it('allows an empty restriction mask for none', () => {
    expect(restrictionMaskFromCodes([])).toBe(0)
    expect(restrictionMaskFromCodes(['L', 'Z'])).toBe((1 << 7) | (1 << 14))
  })

  it('parses med-cert expiration to YYYYMMDD', () => {
    expect(expirationToYmd('2027-06-01')).toBe(20270601)
    expect(expirationToYmd('')).toBeNull()
  })
})
