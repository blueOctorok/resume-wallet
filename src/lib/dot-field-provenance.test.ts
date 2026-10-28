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
    const licenseState = provenance.fields['currentLicenses.0.state']
    expect(licenseState?.source).toBe('mvr')
    expect(licenseState?.source === 'mvr' ? licenseState.accioOrderNumber : null).toBe('ACC-9')
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

  it('replaces a license stamp with the MVR even when the name matches', () => {
    const provenance = buildMvrForm1Provenance(
      { ...mvrForm1, middleName: '' },
      { mvrResultId: 'res-1', asOf: '2026-07-01T00:00:00.000Z' },
    )
    const existing = {
      firstName: 'Jane',
      middleName: 'Quincy',
      _fieldProvenance: {
        version: 1 as const,
        fields: {
          firstName: {
            path: 'firstName' as const,
            source: 'license' as const,
            asOf: '2026-06-01T00:00:00.000Z',
            value: 'Jane',
          },
          middleName: {
            path: 'middleName' as const,
            source: 'license' as const,
            asOf: '2026-06-01T00:00:00.000Z',
            value: 'Quincy',
          },
        },
      },
    }
    const merged = mergeMvrPrefillIntoForm1(existing, { ...mvrForm1, middleName: '' }, provenance)
    expect(merged.firstName).toBe('Jane')
    expect(merged._fieldProvenance?.fields?.firstName?.source).toBe('mvr')
    expect(merged.middleName).toBe('Quincy')
    expect(merged._fieldProvenance?.fields?.middleName?.source).toBe('license')
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

  it('drops driving-record accidents and convictions and keeps what the driver typed', () => {
    const merged = mergeMvrRowsIntoForm2(
      {
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
        convictions: [
          {
            dateConvicted: '03/2024',
            violation: 'SPEED',
            stateOfViolation: 'OH',
            penalty: '2 pts',
            _source: 'mvr' as const,
          },
        ],
        hasNoAccidents: false,
      },
      [
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
      ],
      [],
      {
        mvrResultId: 'res-1',
        accioOrderNumber: 'ACC-1',
        asOf: '2026-07-01T00:00:00.000Z',
      },
    )
    expect(merged.accidents).toEqual([
      expect.objectContaining({ nature: 'Driver typed this', _source: 'self' }),
    ])
    expect(merged.convictions?.[0]?.violation).toBe('')
    expect(merged.convictions?.[0]?._source).toBe('self')
    expect(merged.hasNoAccidents).toBe(false)
    expect(merged.hasNoConvictions).toBe(false)
    expect(merged._rowProvenance?.mvrAccidentCount).toBe(0)
    expect(merged._rowProvenance?.mvrConvictionCount).toBe(0)
  })
})
