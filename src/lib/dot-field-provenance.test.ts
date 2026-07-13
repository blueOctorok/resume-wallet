import { describe, expect, it } from 'vitest'
import {
  buildMvrForm1Provenance,
  getForm1ValueAtPath,
  getLockedPaths,
  mergeMvrPrefillIntoForm1,
  mergeMvrRowsIntoForm2,
  projectLockedFieldsOntoForm1,
  setForm1ValueAtPath,
} from '@/lib/dot-field-provenance'

describe('dot-field-provenance', () => {
  const mvrForm1 = {
    firstName: 'Jane',
    middleName: 'Q',
    lastName: 'Driver',
    dateOfBirth: '1985-03-15',
    phone: '555-0100',
    email: '',
    currentLicenses: [
      {
        state: 'OH',
        licenseNumber: 'DL123',
        typeClass: 'CDL-A',
        endorsements: 'H',
        expirationDate: '2028-01-01',
      },
    ],
    currentMailing: { street: '1 Main', city: 'Columbus', state: 'OH', zipCode: '43215' },
  }

  it('reads and writes dotted license paths', () => {
    expect(getForm1ValueAtPath(mvrForm1, 'currentLicenses.0.licenseNumber')).toBe('DL123')
    const next = setForm1ValueAtPath(mvrForm1, 'currentLicenses.0.licenseNumber', 'HACKED')
    expect(getForm1ValueAtPath(next, 'currentLicenses.0.licenseNumber')).toBe('HACKED')
    expect(getForm1ValueAtPath(mvrForm1, 'currentLicenses.0.licenseNumber')).toBe('DL123')
  })

  it('builds provenance only for non-empty MVR values', () => {
    const provenance = buildMvrForm1Provenance(mvrForm1, {
      mvrResultId: 'res-1',
      orderId: 'ord-1',
      accioOrderNumber: 'ACC-9',
      asOf: '2026-07-01T00:00:00.000Z',
    })
    expect(provenance.fields.firstName?.value).toBe('Jane')
    expect(provenance.fields['currentLicenses.0.state']?.accioOrderNumber).toBe('ACC-9')
    expect(getLockedPaths(provenance).has('dateOfBirth')).toBe(true)
  })

  it('projects locked values over tampered form1 on save', () => {
    const provenance = buildMvrForm1Provenance(mvrForm1, {
      mvrResultId: 'res-1',
      asOf: '2026-07-01T00:00:00.000Z',
    })
    const tampered = {
      firstName: 'Hacker',
      lastName: 'Driver',
      dateOfBirth: '1070-01-01',
      socialSecurity: '111-22-3333',
      currentLicenses: [
        {
          state: 'XX',
          licenseNumber: 'FAKE',
          typeClass: 'CDL-A',
          endorsements: 'H',
          expirationDate: '2028-01-01',
        },
      ],
    }
    const projected = projectLockedFieldsOntoForm1(tampered, provenance)
    expect(projected.firstName).toBe('Jane')
    expect(projected.dateOfBirth).toBe('1985-03-15')
    expect(getForm1ValueAtPath(projected, 'currentLicenses.0.licenseNumber')).toBe('DL123')
    // Self-reported field preserved
    expect(projected.socialSecurity).toBe('111-22-3333')
    expect((projected._fieldProvenance as { version: number }).version).toBe(1)
  })

  it('merge preserves existing SSN and soft-fills empty phone', () => {
    const provenance = buildMvrForm1Provenance(mvrForm1, {
      mvrResultId: 'res-1',
      asOf: '2026-07-01T00:00:00.000Z',
    })
    const existing = {
      firstName: 'Old',
      socialSecurity: '999-88-7777',
      phone: '',
      positionAppliedFor: 'OTR',
    }
    const merged = mergeMvrPrefillIntoForm1(existing, mvrForm1, provenance)
    expect(merged.firstName).toBe('Jane')
    expect(merged.socialSecurity).toBe('999-88-7777')
    expect(merged.phone).toBe('555-0100')
    expect(merged.positionAppliedFor).toBe('OTR')
  })

  it('Form 2 late-MVR overwrites MVR rows and keeps self disclosures', () => {
    const existing = {
      accidents: [
        {
          date: '2020-01-01',
          nature: 'Driver typed this',
          fatalities: '',
          injuries: '',
          chemicalSpills: '',
          atFault: 'no',
          _source: 'self' as const,
        },
        {
          date: '2019-01-01',
          nature: 'Stale MVR row',
          fatalities: '',
          injuries: '',
          chemicalSpills: '',
          atFault: '',
          _source: 'mvr' as const,
        },
      ],
      convictions: [],
    }
    const mvrAccidents = [
      {
        date: '2021-06-15',
        nature: 'Rear-end',
        fatalities: '',
        injuries: '',
        chemicalSpills: '',
        atFault: 'yes',
        _source: 'mvr' as const,
        _mvrKey: 'a:1',
      },
    ]
    const merged = mergeMvrRowsIntoForm2(existing, mvrAccidents, [], {
      mvrResultId: 'res-1',
      accioOrderNumber: 'ACC-1',
      asOf: '2026-07-01T00:00:00.000Z',
    })
    expect(merged.accidents).toHaveLength(2)
    expect(merged.accidents?.[0]?._source).toBe('mvr')
    expect(merged.accidents?.[0]?.nature).toBe('Rear-end')
    expect(merged.accidents?.[1]?._source).toBe('self')
    expect(merged.accidents?.[1]?.nature).toBe('Driver typed this')
    expect(merged._rowProvenance?.mvrAccidentCount).toBe(1)
    expect(merged.hasNoAccidents).toBe(false)
  })
})
