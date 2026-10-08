import { describe, expect, it } from 'vitest'
import { buildMvrForm1Provenance } from '@/lib/dot-field-provenance'
import {
  extractionToDotPrefill,
  mergeResumePrefillIntoDot,
  onlyFilledProfileFields,
} from '@/lib/resume-to-dot-prefill'
import type { ParsedResumeExtraction } from '@/types/resume-extraction'

const sample: ParsedResumeExtraction = {
  personalInfo: {
    firstName: 'Sam',
    lastName: 'Hauler',
    email: 'sam@example.com',
    phone: '555-0100',
    city: 'Dallas',
    state: 'Texas',
    zipCode: '75201',
  },
  cdlInfo: {
    cdlClass: 'CDL-A',
    cdlState: 'TX',
    cdlNumber: '12345678',
    cdlExpiration: '2028-04-01',
    endorsements: ['Hazmat', 'Tanker'],
  },
  employments: [
    {
      companyName: 'Acme Trucking',
      position: 'OTR Driver',
      location: 'Dallas, TX',
      startDate: '2019-03',
      endDate: '2024-01',
      isCurrent: false,
      responsibilities: ['Hauled reefers', 'Kept logs'],
    },
  ],
  educations: [
    { school: 'Roadmaster', degree: 'CDL Training', field: 'Class A', year: '2019-02' },
  ],
  skills: [
    { name: 'Dry van', category: 'equipment' },
    { name: 'Customer service', category: 'other' },
  ],
}

describe('extractionToDotPrefill', () => {
  it('maps resume fields onto the three DOT forms and skips a signature', () => {
    const prefill = extractionToDotPrefill(sample)

    expect(prefill.form1Data?.firstName).toBe('Sam')
    expect(prefill.form1Data?.currentMailing?.state).toBe('TX')
    expect(prefill.form1Data?.currentLicenses?.[0]).toMatchObject({
      state: 'TX',
      licenseNumber: '12345678',
      typeClass: 'Class A',
      endorsements: 'Hazmat, Tanker',
      expirationDate: '2028-04-01',
    })
    expect(prefill.form2Data?.drivingExperience).toEqual([
      { equipmentType: 'TRACTOR & SEMI-TRAILER', yearsOfExperience: '' },
    ])
    expect(prefill.form3Data?.employers?.[0]).toMatchObject({
      type: 'employment',
      name: 'Acme Trucking',
      fromDate: '03/2019',
      toDate: '01/2024',
      _source: 'self',
    })
    expect(prefill.form3Data?.employers?.[1]).toMatchObject({
      type: 'drivingSchool',
      name: 'Roadmaster',
      toDate: '02/2019',
    })
    expect(prefill.form3Data?.applicantSignature).toBeUndefined()
  })
})

describe('mergeResumePrefillIntoDot', () => {
  it('keeps MVR-locked identity, verified employers, and accident rows', () => {
    const provenance = buildMvrForm1Provenance(
      {
        firstName: 'Jane',
        lastName: 'Driver',
        phone: '555-0199',
        currentLicenses: [
          {
            state: 'OH',
            licenseNumber: 'DL123',
            typeClass: 'CDL-A',
            endorsements: 'H',
            expirationDate: '2028-01-01',
          },
        ],
      },
      {
        mvrResultId: 'res-1',
        orderId: 'ord-1',
        accioOrderNumber: 'ACC-9',
        asOf: '2026-07-01T00:00:00.000Z',
      },
    )

    const merged = mergeResumePrefillIntoDot(
      {
        form1: {
          firstName: 'Jane',
          lastName: 'Driver',
          phone: '555-0199',
          email: '',
          currentLicenses: [
            {
              state: 'OH',
              licenseNumber: 'DL123',
              typeClass: 'CDL-A',
              endorsements: 'H',
              expirationDate: '2028-01-01',
            },
          ],
          _fieldProvenance: provenance,
        } as never,
        form2: {
          drivingExperience: [{ equipmentType: 'BUS', yearsOfExperience: '3' }],
          accidents: [{ date: '2024-01-01', nature: 'Rear end', fatalities: 'no', injuries: 'no', atFault: 'no' }],
        },
        form3: {
          employers: [
            {
              name: 'Acme Trucking',
              phone: '',
              address: '',
              positionHeld: 'Driver',
              fromDate: '01/2019',
              toDate: '01/2024',
              reasonForLeaving: '',
              subjectToFMCSR: 'yes',
              safetySensitiveFunction: 'yes',
              isUnemployment: false,
              _source: 'verified',
            },
          ],
          applicantSignature: 'Jane Driver',
        },
      },
      extractionToDotPrefill(sample),
    )

    expect(merged.form1Data?.firstName).toBe('Jane')
    expect(merged.form1Data?.phone).toBe('555-0199')
    expect(merged.form1Data?.email).toBe('sam@example.com')
    expect(merged.form1Data?.currentLicenses?.[0].licenseNumber).toBe('DL123')
    expect(merged.form2Data?.accidents).toHaveLength(1)
    expect(merged.form2Data?.drivingExperience?.map((row) => row.equipmentType)).toEqual([
      'BUS',
      'TRACTOR & SEMI-TRAILER',
    ])
    expect(merged.form3Data?.employers).toHaveLength(2)
    expect(merged.form3Data?.employers?.[0]._source).toBe('verified')
    expect(merged.form3Data?.applicantSignature).toBe('Jane Driver')
  })
})

describe('onlyFilledProfileFields', () => {
  it('drops blank strings so a prefill cannot wipe an existing CDL', () => {
    expect(
      onlyFilledProfileFields({
        firstName: 'Sam',
        cdlNumber: '',
        employmentHistory: [],
        city: 'Dallas',
      }),
    ).toEqual({ firstName: 'Sam', city: 'Dallas' })
  })
})
