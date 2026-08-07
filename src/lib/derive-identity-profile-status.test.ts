import { describe, expect, it } from 'vitest'
import { deriveIdentityProfileStatus } from '@/lib/journey-progress'

describe('deriveIdentityProfileStatus', () => {
  it('is pending when nothing is filled', () => {
    expect(deriveIdentityProfileStatus(null)).toBe('pending')
    expect(deriveIdentityProfileStatus({})).toBe('pending')
  })

  it('is in_progress with only a name', () => {
    expect(
      deriveIdentityProfileStatus({ firstName: 'Barry', lastName: 'Burton' }),
    ).toBe('in_progress')
  })

  it('is complete with name + contact + location', () => {
    expect(
      deriveIdentityProfileStatus({
        firstName: 'Barry',
        lastName: 'Burton',
        email: 'barry@example.com',
        phone: '(555) 123-4567',
        city: 'Columbus',
        state: 'OH',
      }),
    ).toBe('complete')
  })

  it('treats phone alone as contact and city alone as location', () => {
    expect(
      deriveIdentityProfileStatus({
        firstName: 'Barry',
        lastName: 'Burton',
        phone: '5551234567',
        city: 'Remote',
      }),
    ).toBe('complete')
  })

  it('ignores whitespace-only fields', () => {
    expect(
      deriveIdentityProfileStatus({
        firstName: '  ',
        lastName: 'Burton',
        email: '   ',
      }),
    ).toBe('pending')
  })
})
