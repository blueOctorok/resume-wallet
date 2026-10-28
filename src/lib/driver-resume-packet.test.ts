import { describe, expect, it } from 'vitest'
import { buildDriverResumePacket } from './driver-resume-packet'
import type { ResumeBuilderData } from './profile-mapper'

const data: ResumeBuilderData = {
  personalInfo: {
    firstName: 'Sam',
    lastName: 'Blaha',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
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
  employments: [],
  educations: [],
  skills: [],
  references: [],
}

describe('resume proof badges', () => {
  it('marks a predicate-backed MVR fact as a Midnight proof and the barcode as a license proof', () => {
    const packet = buildDriverResumePacket({
      structuredData: data,
      mvrSummary: null,
      shareToken: 'abc',
      asOfCandidates: [],
      hasDotApp: true,
      attestedChips: [{ id: 'cdl_class', label: 'Class D', attested: true, tier: 'midnight' }],
      licenseProof: { label: 'Class D · OH' },
    })

    expect(packet.proofChips.find((chip) => chip.id === 'cdl_class')?.tier).toBe('midnight')
    expect(packet.proofChips.filter((chip) => chip.tier === 'midnight')).toHaveLength(1)
    expect(packet.proofChips.find((chip) => chip.id === 'license-proof')).toEqual({
      id: 'license-proof',
      label: 'Class D · OH',
      tier: 'license',
    })
  })

  it('shows an Accio proof until Midnight replaces that fact, and keeps the barcode', () => {
    const accioRecord = {
      licenseClass: 'A',
      endorsements: ['H'],
      restrictions: [],
      medicalCertStatus: null,
      medicalCertExpiration: null,
    }
    const waiting = buildDriverResumePacket({
      structuredData: data,
      mvrSummary: null,
      shareToken: 'abc',
      asOfCandidates: [],
      hasDotApp: true,
      accioRecord,
      licenseProof: { label: 'Class A · TX' },
    })
    expect(waiting.proofChips.map((chip) => `${chip.tier}:${chip.id}`)).toEqual([
      'accio:cdl_class',
      'accio:cdl_endorsements',
      'accio:cdl_restrictions',
      'license:license-proof',
    ])

    const proved = buildDriverResumePacket({
      structuredData: data,
      mvrSummary: null,
      shareToken: 'abc',
      asOfCandidates: [],
      hasDotApp: true,
      accioRecord,
      licenseProof: { label: 'Class A · TX' },
      attestedChips: [{ id: 'cdl_class', label: 'Class A', attested: true, tier: 'midnight' }],
    })
    expect(proved.proofChips.map((chip) => `${chip.tier}:${chip.id}`)).toEqual([
      'midnight:cdl_class',
      'accio:cdl_endorsements',
      'accio:cdl_restrictions',
      'license:license-proof',
    ])
  })

  it('does not invent an Accio proof from a record with no class', () => {
    const packet = buildDriverResumePacket({
      structuredData: data,
      mvrSummary: null,
      shareToken: 'abc',
      asOfCandidates: [],
      hasDotApp: false,
      accioRecord: {
        licenseClass: null,
        endorsements: [],
        restrictions: [],
        medicalCertStatus: null,
        medicalCertExpiration: null,
      },
      attestedChips: [{ id: 'cdl_class', label: 'Class D', attested: true }],
    })
    expect(packet.proofChips).toEqual([])
  })

  it('does not add a class pill for a CDL letter or for class D', () => {
    const packet = buildDriverResumePacket({
      structuredData: {
        ...data,
        personalInfo: { ...data.personalInfo, city: 'Cypress', state: 'TX' },
        cdlInfo: {
          ...data.cdlInfo,
          cdlClass: 'C',
          cdlState: 'TX',
          endorsements: ['None'],
          expirationDate: '2034-01-17',
        },
      },
      mvrSummary: {
        licenseState: 'TX',
        licenseStatus: 'valid',
        totalPoints: 0,
        violationCount: 0,
      },
      shareToken: 'abc',
      asOfCandidates: [],
      hasDotApp: true,
      licenseProof: { label: 'Class C · TX' },
    })

    expect(packet.tagline).toBe('Cypress, TX')
    expect(packet.proofChips.map((chip) => chip.id)).toEqual(['license-proof'])
    expect(packet.credentials.some((line) => line.startsWith('CDL'))).toBe(false)
    expect(packet.credentials).toEqual(['License expires January 17, 2034'])
  })

  it('does not print typed endorsements as a chip', () => {
    const packet = buildDriverResumePacket({
      structuredData: {
        ...data,
        cdlInfo: { ...data.cdlInfo, endorsements: ['H', 'N'], expirationDate: '2030-01-01' },
      },
      mvrSummary: null,
      shareToken: 'abc',
      asOfCandidates: [],
      hasDotApp: true,
    })
    expect(packet.proofChips.some((chip) => chip.id.startsWith('endorsements'))).toBe(false)
    expect(packet.summary).toBeNull()
  })
})
