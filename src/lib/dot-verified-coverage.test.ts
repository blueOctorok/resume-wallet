import { describe, expect, it } from 'vitest'
import { computeDotVerifiedCoverage } from '@/lib/dot-verified-coverage'
import { buildMvrForm1Provenance, mergeMvrRowsIntoForm2 } from '@/lib/dot-field-provenance'

describe('computeDotVerifiedCoverage', () => {
  it('returns 0% when forms are empty', () => {
    const c = computeDotVerifiedCoverage(null, null)
    expect(c.totalCount).toBe(0)
    expect(c.percent).toBe(0)
    expect(c.majorityVerified).toBe(false)
  })

  it('counts Form 1 lock paths; verified only with provenance', () => {
    const form1 = {
      firstName: 'Jason',
      lastName: 'Peterson',
      dateOfBirth: '1970-01-05',
      currentLicenses: [
        {
          state: 'OH',
          licenseNumber: 'RL194049',
          typeClass: 'B',
          endorsements: '',
          expirationDate: '2029-01-05',
        },
      ],
    }
    const without = computeDotVerifiedCoverage(form1, null)
    expect(without.verifiedCount).toBe(0)
    // first + last + DOB + state + number + class + expiry (empty endorsements skipped)
    expect(without.totalCount).toBe(7)

    const provenance = buildMvrForm1Provenance(form1, {
      mvrResultId: 'r1',
      asOf: '2026-07-01T00:00:00.000Z',
      accioOrderNumber: 'ACC-1',
    })
    const withProv = computeDotVerifiedCoverage(
      { ...form1, _fieldProvenance: provenance },
      null,
    )
    expect(withProv.verifiedCount).toBe(withProv.totalCount)
    expect(withProv.percent).toBe(100)
    expect(withProv.majorityVerified).toBe(true)
  })

  it('mixes MVR and self Form 2 rows in the denominator', () => {
    const merged = mergeMvrRowsIntoForm2(
      {
        accidents: [
          {
            date: '2020-01-01',
            nature: 'Self reported',
            fatalities: '',
            injuries: '',
            chemicalSpills: '',
            atFault: 'no',
            _source: 'self',
          },
        ],
        // Seed a self conviction so hasNoConvictions stays false (no clean-record bonus)
        convictions: [
          {
            dateConvicted: '2019-03-01',
            violation: 'Self reported',
            stateOfViolation: 'OH',
            penalty: '',
            _source: 'self',
          },
        ],
      },
      [
        {
          date: '2021-06-15',
          nature: 'Rear-end',
          fatalities: '',
          injuries: '',
          chemicalSpills: '',
          atFault: 'yes',
          _source: 'mvr',
          _mvrKey: 'a1',
        },
      ],
      [
        {
          dateConvicted: '2022-01-10',
          violation: 'SPEED',
          stateOfViolation: 'OH',
          penalty: '',
          _source: 'mvr',
          _mvrKey: 'c1',
        },
      ],
      { mvrResultId: 'r1', asOf: '2026-07-01T00:00:00.000Z', accioOrderNumber: 'ACC-1' },
    )
    const c = computeDotVerifiedCoverage(null, merged)
    // 2 MVR rows + 2 self rows = 4; verified = 2
    expect(c.totalCount).toBe(4)
    expect(c.verifiedCount).toBe(2)
    expect(c.percent).toBe(50)
    expect(c.majorityVerified).toBe(false)
  })
})
