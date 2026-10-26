import { describe, expect, it } from 'vitest'
import {
  dobForDateInput,
  mismatchFieldList,
  nameFromOrderXml,
  orderedIdentitySentence,
  whitelistIdentityPatch,
} from '@/lib/mvr-identity-correction'

describe('mvr identity correction', () => {
  it('keeps name, license, and date of birth, and drops the SSN', () => {
    expect(
      whitelistIdentityPatch({
        firstName: 'Samuel',
        lastName: 'Blaha',
        dlNumber: 'ab12345',
        ssn: '123456789',
        address: '1 Main',
      }),
    ).toEqual({
      firstName: 'Samuel',
      lastName: 'Blaha',
      dlNumber: 'ab12345',
    })
  })

  it('turns a stored YYYYMMDD into a date-input value', () => {
    expect(dobForDateInput('19820918')).toBe('1982-09-18')
    expect(dobForDateInput('1982-09-18')).toBe('1982-09-18')
    expect(dobForDateInput('not a date')).toBe('')
  })

  it('names the fields the state rejected without repeating the value in parentheses', () => {
    expect(
      mismatchFieldList([
        'Order parameter Last name (SMITH) did not match',
        'Order parameter Date of Birth (01-01-1987) did not match',
      ]),
    ).toEqual(['last name', 'date of birth'])
  })

  it('puts the ordered name and license on one sentence and leaves the SSN out of the XML read', () => {
    const xml = '<subject><name_first>Sam</name_first><name_last>Blaha</name_last><ssn>123456789</ssn></subject>'
    const name = nameFromOrderXml(xml)
    expect(name).toEqual({ firstName: 'Sam', lastName: 'Blaha' })
    expect(JSON.stringify(name)).not.toContain('123456789')

    expect(
      orderedIdentitySentence({
        firstName: name.firstName,
        lastName: name.lastName,
        dlNumber: 'AB12345',
        dlState: 'OH',
        alerts: ['Order parameter Last name (BLAHA) did not match'],
      }),
    ).toBe('State could not match last name. Ordered as Sam Blaha · DL AB12345 · OH')
  })
})
