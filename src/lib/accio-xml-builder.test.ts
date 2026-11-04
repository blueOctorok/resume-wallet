import { describe, expect, it } from 'vitest'
import { buildAccioMvrOrderXml, mvrSearchTypeForState } from '@/lib/accio-xml-builder'

describe('mvrSearchTypeForState', () => {
  it('sends extended where Key no longer accepts standard', () => {
    expect(mvrSearchTypeForState('NJ', 'standard')).toBe('extended')
    expect(mvrSearchTypeForState('co')).toBe('extended')
    expect(mvrSearchTypeForState('WA', 'standard')).toBe('extended')
  })

  it('keeps standard where Key still accepts it', () => {
    expect(mvrSearchTypeForState('AL')).toBe('standard')
    expect(mvrSearchTypeForState('FL', 'standard')).toBe('standard')
    expect(mvrSearchTypeForState('OR')).toBe('standard')
    expect(mvrSearchTypeForState('WY', 'standard')).toBe('standard')
    expect(mvrSearchTypeForState('OH')).toBe('standard')
  })

  it('honors a requested type only when that state allows it', () => {
    expect(mvrSearchTypeForState('FL', 'extended')).toBe('extended')
    expect(mvrSearchTypeForState('OR', 'cdl')).toBe('cdl')
    expect(mvrSearchTypeForState('NJ', 'cdl')).toBe('extended')
  })
})

describe('buildAccioMvrOrderXml search type', () => {
  const order = {
    firstName: 'A',
    lastName: 'B',
    email: 'a@example.com',
    ssn: '123456789',
    dob: '1990-01-02',
    address: '1 Main',
    city: 'City',
    state: 'NJ',
    zip: '07001',
    dlNumber: 'D123',
    orderNumber: 'PW-1',
  }

  it('writes extended into the NJ order even when the caller asked for standard', () => {
    const xml = buildAccioMvrOrderXml({
      ...order,
      dlState: 'NJ',
      mvrSearchType: 'standard',
    })
    expect(xml).toContain('<mvr_searchtype>extended</mvr_searchtype>')
  })

  it('leaves an unlisted state on standard', () => {
    const xml = buildAccioMvrOrderXml({
      ...order,
      state: 'TX',
      dlState: 'TX',
      mvrSearchType: 'standard',
    })
    expect(xml).toContain('<mvr_searchtype>standard</mvr_searchtype>')
  })
})
