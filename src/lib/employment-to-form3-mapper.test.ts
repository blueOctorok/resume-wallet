import { describe, expect, it } from 'vitest'
import { mergeVerifiedEmployersIntoForm3 } from '@/lib/employment-form3-provenance'
import {
  evrDateToForm3MonthYear,
  employmentMatchKey,
  mapEvrToForm3Employer,
} from '@/lib/employment-to-form3-mapper'

describe('employment → Form 3', () => {
  it('converts EVR dates to MM/YYYY', () => {
    expect(evrDateToForm3MonthYear('2020-06-15')).toBe('06/2020')
    expect(evrDateToForm3MonthYear('20200615')).toBe('06/2020')
    expect(evrDateToForm3MonthYear('Present')).toBe('Present')
  })

  it('maps EVR to a verified Form 3 employer row', () => {
    const row = mapEvrToForm3Employer({
      id: 'evr-1',
      employment_id: 'emp-1',
      previous_employer_name: 'Acme Trucking',
      claimed_position: 'CDL Driver',
      claimed_start_date: '2019-01-01',
      claimed_end_date: '2022-12-01',
      verified_at: '2026-07-01T00:00:00.000Z',
      status: 'VERIFIED',
    })
    expect(row._source).toBe('verified')
    expect(row.name).toBe('Acme Trucking')
    expect(row.fromDate).toBe('01/2019')
    expect(row.id).toBe('emp-1')
  })

  it('locks matched self rows and keeps unmatched self rows open', () => {
    const merged = mergeVerifiedEmployersIntoForm3(
      {
        employers: [
          {
            id: 'emp-1',
            name: 'Acme Trucking',
            phone: '555-0100',
            email: '',
            address: '1 Main St',
            positionHeld: 'Driver',
            fromDate: '01/2019',
            toDate: '12/2022',
            reasonForLeaving: 'Better opportunity',
            subjectToFMCSR: 'yes',
            safetySensitiveFunction: 'yes',
            isUnemployment: false,
            _source: 'self',
          },
          {
            id: 'emp-2',
            name: 'Side Gig LLC',
            phone: '',
            email: '',
            address: '',
            positionHeld: 'Helper',
            fromDate: '01/2023',
            toDate: 'Present',
            reasonForLeaving: '',
            subjectToFMCSR: 'no',
            safetySensitiveFunction: 'no',
            isUnemployment: false,
            _source: 'self',
          },
        ],
      },
      [
        {
          id: 'evr-1',
          employment_id: 'emp-1',
          previous_employer_name: 'Acme Trucking',
          claimed_position: 'CDL-A Driver',
          claimed_start_date: '2019-01-01',
          claimed_end_date: '2022-12-01',
          verified_at: '2026-07-01T00:00:00.000Z',
          status: 'VERIFIED',
        },
      ],
    )

    const employers = merged.employers ?? []
    expect(employers).toHaveLength(2)
    const verified = employers.find((e) => e._source === 'verified')
    const self = employers.find((e) => e._source === 'self')
    expect(verified?.positionHeld).toBe('CDL-A Driver') // EVR overwrites position
    expect(verified?.phone).toBe('555-0100') // preserved from self
    expect(verified?.address).toBe('1 Main St')
    expect(self?.name).toBe('Side Gig LLC')
    expect(merged._employerProvenance?.verifiedEmployerCount).toBe(1)
  })

  it('match key is case-insensitive on company', () => {
    expect(employmentMatchKey('Acme Trucking', '01/2019')).toBe(
      employmentMatchKey('acme trucking', '2019-01-15'),
    )
  })
})
