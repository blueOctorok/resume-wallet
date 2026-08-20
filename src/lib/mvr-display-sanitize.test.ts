import { describe, expect, it } from 'vitest'
import {
  collapseCumulativePipeField,
  formatDisplayGender,
  formatPhoneForDotForm,
  hasDmvPersonalCharacteristics,
  isPlaceholderPhone,
  isUnknownGender,
  resolveDisplayPhone,
  sanitizeSubjectGender,
  sanitizeSubjectPhone,
} from './mvr-display-sanitize'

describe('mvr-display-sanitize', () => {
  it('detects Accio placeholder phones', () => {
    expect(isPlaceholderPhone('555-555-5555')).toBe(true)
    expect(isPlaceholderPhone('5555555555')).toBe(true)
    expect(isPlaceholderPhone('(555) 555-5555')).toBe(true)
    expect(isPlaceholderPhone('704-555-1234')).toBe(false)
    expect(isPlaceholderPhone('')).toBe(false)
  })

  it('strips placeholder phone and unknown gender', () => {
    expect(sanitizeSubjectPhone('555-555-5555')).toBeUndefined()
    expect(sanitizeSubjectPhone('704-555-1234')).toBe('704-555-1234')
    expect(sanitizeSubjectGender('U')).toBeUndefined()
    expect(sanitizeSubjectGender('M')).toBe('M')
  })

  it('formats Accio/MVR phones for DOT Form 1', () => {
    expect(formatPhoneForDotForm('(216) 314-6034')).toBe('(216) 314-6034')
    expect(formatPhoneForDotForm('2163146034')).toBe('(216) 314-6034')
    expect(formatPhoneForDotForm('12163146034')).toBe('(216) 314-6034')
    expect(formatPhoneForDotForm('555-555-5555')).toBe('')
    expect(formatPhoneForDotForm('')).toBe('')
  })

  it('resolves display phone from profile when subject is placeholder', () => {
    expect(resolveDisplayPhone('555-555-5555', '828-555-0100')).toBe('828-555-0100')
    expect(resolveDisplayPhone('704-555-1234', '828-555-0100')).toBe('704-555-1234')
  })

  it('formats known genders for display', () => {
    expect(formatDisplayGender('M')).toBe('Male')
    expect(formatDisplayGender('F')).toBe('Female')
    expect(formatDisplayGender('U')).toBeUndefined()
    expect(isUnknownGender('unknown')).toBe(true)
  })

  it('requires DMV fields for personal characteristics section (not age alone)', () => {
    expect(hasDmvPersonalCharacteristics({ age: 61 })).toBe(false)
    expect(hasDmvPersonalCharacteristics({ age: 61, height: '5-10' })).toBe(true)
  })

  it('collapses WI-style cumulative pipe-delimited restriction chains', () => {
    const wiChain =
      'E- No Manual Trans Equip CMV | E- No Manual Trans Equip CMV- H- Restriction: Use Of H | E- No Manual Trans Equip CMV- H- Restriction: Use Of H- Corr Lenses'
    expect(collapseCumulativePipeField(wiChain)).toBe(
      'E- No Manual Trans Equip CMV- H- Restriction: Use Of H- Corr Lenses',
    )
  })
})
