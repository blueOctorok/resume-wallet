/**
 * The email button does not care which pill is selected on the board.
 * She picks one of these inside the modal, and that choice is the whole email.
 */

import { isRecentConsentSent, rosterWhereLine } from '@/lib/dq-board-lines'
import { deriveDriverJourney } from '@/lib/driver-journey'
import type { DqItemId } from '@/lib/dq-file-registry'
import type { DqItemStatus } from '@/lib/dq-file-status'

export const STATUS_UPDATE_REASON_IDS = ['consents-sent', 'signed-up', 'waiting', 'failed', 'complete'] as const

export type StatusUpdateReasonId = (typeof STATUS_UPDATE_REASON_IDS)[number]

export interface StatusUpdateReason {
  id: StatusUpdateReasonId
  /** What she sees in the dropdown. */
  label: string
  /** The first paragraph the recruiter reads. She does not edit this. */
  sentence: string
}

export const STATUS_UPDATE_REASONS: readonly StatusUpdateReason[] = [
  {
    id: 'consents-sent',
    label: 'Consents sent this week',
    sentence: 'These consents were sent in the last 7 days. Please follow up with anyone who has not signed.',
  },
  {
    id: 'signed-up',
    label: 'Signed up on their own',
    sentence: 'These drivers signed up on their own. No consent has been sent yet.',
  },
  {
    id: 'waiting',
    label: 'Still waiting on the driver',
    sentence: 'These drivers still need to finish their part.',
  },
  {
    id: 'failed',
    label: 'Something failed',
    sentence: 'Something on these files failed and needs a look.',
  },
  {
    id: 'complete',
    label: 'File is complete',
    sentence: 'These qualification files are complete.',
  },
]

export function statusUpdateReason(id: string): StatusUpdateReason | null {
  return STATUS_UPDATE_REASONS.find((reason) => reason.id === id) ?? null
}

export interface StatusUpdateRow {
  name: string
  consentSentAt: string | null
  signedUpOnOwn: boolean
  recentConsentOnly: boolean
  accountCreatedAt: string | null
  lastActivityAt: string | null
  items: Array<{ id: DqItemId; status: DqItemStatus; line: string }>
}

function byTime(value: string | null): number {
  return value ? Date.parse(value) || 0 : 0
}

function consentLine(row: StatusUpdateRow): string {
  return row.items.find((item) => item.id === 'cdlis_consent')?.line || 'Not sent'
}

/** Drivers that belong in this email, newest relevant date first. */
export function driversForStatusUpdate(rows: readonly StatusUpdateRow[], reasonId: StatusUpdateReasonId): Array<{ name: string; line: string }> {
  const picked: StatusUpdateRow[] = []
  for (const row of rows) {
    if (reasonId === 'consents-sent') {
      if (isRecentConsentSent(row.consentSentAt)) picked.push(row)
      continue
    }
    if (row.recentConsentOnly) continue
    if (reasonId === 'signed-up') {
      if (row.signedUpOnOwn) picked.push(row)
      continue
    }
    const ball = deriveDriverJourney(row.items).ball
    if (reasonId === 'waiting' && ball === 'driver') picked.push(row)
    if (reasonId === 'failed' && ball === 'attention') picked.push(row)
    if (reasonId === 'complete' && ball === 'done') picked.push(row)
  }

  const timeFor = (row: StatusUpdateRow) => {
    if (reasonId === 'consents-sent') return byTime(row.consentSentAt)
    if (reasonId === 'signed-up') return byTime(row.accountCreatedAt)
    return byTime(row.lastActivityAt)
  }

  return [...picked]
    .sort((a, b) => timeFor(b) - timeFor(a) || a.name.localeCompare(b.name))
    .map((row) => ({
      name: row.name,
      line:
        reasonId === 'consents-sent' || reasonId === 'signed-up'
          ? consentLine(row)
          : rosterWhereLine(deriveDriverJourney(row.items).next, row.items),
    }))
}
