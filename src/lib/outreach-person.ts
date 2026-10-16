import type { Invite, InviteStatus } from '@/components/employer/outreach/types'
import { OUTREACH_KANBAN_COLUMNS, type OutreachKanbanColumn } from '@/lib/outreach-invite-buckets'
import { normalizeOutreachEmail } from '@/lib/outreach-invite-dedup'

/**
 * The board is one card per person. Invites stay separate rows (a finished DOT
 * application and an open consent link are different asks), but they share a
 * card. The column follows the ask that is still open. When every ask is
 * finished, the card sits in Completed.
 *
 * Identity: a claimed invite joins by user id. An unclaimed invite with the
 * same email joins that person, so the card does not split the moment they
 * sign in on only one of the links. With no account yet, email is the person.
 */

const OPEN_RANK: Partial<Record<InviteStatus, number>> = {
  in_progress: 3,
  viewed: 2,
  pending: 1,
}

export interface OutreachPerson {
  /** Stable across polls: user id, else email, else phone, else the invite id. */
  key: string
  /** The invite that decides the column and the modal's link actions. */
  primary: Invite
  /** Primary first, then the other asks, newest activity first. */
  invites: Invite[]
}

export function pickPrimaryInvite(invites: readonly Invite[]): Invite {
  const open = invites.filter((invite) => OPEN_RANK[invite.status] != null)
  const pool = open.length > 0 ? open : invites
  return [...pool].sort((a, b) => {
    const rank = (OPEN_RANK[b.status] ?? 0) - (OPEN_RANK[a.status] ?? 0)
    if (rank !== 0) return rank
    return +new Date(b.updatedAt) - +new Date(a.updatedAt)
  })[0]
}

export function personColumn(person: OutreachPerson): OutreachKanbanColumn | null {
  const status = person.primary.status
  return (OUTREACH_KANBAN_COLUMNS as readonly string[]).includes(status)
    ? (status as OutreachKanbanColumn)
    : null
}

function normalizePhone(phone: string | null): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 7 ? digits : null
}

function orderInvites(list: Invite[]): { primary: Invite; invites: Invite[] } {
  const primary = pickPrimaryInvite(list)
  const rest = list
    .filter((invite) => invite.id !== primary.id)
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
  return { primary, invites: [primary, ...rest] }
}

export function groupInvitesByPerson(invites: readonly Invite[]): OutreachPerson[] {
  const byUser = new Map<string, Invite[]>()
  const emailToUser = new Map<string, string>()
  const loose: Invite[] = []

  for (const invite of invites) {
    if (invite.usedByUserId) {
      const list = byUser.get(invite.usedByUserId) ?? []
      list.push(invite)
      byUser.set(invite.usedByUserId, list)
      const email = normalizeOutreachEmail(invite.candidateEmail)
      if (email && !emailToUser.has(email)) emailToUser.set(email, invite.usedByUserId)
      continue
    }
    loose.push(invite)
  }

  const byLoose = new Map<string, Invite[]>()
  for (const invite of loose) {
    const email = normalizeOutreachEmail(invite.candidateEmail)
    const claimedUserId = email ? emailToUser.get(email) : undefined
    if (claimedUserId && byUser.has(claimedUserId)) {
      byUser.get(claimedUserId)!.push(invite)
      continue
    }
    const phone = normalizePhone(invite.candidatePhone)
    const key = email ? `email:${email}` : phone ? `phone:${phone}` : `invite:${invite.id}`
    const list = byLoose.get(key) ?? []
    list.push(invite)
    byLoose.set(key, list)
  }

  const people: OutreachPerson[] = []
  for (const [userId, list] of byUser) {
    people.push({ key: `user:${userId}`, ...orderInvites(list) })
  }
  for (const [key, list] of byLoose) {
    people.push({ key, ...orderInvites(list) })
  }
  return people
}
