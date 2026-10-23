import { describe, expect, it } from 'vitest'
import {
  consentBoardLine,
  rosterWhereLine,
  screeningBoardLine,
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
