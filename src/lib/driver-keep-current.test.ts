import { describe, expect, it } from 'vitest'
import { readCdlFreshness } from './cdl-freshness'
import { buildKeepCurrentCopy } from './driver-keep-current'

const barry = readCdlFreshness(
  { cdlClass: 'CDL-A', expiration: '2026-01-15', endorsements: ['H', 'N'] },
  new Date('2026-10-16T16:00:00Z'),
)

describe('buildKeepCurrentCopy', () => {
  it('tells them the resume exists and the CDL date has passed in one note', () => {
    const copy = buildKeepCurrentCopy({
      firstName: 'Barry',
      url: 'https://provven.com/?onboard=career-card',
      announceResume: true,
      freshness: barry,
    })
    expect(copy.subject).toContain('resume is ready')
    expect(copy.sms).toContain('Hi Barry')
    expect(copy.sms).toContain('January 15, 2026')
    expect(copy.sms).toContain('Hazmat and tanker')
    expect(copy.sms).toContain('Reply STOP')
    expect(copy.emailHtml).toContain('Open your career card')
  })

  it('can nudge only the expired date after the resume note was already sent', () => {
    const copy = buildKeepCurrentCopy({
      firstName: 'Barry',
      url: 'https://provven.com/?onboard=career-card',
      announceResume: false,
      freshness: barry,
    })
    expect(copy.title).toBe('Update a date on your resume')
    expect(copy.sms).not.toContain('resume is ready')
  })
})
