import { describe, expect, it } from 'vitest'
import { phoneFromDriverProfile } from '@/lib/outreach-live-contact'

describe('phoneFromDriverProfile', () => {
  it('uses the phone the driver saved, not the one copied onto the invite', () => {
    expect(phoneFromDriverProfile(null, '(216) 314-6034')).toBe('(216) 314-6034')
    expect(phoneFromDriverProfile('555-0100', '(216) 314-6034')).toBe('(216) 314-6034')
  })

  it('keeps the invite phone until the driver has one', () => {
    expect(phoneFromDriverProfile('555-0100', null)).toBe('555-0100')
    expect(phoneFromDriverProfile('555-0100', '  ')).toBe('555-0100')
    expect(phoneFromDriverProfile(null, null)).toBeNull()
  })
})
