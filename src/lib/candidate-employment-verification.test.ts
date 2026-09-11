import { describe, expect, it } from 'vitest'
import {
  employmentDedupeKey,
  extractEvApplicantIdentity,
  form3EmployersToCandidateRows,
  isDkimVerifiedRequest,
  isDriverSendDeclined,
  mergeDotForm3IntoEmployments,
  shouldCreateEvPacket,
  shouldHoldEvSend,
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
  it('skips unemployment and does not copy hiring-manager contact onto the EV row', () => {
    const rows = form3EmployersToCandidateRows([
      { type: 'unemployment', name: 'Gap', fromDate: '01/2014', toDate: '12/2014' },
      {
        id: 'emp-1',
        type: 'employment',
        name: 'First Transport Inc',
        positionHeld: 'Entry Level Driver',
        fromDate: '01/2015',
        toDate: '02/2016',
        phone: '(555) 345-6789',
        hiringManagerName: 'Pat Lee',
        hiringManagerEmail: 'pat@firsttransport.com',
        hiringManagerPhone: '(555) 111-2222',
      },
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].companyName).toBe('First Transport Inc')
    expect(rows[0].supervisorPhone).toBe('(555) 345-6789')
    expect(rows[0].supervisorName).toBeUndefined()
    expect(rows[0].supervisorEmail).toBeUndefined()
    expect(rows[0].fromDotDraft).toBe(true)
    expect(rows[0].startDate).toBe('2015-01')
  })

  it('creates a packet for a current job and marks it hold-by-default', () => {
    const rows = form3EmployersToCandidateRows([
      { type: 'employment', name: 'Now Trucking', fromDate: '01/2024', toDate: 'Present' },
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].isCurrent).toBe(true)
    expect(shouldHoldEvSend(rows[0])).toBe(true)
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
    expect(merged[0].supervisorEmail).toBeUndefined()
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
  it('includes current jobs — send is opt-out, not hidden', () => {
    expect(
      shouldCreateEvPacket({ name: 'Now Trucking', type: 'employment', toDate: 'Present' }),
    ).toBe(true)
  })

  it('still creates a packet when the driver prefers no contact', () => {
    expect(
      shouldCreateEvPacket({
        name: 'Old Carrier',
        type: 'employment',
        toDate: '02/2016',
        doNotContact: true,
      }),
    ).toBe(true)
  })
})

describe('shouldHoldEvSend', () => {
  it('defaults hold on for current jobs and prefer-no-contact', () => {
    expect(shouldHoldEvSend({ ...driverRow({}), endDate: '', isCurrent: true })).toBe(true)
    expect(shouldHoldEvSend({ ...driverRow({}), preferNoContact: true })).toBe(true)
    expect(shouldHoldEvSend(driverRow({ endDate: '2016-02', isCurrent: false }))).toBe(false)
  })
})

describe('isDriverSendDeclined', () => {
  it('is only true for a driver send decline, not an employer refusal', () => {
    expect(isDriverSendDeclined({ status: 'DRIVER_SEND_DECLINED' })).toBe(true)
    expect(isDriverSendDeclined({ status: 'VERIFICATION_DECLINED' })).toBe(false)
    expect(isDriverSendDeclined({ status: 'VERIFICATION_REQUESTED' })).toBe(false)
    expect(isDriverSendDeclined(undefined)).toBe(false)
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
