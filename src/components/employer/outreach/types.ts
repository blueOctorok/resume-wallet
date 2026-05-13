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

export type InviteStatus =
  | 'pending'
  | 'viewed'
  | 'in_progress'
  | 'completed'
  | 'expired'
  | 'cancelled'

export interface Invite {
  id: string
  token: string
  url: string
  type: string
  targetBlockType: string | null
  candidateEmail: string | null
  candidateName: string | null
  status: InviteStatus
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
  orderedAt: string
  completedAt: string | null
  feeAmount: number | string | null
}

/** Files associated with a candidate, indexed by their Storm user id. */
export type ScreeningsByUserId = Map<string, ScreeningRow[]>
