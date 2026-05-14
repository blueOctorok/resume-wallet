import type { Invite, InviteStatus } from '@/components/employer/outreach/types'

/**
 * Days after `status === 'completed'` before the invite leaves the Active board.
 * Uses `updatedAt` (falls back to `createdAt`) as the clock anchor — `updated_at`
 * bumps when the row changes, which is a reasonable proxy for "last activity"
 * until we add a dedicated `completed_at` column.
 */
export const OUTREACH_STALE_COMPLETED_DAYS = 14

/** Kanban columns match `application_invites.status` (candidate lifecycle). */
export const OUTREACH_KANBAN_COLUMNS = [
  'pending',
  'viewed',
  'in_progress',
  'completed',
] as const satisfies readonly InviteStatus[]

export type OutreachKanbanColumn = (typeof OUTREACH_KANBAN_COLUMNS)[number]

export const OUTREACH_KANBAN_LABEL: Record<OutreachKanbanColumn, string> = {
  pending: 'Pending',
  viewed: 'Viewed',
  in_progress: 'In progress',
  completed: 'Completed',
}

function daysSince(iso: string): number {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return 0
  return Math.floor((Date.now() - t) / 86400000)
}

/** Completed invites older than the threshold belong in Archive, not on the daily board. */
export function isStaleCompletedOutreach(invite: Invite): boolean {
  if (invite.status !== 'completed') return false
  const anchor = invite.updatedAt ?? invite.createdAt
  return daysSince(anchor) >= OUTREACH_STALE_COMPLETED_DAYS
}

/** Shown on the Active tab kanban (pending / viewed / in_progress / fresh completed). */
export function isInviteOnActiveKanban(invite: Invite): boolean {
  if (invite.status === 'pending' || invite.status === 'viewed' || invite.status === 'in_progress') {
    return true
  }
  if (invite.status === 'completed') return !isStaleCompletedOutreach(invite)
  return false
}

/** Archive tab: cancelled, expired, and stale completed (frees the main board). */
export function isInviteInArchiveTab(invite: Invite): boolean {
  if (invite.status === 'cancelled' || invite.status === 'expired') return true
  return isStaleCompletedOutreach(invite)
}
