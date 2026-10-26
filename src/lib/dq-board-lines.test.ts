import { describe, expect, it } from 'vitest'
import {
  consentBoardLine,
  isRecentConsentSent,
  isUntouchedConsentInvite,
  rosterWhereLine,
  screeningBoardLine,
  signedUpWithoutConsentInvite,
} from '@/lib/dq-board-lines'

describe('consentBoardLine', () => {
  it('says signed when the bundle is complete', () => {
    expect(consentBoardLine({ status: 'complete', signedAt: '2026-10-12T15:00:00Z' })).toBe('Signed Oct 12, 2026')
  })

  it('says started when a bundle exists and is not signed', () => {
    expect(consentBoardLine({ status: 'in_progress', startedAt: '2026-10-01T00:00:00Z' })).toBe('Started Oct 1, 2026, not signed')
  })

  it('says sent and not opened when the invite is still pending', () => {
    expect(
      consentBoardLine({
        status: 'requested',
        invite: { status: 'pending', viewCount: 0, createdAt: '2026-09-02T00:00:00Z' },
      }),
    ).toBe('Sent Sep 2, 2026, not opened')
  })

  it('says opened when they viewed the invite and did not sign', () => {
    expect(
      consentBoardLine({
        status: 'requested',
        invite: { status: 'viewed', viewCount: 1, createdAt: '2026-09-02T00:00:00Z' },
      }),
    ).toBe('Sent Sep 2, 2026 · opened, not signed')
  })

  it('says not sent when nothing has gone out', () => {
    expect(consentBoardLine({ status: 'missing' })).toBe('Not sent')
  })
})

describe('isRecentConsentSent', () => {
  const now = Date.parse('2026-10-23T16:00:00Z')

  it('includes a consent sent within the last 7 days', () => {
    expect(isRecentConsentSent('2026-10-17T16:00:00Z', now)).toBe(true)
  })

  it('drops a consent sent more than 7 days ago', () => {
    expect(isRecentConsentSent('2026-10-16T15:59:00Z', now)).toBe(false)
  })

  it('drops a missing send time', () => {
    expect(isRecentConsentSent(null, now)).toBe(false)
  })
})

describe('isUntouchedConsentInvite', () => {
  it('keeps a pending invite that was never opened and has no account', () => {
    expect(
      isUntouchedConsentInvite({ status: 'pending', viewCount: 0, usedByUserId: null, candidateUserId: null }),
    ).toBe(true)
  })

  it('drops an invite they opened, started, or already claimed', () => {
    expect(isUntouchedConsentInvite({ status: 'viewed', viewCount: 1, usedByUserId: null, candidateUserId: null })).toBe(false)
    expect(isUntouchedConsentInvite({ status: 'pending', viewCount: 0, usedByUserId: 'user-1', candidateUserId: null })).toBe(false)
    expect(isUntouchedConsentInvite({ status: 'in_progress', viewCount: 0, usedByUserId: null, candidateUserId: null })).toBe(false)
  })
})

describe('signedUpWithoutConsentInvite', () => {
  const invitedUserIds = new Set(['invited-user'])
  const invitedEmails = new Set(['sent@example.com'])

  it('keeps someone this company never sent a consent invite', () => {
    expect(
      signedUpWithoutConsentInvite({
        userId: 'new-user',
        email: 'new@example.com',
        invitedUserIds,
        invitedEmails,
      }),
    ).toBe(true)
  })

  it('drops someone the invite was claimed by, or whose email was already sent a consent', () => {
    expect(
      signedUpWithoutConsentInvite({
        userId: 'invited-user',
        email: 'other@example.com',
        invitedUserIds,
        invitedEmails,
      }),
    ).toBe(false)
    expect(
      signedUpWithoutConsentInvite({
        userId: 'new-user',
        email: 'Sent@example.com',
        invitedUserIds,
        invitedEmails,
      }),
    ).toBe(false)
  })
})

describe('screeningBoardLine', () => {
  it('names a clean report and a report with hits', () => {
    expect(screeningBoardLine({ itemStatus: 'complete', orderStatus: 'completed', outcome: 'clear' })).toBe('Complete · Clear')
    expect(screeningBoardLine({ itemStatus: 'complete', orderStatus: 'completed', outcome: 'hits' })).toBe('Complete · Hits found')
  })

  it('calls needs_review pending review', () => {
    expect(screeningBoardLine({ itemStatus: 'complete', orderStatus: 'needs_review', outcome: 'unknown' })).toBe(
      'Complete · Pending review',
    )
  })

  it('includes the error text when an order failed', () => {
    expect(
      screeningBoardLine({
        itemStatus: 'failed',
        orderStatus: 'failed',
        errorMessage: 'DL number does not match the name',
      }),
    ).toBe('Failed · DL number does not match the name')
  })

  it('says not ordered when there is no pull', () => {
    expect(screeningBoardLine({ itemStatus: 'missing' })).toBe('Not ordered')
  })
})

describe('rosterWhereLine', () => {
  it('adds the failure reason to the needs-a-look sentence', () => {
    expect(
      rosterWhereLine(
        { id: 'mvr', status: 'failed', text: 'Motor Vehicle Record failed — needs a look' },
        [{ id: 'mvr', status: 'failed', line: 'Failed · State has no record' }],
      ),
    ).toBe('Motor Vehicle Record failed — needs a look · State has no record')
  })
})
