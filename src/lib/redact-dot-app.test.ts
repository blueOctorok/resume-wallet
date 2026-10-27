import { describe, expect, it } from 'vitest'
import { releasesDriverIdentifiers } from '@/lib/company-account-tier'
import { consentFormDataForEmployer } from '@/lib/employer-pii'
import { projectDotAppForEmployer } from '@/lib/redact-dot-app'

const application = {
  form1: {
    firstName: 'Barry',
    socialSecurity: '000-00-0000',
    dateOfBirth: '1990-01-01',
    currentMailing: { street: '1 Main', city: 'Raccoon City', state: 'OH', zipCode: '00000' },
  },
  form2: { accidents: [] },
  form3: { signature: 'Barry', ipAddress: '127.0.0.1' },
}

describe('driver identifiers by employer tier', () => {
  it('gives the full hub the DOT identifiers and keeps them off a search account', () => {
    expect(releasesDriverIdentifiers('agency')).toBe(true)
    expect(releasesDriverIdentifiers('carrier')).toBe(false)

    const agency = projectDotAppForEmployer(application, true)
    expect(agency.form1?.socialSecurity).toBe('000-00-0000')
    expect(agency.form1?.dateOfBirth).toBe('1990-01-01')
    expect((agency.form1?.currentMailing as { street?: string }).street).toBe('1 Main')
    expect(agency.form3?.ipAddress).toBeUndefined()
    expect(agency.redactedFields).toEqual([])

    const carrier = projectDotAppForEmployer(application, false)
    expect(carrier.form1?.socialSecurity).toBeUndefined()
    expect(carrier.form1?.dateOfBirth).toBeUndefined()
    expect((carrier.form1?.currentMailing as { street?: string }).street).toBeUndefined()
    expect(carrier.form1?.firstName).toBe('Barry')
    expect(carrier.redactedFields.length).toBeGreaterThan(0)
  })

  it('keeps date of birth off a carrier consent and off neither copy of the SSN key', () => {
    const form = { firstName: 'Barry', dateOfBirth: '1990-01-01', address: '1 Main', ssn: '000000000' }
    expect(consentFormDataForEmployer(form, true)).toEqual({
      firstName: 'Barry',
      dateOfBirth: '1990-01-01',
      address: '1 Main',
    })
    expect(consentFormDataForEmployer(form, false)).toEqual({ firstName: 'Barry' })
  })
})
