import { describe, expect, it } from 'vitest'
import { driversForStatusUpdate, type StatusUpdateRow } from '@/lib/status-update-reasons'

function row(overrides: Partial<StatusUpdateRow> & Pick<StatusUpdateRow, 'name'>): StatusUpdateRow {
  return {
    consentSentAt: null,
    signedUpOnOwn: false,
    recentConsentOnly: false,
    accountCreatedAt: null,
    lastActivityAt: null,
    items: [{ id: 'cdlis_consent', status: 'missing', line: 'Not sent' }],
    ...overrides,
  }
}

describe('driversForStatusUpdate', () => {
  const now = Date.now()
  const thisWeek = new Date(now - 2 * 86400000).toISOString()

  it('sends this week’s consents, including someone with no account yet', () => {
    const drivers = driversForStatusUpdate(
      [
        row({ name: 'Old', consentSentAt: '2020-01-01T00:00:00Z' }),
        row({
          name: 'New',
          consentSentAt: thisWeek,
          recentConsentOnly: true,
          items: [{ id: 'cdlis_consent', status: 'requested', line: 'Sent Oct 21, 2026, not opened' }],
        }),
      ],
      'consents-sent',
    )
    expect(drivers.map((driver) => driver.name)).toEqual(['New'])
    expect(drivers[0]?.line).toBe('Sent Oct 21, 2026, not opened')
  })

  it('sends people who signed up with no consent invite', () => {
    const drivers = driversForStatusUpdate(
      [
        row({ name: 'Walk in', signedUpOnOwn: true }),
        row({ name: 'Invited', signedUpOnOwn: false }),
        row({ name: 'No account', signedUpOnOwn: true, recentConsentOnly: true }),
      ],
      'signed-up',
    )
    expect(drivers.map((driver) => driver.name)).toEqual(['Walk in'])
  })

  it('sends a failed file and leaves a waiting driver out of that email', () => {
    const drivers = driversForStatusUpdate(
      [
        row({
          name: 'Broken',
          items: [
            { id: 'cdlis_consent', status: 'complete', line: 'Signed' },
            { id: 'mvr', status: 'failed', line: 'Failed · state rejected the order' },
          ],
        }),
        row({
          name: 'Waiting',
          items: [{ id: 'cdlis_consent', status: 'requested', line: 'Sent Oct 21, 2026, not opened' }],
        }),
      ],
      'failed',
    )
    expect(drivers.map((driver) => driver.name)).toEqual(['Broken'])
    expect(drivers[0]?.line).toContain('needs a look')
  })
})
