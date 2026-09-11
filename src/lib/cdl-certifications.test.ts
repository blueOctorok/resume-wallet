import { describe, it, expect } from 'vitest'
import {
  addCertification,
  joinCertifications,
  parseCertifications,
} from '@/lib/cdl-certifications'

describe('cdl-certifications', () => {
  it('round-trips a selection through the comma-joined field', () => {
    const selected = ['Class A CDL', 'Hazmat (H)']
    expect(parseCertifications(joinCertifications(selected))).toEqual(selected)
  })

  it('keeps legacy hand-typed values as entries', () => {
    expect(parseCertifications('Class A CDL,  hazmat endorsement ')).toEqual([
      'Class A CDL',
      'hazmat endorsement',
    ])
    expect(parseCertifications(undefined)).toEqual([])
    expect(parseCertifications('  ')).toEqual([])
  })

  it('treats None/Other as exclusive in both directions', () => {
    expect(addCertification(['Class A CDL', 'Hazmat (H)'], 'None/Other')).toEqual(['None/Other'])
    expect(addCertification(['None/Other'], 'Class B CDL')).toEqual(['Class B CDL'])
  })

  it('ignores a duplicate selection', () => {
    expect(addCertification(['Class A CDL'], 'Class A CDL')).toEqual(['Class A CDL'])
  })
})
