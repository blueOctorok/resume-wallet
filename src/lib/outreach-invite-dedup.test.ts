import { describe, expect, it } from 'vitest'
import { ilikeExact, normalizeOutreachEmail, pickWinningInvite, type LiveInviteRank } from './outreach-invite-dedup'

function row(partial: Partial<LiveInviteRank> & Pick<LiveInviteRank, 'id' | 'status' | 'created_at'>): LiveInviteRank {
  return partial
}

describe('normalizeOutreachEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeOutreachEmail('  Julia@Outlook.com ')).toBe('julia@outlook.com')
  })

  it('treats blank as no email', () => {
    expect(normalizeOutreachEmail('   ')).toBeNull()
    expect(normalizeOutreachEmail(null)).toBeNull()
  })
})

describe('ilikeExact', () => {
  it('escapes LIKE wildcards so an underscore in an address stays literal', () => {
    expect(ilikeExact('a_b%@x.com')).toBe('a\\_b\\%@x.com')
  })
})

describe('pickWinningInvite', () => {
  it('keeps the one someone opened over a newer unsent pending', () => {
    const winner = pickWinningInvite([
      row({ id: 'new', status: 'pending', created_at: '2026-10-13T19:25:00Z' }),
      row({ id: 'opened', status: 'viewed', created_at: '2026-10-13T19:16:00Z' }),
    ])
    expect(winner?.id).toBe('opened')
  })

  it('prefers a delivered link when neither has been opened', () => {
    const winner = pickWinningInvite([
      row({ id: 'bare', status: 'pending', created_at: '2026-10-13T19:25:00Z' }),
      row({ id: 'sent', status: 'pending', created_at: '2026-10-13T19:16:00Z', email_sent_at: '2026-10-13T19:16:30Z' }),
    ])
    expect(winner?.id).toBe('sent')
  })

  it('keeps the newest when status and delivery match', () => {
    const winner = pickWinningInvite([
      row({ id: 'older', status: 'pending', created_at: '2026-10-13T19:16:00Z' }),
      row({ id: 'newer', status: 'pending', created_at: '2026-10-13T19:25:00Z' }),
    ])
    expect(winner?.id).toBe('newer')
  })
})
