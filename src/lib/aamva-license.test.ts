import { describe, expect, it } from 'vitest'
import { aamvaDate, parseAamvaLicense } from '@/lib/aamva-license'
import { softFillForm1FromLicense } from '@/lib/apply-license-scan'
import type { DotForm1FieldProvenance } from '@/lib/dot-field-provenance'

const SAMPLE = [
  '@',
  'ANSI 636023080102DL00410288ZA03290015DL',
  'DAQD1234567',
  'DCSDOE',
  'DACJOHN',
  'DADQUINCY',
  'DBB01151990',
  'DBA01152028',
  'DCAA',
  'DCBNONE',
  'DCDH N',
  'DAJOH',
  'DAG123 MAIN ST',
  'DAICOLUMBUS',
  'DAK432150000',
].join('\n')

describe('parseAamvaLicense', () => {
  it('reads the card fields and treats NONE as no restriction', () => {
    const fields = parseAamvaLicense(SAMPLE)
    expect(fields).toMatchObject({
      firstName: 'John',
      middleName: 'Quincy',
      lastName: 'Doe',
      dateOfBirth: '1990-01-15',
      expirationDate: '2028-01-15',
      licenseNumber: 'D1234567',
      state: 'OH',
      licenseClass: 'A',
      endorsements: ['H', 'N'],
      restrictions: [],
      street: '123 Main St',
      city: 'Columbus',
      postalCode: '43215',
    })
  })

  it('returns null when the string is not a license barcode', () => {
    expect(parseAamvaLicense('hello')).toBeNull()
  })
})

describe('aamvaDate', () => {
  it('prefers MMDDCCYY when the first two digits are a month', () => {
    expect(aamvaDate('01151990')).toBe('1990-01-15')
  })

  it('accepts YYYYMMDD when the first four digits are a year', () => {
    expect(aamvaDate('19900115')).toBe('1990-01-15')
  })
})

describe('softFillForm1FromLicense', () => {
  const fields = parseAamvaLicense(SAMPLE)!

  it('fills empty license fields and leaves an MVR-locked name alone', () => {
    const provenance: DotForm1FieldProvenance = {
      version: 1,
      fields: {
        firstName: {
          path: 'firstName',
          source: 'mvr',
          mvrResultId: 'mvr-1',
          orderId: null,
          accioOrderNumber: 'ACC-1',
          asOf: '2026-01-01',
          value: 'Jane',
        },
      },
    }
    const { form1, filled } = softFillForm1FromLicense(
      { firstName: 'Jane', _fieldProvenance: provenance },
      fields,
    )
    expect(form1.firstName).toBe('Jane')
    expect((form1.currentLicenses as Array<{ licenseNumber: string; typeClass: string }>)[0]).toMatchObject({
      licenseNumber: 'D1234567',
      typeClass: 'Class A',
      state: 'OH',
    })
    expect(filled).toContain('License number')
    expect(filled).not.toContain('First name')
  })

  it('replaces a license number the driver typed and stamps the license as the source', () => {
    const { form1 } = softFillForm1FromLicense(
      { currentLicenses: [{ licenseNumber: 'KEEPME', state: '', typeClass: '', endorsements: '', expirationDate: '' }] },
      fields,
    )
    const license = (form1.currentLicenses as Array<{ licenseNumber: string; state: string }>)[0]
    expect(license.licenseNumber).toBe('D1234567')
    expect(license.state).toBe('OH')
    expect(form1._fieldProvenance?.fields?.['currentLicenses.0.licenseNumber']?.source).toBe('license')
  })
})
