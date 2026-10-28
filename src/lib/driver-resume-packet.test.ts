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

  it('leaves a fact that is only stated off the proof tiers', () => {
    const packet = buildDriverResumePacket({
      structuredData: data,
      mvrSummary: null,
      shareToken: 'abc',
      asOfCandidates: [],
      hasDotApp: false,
      attestedChips: [{ id: 'cdl_class', label: 'Class D', attested: true }],
    })
    expect(packet.proofChips.find((chip) => chip.id === 'cdl_class')?.tier).toBeUndefined()
    expect(packet.proofChips.some((chip) => chip.tier === 'license')).toBe(false)
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
