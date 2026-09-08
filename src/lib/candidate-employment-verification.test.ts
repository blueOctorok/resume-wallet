import { describe, expect, it } from 'vitest'
import {
  employmentDedupeKey,
  extractEvApplicantIdentity,
  form3EmployersToCandidateRows,
  isDkimVerifiedRequest,
  mergeDotForm3IntoEmployments,
  shouldCreateEvPacket,
  type CandidateEmploymentRow,
} from './candidate-employment-verification'

function driverRow(partial: Partial<CandidateEmploymentRow>): CandidateEmploymentRow {
  return {
    verificationKey: 'driver:block-1',
    source: 'driver',
    sourceLabel: 'Driver / DOT',
    id: 'block-1',
    companyName: 'First Transport Inc',
    position: 'Driver',
    startDate: '2015-01',
    endDate: '2016-02',
    ...partial,
  }
}

describe('form3EmployersToCandidateRows', () => {
  it('skips unemployment and keeps hiring manager contact', () => {
    const rows = form3EmployersToCandidateRows([
      { type: 'unemployment', name: 'Gap', fromDate: '01/2014', toDate: '12/2014' },
      {
        id: 'emp-1',
        type: 'employment',
        name: 'First Transport Inc',
        positionHeld: 'Entry Level Driver',
        fromDate: '01/2015',
        toDate: '02/2016',
        hiringManagerName: 'Pat Lee',
        hiringManagerEmail: 'pat@firsttransport.com',
        hiringManagerPhone: '(555) 111-2222',
      },
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].supervisorName).toBe('Pat Lee')
    expect(rows[0].supervisorEmail).toBe('pat@firsttransport.com')
    expect(rows[0].fromDotDraft).toBe(true)
    expect(rows[0].startDate).toBe('2015-01')
  })

  it('does not create a packet for a current job', () => {
    const rows = form3EmployersToCandidateRows([
      { type: 'employment', name: 'Now Trucking', fromDate: '01/2024', toDate: 'Present' },
    ])
    expect(rows).toHaveLength(0)
  })
})

describe('mergeDotForm3IntoEmployments', () => {
  it('enriches a matching driver row instead of duplicating', () => {
    const merged = mergeDotForm3IntoEmployments(
      [driverRow({ supervisorEmail: undefined })],
      form3EmployersToCandidateRows([
        {
          name: 'First Transport Inc',
          fromDate: '01/2015',
          toDate: '02/2016',
          hiringManagerEmail: 'pat@firsttransport.com',
        },
      ]),
    )
    expect(merged).toHaveLength(1)
    expect(merged[0].id).toBe('block-1')
    expect(merged[0].supervisorEmail).toBe('pat@firsttransport.com')
    expect(merged[0].fromDotDraft).toBeUndefined()
  })

  it('adds a Form 3 job that is not on the block yet', () => {
    const merged = mergeDotForm3IntoEmployments(
      [driverRow({})],
      form3EmployersToCandidateRows([
        {
          name: 'Midwest Transport',
          fromDate: '03/2016',
          toDate: '12/2018',
          hiringManagerName: 'Sam',
        },
      ]),
    )
    expect(merged).toHaveLength(2)
    expect(merged[1].companyName).toBe('Midwest Transport')
    expect(merged[1].fromDotDraft).toBe(true)
  })

  it('does not collapse a developer row with the same company month', () => {
    const merged = mergeDotForm3IntoEmployments(
      [
        {
          verificationKey: 'developer:d1',
          source: 'developer',
          sourceLabel: 'Developer resume',
          id: 'd1',
          companyName: 'First Transport Inc',
          position: 'Dev',
          startDate: '2015-01',
        },
      ],
      form3EmployersToCandidateRows([
        { name: 'First Transport Inc', fromDate: '01/2015', toDate: '02/2016' },
      ]),
    )
    expect(merged).toHaveLength(2)
  })
})

describe('employmentDedupeKey', () => {
  it('treats MM/YYYY and YYYY-MM as the same month', () => {
    expect(employmentDedupeKey('First Transport Inc', '2015-01')).toBe(
      employmentDedupeKey('first  transport  inc', '01/2015'),
    )
  })
})

describe('extractEvApplicantIdentity', () => {
  it('prefers profile name/DOB and takes last-4 SSN from DOT Form 1', () => {
    const id = extractEvApplicantIdentity({
      firstName: 'Sam',
      lastName: 'Rivera',
      dateOfBirth: '1988-04-12',
      form1: {
        firstName: 'Samuel',
        lastName: 'Rivera',
        dateOfBirth: '1980-01-01',
        socialSecurity: '123-45-6789',
      },
    })
    expect(id.driverName).toBe('Sam Rivera')
    expect(id.dateOfBirth).toBe('1988-04-12')
    expect(id.ssnLastFour).toBe('6789')
    expect(id.firstName).toBe('Sam')
  })

  it('falls back to Form 1 when the profile is empty', () => {
    const id = extractEvApplicantIdentity({
      form1: { firstName: 'Pat', lastName: 'Lee', dateOfBirth: '1990-06-01' },
    })
    expect(id.driverName).toBe('Pat Lee')
    expect(id.dateOfBirth).toBe('1990-06-01')
  })
})

describe('shouldCreateEvPacket', () => {
  it('skips current jobs unless the driver opts in to contact', () => {
    expect(
      shouldCreateEvPacket({ name: 'Now Trucking', type: 'employment', toDate: 'Present' }),
    ).toBe(false)
    expect(
      shouldCreateEvPacket({
        name: 'Now Trucking',
        type: 'employment',
        toDate: 'Present',
        doNotContact: false,
      }),
    ).toBe(true)
  })

  it('skips a past job marked do not contact', () => {
    expect(
      shouldCreateEvPacket({
        name: 'Old Carrier',
        type: 'employment',
        toDate: '02/2016',
        doNotContact: true,
      }),
    ).toBe(false)
  })
})

describe('isDkimVerifiedRequest', () => {
  it('is false for a portal-only VERIFIED row', () => {
    expect(isDkimVerifiedRequest({ dkimValid: false })).toBe(false)
    expect(isDkimVerifiedRequest(undefined)).toBe(false)
  })

  it('is true only when DKIM passed', () => {
    expect(isDkimVerifiedRequest({ dkimValid: true })).toBe(true)
  })
})
