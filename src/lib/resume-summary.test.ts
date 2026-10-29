import { describe, expect, it } from 'vitest'
import {
  completeSentences,
  endorsementLabels,
  mvrLineForResume,
  resumeSummaryPrompt,
  summaryMentionsScreeningHarm,
  yearsOnRecord,
} from './resume-summary'

const job = {
  titleLine: 'Commercial Driver — ABC Trucking Company',
  dateRange: '2014 – Present',
  bullets: ['OTR freight hauling'],
  miles: null,
}

describe('resume summary prompt', () => {
  it('leads with years and the license, and leaves the city out', () => {
    const prompt = resumeSummaryPrompt(
      {
        licenseLabel: 'Class D · OH',
        endorsements: [],
        jobs: [job],
        mvr: null,
      },
      2026,
    )
    expect(prompt).toContain('Years on record: 12')
    expect(prompt).toContain('License barcode read: Class D · OH')
    expect(prompt.toLowerCase()).not.toContain('north olmsted')
    expect(prompt.toLowerCase()).not.toContain('motor vehicle')
  })

  it('names saved endorsements and a zero-violation report', () => {
    const prompt = resumeSummaryPrompt(
      {
        licenseLabel: 'Class A · OH',
        endorsements: ['H', 'N', 'T'],
        jobs: [{ ...job, miles: '450,000' }],
        mvr: { violationCount: 0, licenseStatus: 'VALID' },
      },
      2026,
    )
    expect(prompt).toContain('Endorsements on the application: Hazmat, Tanker, Doubles/triples')
    expect(prompt).toContain('Motor vehicle report: clear')
    expect(prompt).toContain('miles recorded: 450,000')
  })

  it('leaves violations and a bad license status out of the facts', () => {
    const prompt = resumeSummaryPrompt(
      {
        licenseLabel: 'Class A · OH',
        endorsements: [],
        jobs: [job],
        mvr: { violationCount: 4, licenseStatus: 'SUSPENDED' },
      },
      2026,
    )
    expect(prompt.toLowerCase()).not.toContain('violation')
    expect(prompt.toLowerCase()).not.toContain('suspended')
    expect(prompt.toLowerCase()).not.toContain('motor vehicle')
    expect(mvrLineForResume({ violationCount: 4, licenseStatus: 'VALID' })).toBeNull()
    expect(mvrLineForResume({ violationCount: 0, licenseStatus: 'REVOKED' })).toBeNull()
  })
})

describe('screening harm gate', () => {
  it('keeps a clean record and rejects a violation or PSP mention', () => {
    expect(summaryMentionsScreeningHarm('Class A driver with a clean MVR. Hauls OTR freight.')).toBe(false)
    expect(summaryMentionsScreeningHarm('Record shows 3 violations and a suspension.')).toBe(true)
    expect(summaryMentionsScreeningHarm('PSP lists two crashes.')).toBe(true)
  })
})

describe('years on record', () => {
  it('counts from the earliest start through the current year', () => {
    expect(yearsOnRecord(['2016 – 2019', '2022 – Present'], 2026)).toBe(10)
  })
})

describe('endorsement labels', () => {
  it('reads the FMCSA letters', () => {
    expect(endorsementLabels(['H', 'N'])).toEqual(['Hazmat', 'Tanker'])
  })
})

describe('complete sentences', () => {
  it('stops after two sentences instead of cutting a word', () => {
    const trimmed = completeSentences(
      'Hauls freight. Inspects the truck. Also keeps the trailer inventory straight and',
      2,
    )
    expect(trimmed).toBe('Hauls freight. Inspects the truck.')
  })
})
