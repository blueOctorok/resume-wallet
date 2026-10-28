import { describe, expect, it } from 'vitest'
import { form3ToProfile } from './dot-form-mapper'
import { workDescriptionToBullets } from './work-description'

describe('workDescriptionToBullets', () => {
  it('turns a comma list into bullets', () => {
    expect(
      workDescriptionToBullets(
        'OTR freight hauling, pre-trip inspections, load securing, and DOT compliance',
      ),
    ).toEqual([
      'OTR freight hauling',
      'Pre-trip inspections',
      'Load securing',
      'DOT compliance',
    ])
  })

  it('keeps a sentence that contains commas as one bullet', () => {
    expect(
      workDescriptionToBullets(
        'Hauled freight across Ohio, Indiana, and Michigan. Completed a pre-trip every morning.',
      ),
    ).toEqual([
      'Hauled freight across Ohio, Indiana, and Michigan',
      'Completed a pre-trip every morning',
    ])
  })

  it('reads dashes, numbers, and semicolons as a list', () => {
    expect(
      workDescriptionToBullets('- Regional freight\n2. Equipment maintenance\nHazMat transport; log audits'),
    ).toEqual(['Regional freight', 'Equipment maintenance', 'HazMat transport', 'Log audits'])
  })

  it('returns nothing for a blank description', () => {
    expect(workDescriptionToBullets('  \n')).toEqual([])
  })

  it('carries a job description onto the resume as bullets', () => {
    const profile = form3ToProfile({
      employers: [{
        name: 'ABC Trucking',
        phone: '',
        address: 'Columbus, OH',
        positionHeld: 'Driver',
        duties: 'Hauled reefers. Did pre-trips.',
        fromDate: '01/2023',
        toDate: 'Present',
        reasonForLeaving: '',
        subjectToFMCSR: 'yes',
        safetySensitiveFunction: 'yes',
        isUnemployment: false,
      }],
      education: [],
    })
    expect(profile.employmentHistory?.[0]?.responsibilities).toEqual([
      'Hauled reefers',
      'Did pre-trips',
    ])
  })
})
