import { describe, expect, it } from 'vitest'
import {
  formatCompanyMailingAddress,
  formatFreeformPostalAddress,
  formatPostalAddress,
  titleCaseForm1Names,
  titleCaseName,
} from '@/lib/dot-application-format'

describe('titleCaseName', () => {
  it('prints an all-caps first name with one capital letter', () => {
    expect(titleCaseName('BRIAN')).toBe('Brian')
    expect(titleCaseName('BRIAN SMITH')).toBe('Brian Smith')
  })

  it('keeps a hyphen or apostrophe as a word break', () => {
    expect(titleCaseName("MARY-JANE")).toBe('Mary-Jane')
    expect(titleCaseName("O'BRIEN")).toBe("O'Brien")
  })
})

describe('titleCaseForm1Names', () => {
  it('corrects only the name fields', () => {
    expect(
      titleCaseForm1Names({
        firstName: 'BRIAN',
        middleName: 'Adam',
        lastName: 'HARRISON',
        email: 'BRIAN@EXAMPLE.COM',
      }),
    ).toEqual({
      firstName: 'Brian',
      middleName: 'Adam',
      lastName: 'Harrison',
      email: 'BRIAN@EXAMPLE.COM',
    })
  })
})

describe('formatPostalAddress', () => {
  it('puts the street on its own line', () => {
    expect(
      formatPostalAddress({
        street: '293 Vernon White Rd',
        city: 'Winterville',
        state: 'NC',
        zipCode: '28590',
      }),
    ).toBe('293 Vernon White Rd\nWinterville, NC 28590')
  })

  it('breaks a typed employer address after the street', () => {
    expect(formatFreeformPostalAddress('293 Vernon White Rd, Winterville, NC 28590')).toBe(
      '293 Vernon White Rd\nWinterville, NC 28590',
    )
  })
})

describe('formatCompanyMailingAddress', () => {
  it('joins the street to city, state, and zip', () => {
    expect(
      formatCompanyMailingAddress({
        address_street: '34940 Ridge Rd Ste 7',
        address_city: 'Willoughby',
        address_state: 'OH',
        address_zip: '44094',
      }),
    ).toBe('34940 Ridge Rd Ste 7, Willoughby, OH 44094')
  })

  it('returns null when the company has no address', () => {
    expect(formatCompanyMailingAddress({ address_street: null, address_city: null, address_state: null, address_zip: null })).toBeNull()
    expect(formatCompanyMailingAddress(null)).toBeNull()
  })
})
