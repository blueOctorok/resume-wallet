import type { Invite, InviteStatus } from '@/components/employer/outreach/types'

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

/**
 * Shown on the Active tab kanban. Completed invites STAY on the board
 * indefinitely (locked 2026-06-01) so Pace can keep acting on a candidate
 * after their screenings come back — they are not auto-archived.
 */
export function isInviteOnActiveKanban(invite: Invite): boolean {
  return (
    invite.status === 'pending' ||
    invite.status === 'viewed' ||
    invite.status === 'in_progress' ||
    invite.status === 'completed'
  )
}

/** Archive tab: only cancelled / expired (dead links). */
export function isInviteInArchiveTab(invite: Invite): boolean {
  return invite.status === 'cancelled' || invite.status === 'expired'
}
