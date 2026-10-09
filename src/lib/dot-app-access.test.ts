import { describe, expect, it } from 'vitest'
import { dotApplicationViewAllowed } from '@/lib/dot-app-access'

describe('dotApplicationViewAllowed', () => {
  it('lets an agency open the file without a share', () => {
    expect(
      dotApplicationViewAllowed({ accountTier: 'agency', driverAcceptedShare: false }),
    ).toBe(true)
  })

  it('keeps a carrier on the career card until the driver accepts', () => {
    expect(
      dotApplicationViewAllowed({ accountTier: 'carrier', driverAcceptedShare: false }),
    ).toBe(false)
  })

  it('opens the file for a carrier after the driver accepts', () => {
    expect(
      dotApplicationViewAllowed({ accountTier: 'carrier', driverAcceptedShare: true }),
    ).toBe(true)
  })
})
