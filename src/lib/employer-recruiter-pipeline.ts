/** Legacy DB enum for `application_invites.recruiter_status` — not used for kanban columns (columns follow `status`). */

export type RecruiterStatus = 'not_started' | 'in_progress' | 'completed' | 'archived'

export const RECRUITER_STATUSES: readonly RecruiterStatus[] = [
  'not_started',
  'in_progress',
  'completed',
  'archived',
] as const

export function isRecruiterStatus(v: string): v is RecruiterStatus {
  return (RECRUITER_STATUSES as readonly string[]).includes(v)
}

export function mapRecruiterStatusColumn(v: string | null | undefined): RecruiterStatus {
  if (v && isRecruiterStatus(v)) return v
  return 'not_started'
}

/** Short labels for selects and kanban column headers. */
export const RECRUITER_STATUS_LABEL: Record<RecruiterStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  completed: 'Completed',
  archived: 'Archived',
}
