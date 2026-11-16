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
    expect(restrictionMaskFromCodes(['A-NONE'])).toBe(0)
    expect(restrictionMaskFromCodes(['NONE'])).toBe(0)
  })

  it('maps Accio wording onto the federal letters the circuit already has', () => {
    expect(restrictionMaskFromCodes(['NO MANUAL TRANSMISSION EQUIPPED CMV'])).toBe(1 << 3)
    expect(restrictionMaskFromCodes(['CORRECTIVE LENSES'])).toBe(1 << 0)
    expect(restrictionMaskFromCodes(['A-CORRECTIVE LENS'])).toBe(1 << 0)
    expect(restrictionMaskFromCodes(['B-CORRECTIVE LENSES | E-AUTO TRANSMISSION CMV'])).toBe(
      (1 << 0) | (1 << 3),
    )
    expect(restrictionMaskFromCodes(['NO CLASS A PASSENGER VEHICLE'])).toBe(1 << 8)
    expect(restrictionMaskFromCodes(['CDL INTRASTATE ONLY'])).toBe(1 << 6)
    expect(() => restrictionMaskFromCodes(['A'])).toThrow(/circuit table/)
    expect(() => restrictionMaskFromCodes(['OTHER: UNSPECIFIED'])).toThrow(/circuit table/)
    expect(() => restrictionMaskFromCodes(['YES'])).toThrow(/circuit table/)
  })

  it('parses med-cert expiration to YYYYMMDD', () => {
    expect(expirationToYmd('2027-06-01')).toBe(20270601)
    expect(expirationToYmd('')).toBeNull()
  })
})
