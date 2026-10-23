/**
 * One sentence per DQ item for the status board, the driver file, and the
 * recruiter email. Computed from data the roster already has so those three
 * surfaces cannot drift.
 */

import { outcomeLabel, type ScreeningOutcome } from '@/lib/accio-result-status'
import type { DqItemId } from '@/lib/dq-file-registry'
import type { DqItemStatus } from '@/lib/dq-file-status'

const KNOWN_OUTCOMES = new Set<Exclude<ScreeningOutcome, null>>([
  'clear',
  'no_hits',
  'hits',
  'discrepancy',
  'pass',
  'fail',
  'unknown',
])

export function asScreeningOutcome(value: string | null | undefined): ScreeningOutcome {
  if (value && KNOWN_OUTCOMES.has(value as Exclude<ScreeningOutcome, null>)) {
    return value as Exclude<ScreeningOutcome, null>
  }
  return null
}

/** UTC so a server-rendered line matches the unit test, not the machine's zone. */
export function boardDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  return new Date(t).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function clip(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= 160) return clean
  return `${clean.slice(0, 157)}…`
}

/** How far back Recent looks. A week is the batch HR is still chasing. */
export const RECENT_CONSENT_DAYS = 7

export function isRecentConsentSent(sentAt: string | null | undefined, now = Date.now()): boolean {
  if (!sentAt) return false
  const t = Date.parse(sentAt)
  if (Number.isNaN(t)) return false
  return now - t <= RECENT_CONSENT_DAYS * 86400000 && t <= now
}

/**
 * They created an account without this company sending a screening-consent invite.
 * Matched on the user id the invite was claimed under, or on the email it was sent to.
 */
export function signedUpWithoutConsentInvite(input: {
  userId: string
  email: string | null
  invitedUserIds: ReadonlySet<string>
  invitedEmails: ReadonlySet<string>
}): boolean {
  if (input.invitedUserIds.has(input.userId)) return false
  const email = input.email?.trim().toLowerCase()
  if (email && input.invitedEmails.has(email)) return false
  return true
}

export interface ConsentInviteSnap {
  status: string
  viewCount: number
  createdAt: string
}

/**
 * Consent is the invite, so the line is a stage.
 * `status` is the DQ item status the resolver already chose — the words follow it.
 */
export function consentBoardLine(input: {
  status: DqItemStatus
  signedAt?: string | null
  startedAt?: string | null
  invite?: ConsentInviteSnap | null
}): string {
  if (input.status === 'complete') {
    const d = boardDate(input.signedAt)
    return d ? `Signed ${d}` : 'Signed'
  }
  if (input.status === 'in_progress') {
    const d = boardDate(input.startedAt)
    return d ? `Started ${d}, not signed` : 'Started, not signed'
  }

  const invite = input.invite
  if (invite && (input.status === 'requested' || input.status === 'missing')) {
    const d = boardDate(invite.createdAt)
    const unseen = invite.status === 'pending' && invite.viewCount <= 0
    if (unseen) return d ? `Sent ${d}, not opened` : 'Sent, not opened'
    const opened = invite.status === 'viewed' || invite.status === 'in_progress' || invite.viewCount > 0
    if (opened) return d ? `Sent ${d} · opened, not signed` : 'Opened, not signed'
  }

  if (input.status === 'requested') return 'Sent, not opened'
  return 'Not sent'
}

export function screeningBoardLine(input: {
  itemStatus: DqItemStatus
  orderStatus?: string | null
  outcome?: ScreeningOutcome
  errorMessage?: string | null
  errorCode?: string | null
}): string {
  if (input.itemStatus === 'missing') return 'Not ordered'
  if (input.itemStatus === 'processing') return 'Processing'
  if (input.itemStatus === 'requested') return 'Requested'

  if (input.itemStatus === 'failed') {
    const why = clip(input.errorMessage || input.errorCode || '')
    const order = (input.orderStatus || '').toLowerCase()
    const word = order === 'cancelled' ? 'Cancelled' : order === 'expired' ? 'Expired' : order === 'superseded' ? 'Replaced' : 'Failed'
    return why ? `${word} · ${why}` : word
  }

  if (input.itemStatus === 'complete') {
    const order = (input.orderStatus || '').toLowerCase()
    if (order === 'needs_review' && (input.outcome == null || input.outcome === 'unknown')) {
      return 'Complete · Pending review'
    }
    if (input.outcome) return `Complete · ${outcomeLabel(input.outcome)}`
    return 'Complete'
  }

  return 'Not ordered'
}

export function licenseBoardLine(input: { confirmed: boolean; barcodeRead: boolean }): string {
  if (input.confirmed) return 'Confirmed'
  if (input.barcodeRead) return 'Barcode read, not confirmed'
  return 'Not scanned'
}

export function dotBoardLine(input: { status: DqItemStatus; currentStep?: number | null }): string {
  if (input.status === 'complete') return 'Submitted'
  if (input.status === 'in_progress' || input.status === 'requested') {
    const step = input.currentStep && input.currentStep > 0 ? input.currentStep : 1
    return `Form ${step} of 3`
  }
  return 'Not started'
}

export function evBoardLine(status: DqItemStatus): string {
  if (status === 'complete') return 'Verified'
  if (status === 'failed') return 'Failed'
  if (status === 'processing' || status === 'in_progress' || status === 'requested') return 'Waiting on prior employers'
  return 'Not started'
}

export interface BoardItemLine {
  id: DqItemId
  status: DqItemStatus
  line?: string | null
}

/**
 * The sentence under a row when no document pill is on.
 * A failed MVR or PSP keeps the "needs a look" prompt and adds the reason.
 */
export function rosterWhereLine(
  next: { id: DqItemId; status: DqItemStatus; text: string } | null,
  items: readonly BoardItemLine[],
): string {
  if (!next) return 'DQ file complete'
  if ((next.id === 'mvr' || next.id === 'psp') && next.status === 'failed') {
    const line = items.find((item) => item.id === next.id)?.line
    if (line && line !== 'Failed' && line !== 'Cancelled' && line !== 'Expired' && line !== 'Replaced') {
      const why = line.replace(/^(Failed|Cancelled|Expired|Replaced) · /, '')
      return `${next.text} · ${why}`
    }
  }
  return next.text
}
