import { describe, expect, it } from 'vitest'
import type { Invite } from '@/components/employer/outreach/types'
import { groupInvitesByPerson, pickPrimaryInvite } from './outreach-person'

function invite(partial: Partial<Invite> & Pick<Invite, 'id' | 'status'>): Invite {
  return {
    token: 't',
    url: 'https://example.com',
    type: 'block',
    targetBlockType: 'driver-screening-consent',
    candidateEmail: 'barry@example.com',
    candidatePhone: null,
    candidateName: 'Barry Burton',
    updatedAt: '2026-10-14T00:00:00Z',
    recruiterStatus: 'not_started',
    recruiterNotes: null,
    jobTitle: null,
    jobPostingId: null,
    viewCount: 0,
    expiresAt: null,
    createdAt: '2026-10-14T00:00:00Z',
    usedAt: null,
    usedByUserId: 'user-1',
    usedByName: 'Barry Burton',
    driverApplicationId: null,
    emailSentAt: null,
    smsSentAt: null,
    ...partial,
  }
}

describe('pickPrimaryInvite', () => {
  it('keeps the open ask in front of a finished one', () => {
    const primary = pickPrimaryInvite([
      invite({
        id: 'dot',
        status: 'completed',
        targetBlockType: 'driver-dot-application',
        updatedAt: '2026-10-13T19:10:30Z',
      }),
      invite({
        id: 'consent',
        status: 'viewed',
        updatedAt: '2026-10-14T13:02:49Z',
      }),
    ])
    expect(primary.id).toBe('consent')
  })

  it('prefers in progress over a newer pending invite', () => {
    const primary = pickPrimaryInvite([
      invite({ id: 'new', status: 'pending', updatedAt: '2026-10-15T00:00:00Z' }),
      invite({ id: 'started', status: 'in_progress', updatedAt: '2026-10-14T00:00:00Z' }),
    ])
    expect(primary.id).toBe('started')
  })

  it('uses the newest finished invite when nothing is open', () => {
    const primary = pickPrimaryInvite([
      invite({ id: 'old', status: 'completed', updatedAt: '2026-10-01T00:00:00Z' }),
      invite({ id: 'new', status: 'completed', updatedAt: '2026-10-13T00:00:00Z' }),
    ])
    expect(primary.id).toBe('new')
  })
})

describe('groupInvitesByPerson', () => {
  it('collapses a claimed driver with two asks into one card', () => {
    const people = groupInvitesByPerson([
      invite({
        id: 'dot',
        status: 'completed',
        targetBlockType: 'driver-dot-application',
        updatedAt: '2026-10-13T19:10:30Z',
      }),
      invite({ id: 'consent', status: 'viewed', updatedAt: '2026-10-14T13:02:49Z' }),
    ])
    expect(people).toHaveLength(1)
    expect(people[0].key).toBe('user:user-1')
    expect(people[0].primary.id).toBe('consent')
    expect(people[0].invites.map((row) => row.id)).toEqual(['consent', 'dot'])
  })

  it('joins an unclaimed invite to the claimed person with the same email', () => {
    const people = groupInvitesByPerson([
      invite({ id: 'claimed', status: 'viewed', usedByUserId: 'user-1' }),
      invite({
        id: 'loose',
        status: 'pending',
        usedByUserId: null,
        candidateEmail: ' Barry@Example.com ',
      }),
    ])
    expect(people).toHaveLength(1)
    expect(people[0].invites.map((row) => row.id).sort()).toEqual(['claimed', 'loose'])
  })

  it('keeps two different emails as two people', () => {
    const people = groupInvitesByPerson([
      invite({ id: 'a', status: 'pending', usedByUserId: null, candidateEmail: 'a@example.com' }),
      invite({ id: 'b', status: 'pending', usedByUserId: null, candidateEmail: 'b@example.com' }),
    ])
    expect(people).toHaveLength(2)
  })

  it('does not merge anonymous links that have no email or phone', () => {
    const people = groupInvitesByPerson([
      invite({ id: 'a', status: 'pending', usedByUserId: null, candidateEmail: null }),
      invite({ id: 'b', status: 'pending', usedByUserId: null, candidateEmail: null }),
    ])
    expect(people).toHaveLength(2)
  })
})
