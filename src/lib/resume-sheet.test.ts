import { describe, expect, it } from 'vitest'
import { buildDriverResumePacket } from './driver-resume-packet'
import type { ResumeBuilderData } from './profile-mapper'
import { driverPacketToSheet } from './resume-sheet'
import { samBlahaResumeSheet } from './sam-blaha-resume'

const data: ResumeBuilderData = {
  personalInfo: {
    firstName: 'Ada',
    lastName: 'Driver',
    email: 'ada@example.com',
    phone: '555',
    address: '',
    city: 'Cleveland',
    state: 'OH',
    zipCode: '',
    professionalSummary: '',
  },
  cdlInfo: {
    cdlNumber: '',
    cdlState: '',
    cdlClass: '',
    endorsements: [],
    expirationDate: '',
    restrictions: [],
  },
  employments: [
    {
      id: '1',
      companyName: 'Pace',
      position: 'Driver',
      startDate: '2020-01-01',
      endDate: '',
      isCurrent: true,
      location: '',
      responsibilities: ['Hauled freight'],
      equipment: [],
    },
  ],
  educations: [],
  skills: [],
  references: [],
}

describe('driver packet as a sheet', () => {
  it('keeps equipment, experience, then the safety line, and leaves role meta empty', () => {
    const packet = buildDriverResumePacket({
      structuredData: data,
      mvrSummary: null,
      shareToken: 'abc',
      asOfCandidates: [],
      hasDotApp: true,
      dotAccidentCount: 0,
      documentLines: ['Auto liability $1,000,000'],
    })
    const sheet = driverPacketToSheet(packet)

    expect(sheet.sections.map((section) => section.title)).toEqual([
      'Equipment & authority',
      'Experience',
      'Safety summary (driver-stated)',
    ])
    const experience = sheet.sections[1]
    expect(experience?.kind).toBe('roles')
    if (experience?.kind === 'roles') {
      expect(experience.roles[0]?.meta).toBeNull()
      expect(experience.roles[0]?.title).toBe('Driver — Pace')
    }
    expect(sheet.fullName).toBe('Ada Driver')
    expect(sheet.letterhead).toBe('provven')
  })
})

describe('Sam Blaha resume', () => {
  it('is a Provven sheet with no proof chips', () => {
    const sheet = samBlahaResumeSheet()
    expect(sheet.letterhead).toBe('portfolio')
    expect(sheet.proofChips).toEqual([])
    expect(sheet.hasVerifiedClaims).toBe(false)
    expect(sheet.verifyUrl).toBe('https://blahablast.io')
    expect(sheet.sections.map((section) => section.title)).toEqual([
      'Experience',
      'Also building',
      'Skills',
      'Background',
    ])
  })
})
