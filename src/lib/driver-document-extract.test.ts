import { describe, expect, it } from 'vitest'
import { lineFromSlots, sanitizeSlots, type DriverDocumentSlots } from './driver-document-lines'

function slots(partial: Partial<DriverDocumentSlots>): DriverDocumentSlots {
  return {
    kind: 'other',
    insurer: null,
    liabilityLimit: null,
    cargoLimit: null,
    expiration: null,
    mcNumber: null,
    usdot: null,
    authorityDate: null,
    vehicleYear: null,
    vehicleMake: null,
    ...partial,
  }
}

describe('lineFromSlots', () => {
  it('prints insurance limits and the expiration, not the insurer', () => {
    expect(lineFromSlots(slots({
      kind: 'insurance',
      insurer: 'Great West',
      liabilityLimit: '1000000',
      expiration: '2027-03-01',
    }))).toBe('Auto liability $1,000,000 · expires Mar 2027')
  })

  it('prints an MC number and the year authority was granted', () => {
    expect(lineFromSlots(slots({
      kind: 'authority',
      mcNumber: '123456',
      usdot: '789012',
      authorityDate: '2019-06-01',
    }))).toBe('MC 123456 · authority since 2019')
  })

  it('prints the truck year and make', () => {
    expect(lineFromSlots(slots({
      kind: 'registration',
      vehicleYear: '2022',
      vehicleMake: 'Peterbilt',
    }))).toBe('2022 Peterbilt')
  })

  it('prints nothing for a file that is not one of those papers', () => {
    expect(lineFromSlots(slots({ kind: 'other', insurer: 'Great West' }))).toBeNull()
  })
})

describe('sanitizeSlots', () => {
  it('keeps digits and drops a VIN-sized guess that is not a money amount', () => {
    expect(sanitizeSlots({
      kind: 'insurance',
      liabilityLimit: '$1 million',
      cargoLimit: '100000',
      expiration: '2027-03-15',
      vehicleMake: '1FUJGLDR5CSBA1234',
    })).toMatchObject({
      kind: 'insurance',
      liabilityLimit: '1000000',
      cargoLimit: '100000',
      expiration: '2027-03-15',
      vehicleMake: null,
    })
  })
})
