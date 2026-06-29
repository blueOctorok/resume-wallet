/**
 * Shared types for the redesigned employer outreach surface.
 *
 * These mirror the wire shapes returned by:
 *   - GET /api/employer/invites    → Invite
 *   - GET /api/employer/screenings → ScreeningRow
 *
 * Keeping them in one place lets the Active tab, Files vault, and Archive tab
 * all consume the same maps without each component re-declaring its own types.
 */

import type { ScreeningOutcome } from '@/lib/accio-result-status'
import type { RecruiterStatus } from '@/lib/employer-recruiter-pipeline'

export type { RecruiterStatus } from '@/lib/employer-recruiter-pipeline'
export { isRecruiterStatus, RECRUITER_STATUSES } from '@/lib/employer-recruiter-pipeline'

export type InviteStatus =
  | 'pending'
  | 'viewed'
  | 'in_progress'
  | 'completed'
  | 'expired'
  | 'cancelled'

/** Every value allowed in `application_invites.status` (DB check constraint). */
export const ALL_INVITE_STATUSES: readonly InviteStatus[] = [
  'pending',
  'viewed',
  'in_progress',
  'completed',
  'cancelled',
  'expired',
] as const

export function isInviteStatus(v: string): v is InviteStatus {
  return (ALL_INVITE_STATUSES as readonly string[]).includes(v)
}

export interface Invite {
  id: string
  token: string
  url: string
  type: string
  targetBlockType: string | null
  candidateEmail: string | null
  candidateName: string | null
  status: InviteStatus
  /** Row update time from DB — used to age completed invites off the Active board. */
  updatedAt: string
  /** Legacy DB field; not used for board columns (see `outreach-invite-buckets`). */
  recruiterStatus: RecruiterStatus
  /** Employer notes on this outreach; null when empty. */
  recruiterNotes: string | null
  jobTitle: string | null
  jobPostingId: string | null
  viewCount: number
  expiresAt: string | null
  createdAt: string
  usedAt: string | null
  /** Storm user id once the invite has been claimed. Used to look up screening files. */
  usedByUserId: string | null
  usedByName: string | null
  driverApplicationId: string | null
  emailSentAt: string | null
}

export interface ScreeningRow {
  id: string
  kind: 'mvr' | 'psp'
  candidateUserId: string | null
  candidateName: string | null
  avatarUrl: string | null
  status: string
  resultOutcome: ScreeningOutcome
  dlState: string | null
  /** Raw DL number on the order (caps comparison; null for older rows). */
  dlNumber?: string | null
  /** Set when Accio fails the order at intake (e.g. invalid state, malformed DL). */
  errorCode?: string | null
  errorMessage?: string | null
  orderedAt: string
  /** Set when Accio acknowledged + began processing; null while still pending intake. */
  processedAt?: string | null
  completedAt: string | null
  feeAmount: number | string | null
  /** Driver-initiated portable pull shared via consent (P3.4-C). */
  driverOwned?: boolean
}

/** Files associated with a candidate, indexed by their Storm user id. */
export type ScreeningsByUserId = Map<string, ScreeningRow[]>
