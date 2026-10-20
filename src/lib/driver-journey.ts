/**
 * Driver journey — "where is this driver, and whose move is it?"
 *
 * Pure functions over the DQ item statuses (see dq-file-status.ts). Nothing is
 * stored: the board and the driver file both derive these at render time from
 * the same items, so they can never disagree.
 */

import { getDqItemDefinition, type DqItemId } from '@/lib/dq-file-registry'
import type { DqItemStatus } from '@/lib/dq-file-status'
import type { StripStep } from '@/components/employer/StepStrip' // type-only — erased at compile

export interface DqItemLite {
  id: DqItemId
  status: DqItemStatus
}

/** Whose move it is. `done` means every live DQ item is complete. */
export type BallInCourt = 'attention' | 'you' | 'processing' | 'driver' | 'done'
type Owner = Exclude<BallInCourt, 'done'>

export const BALL_LABEL: Record<BallInCourt, string> = {
  attention: 'Needs attention',
  you: 'Needs you',
  processing: 'In process',
  driver: 'Waiting on driver',
  done: 'DQ complete',
}

/** Most actionable first — a failed order beats something you can send, which beats waiting. */
const BALL_PRIORITY: Owner[] = ['attention', 'you', 'processing', 'driver']

/**
 * The order Pace actually walks a driver: consent goes out first, the reports
 * follow automatically, the driver builds their file after they log in, and
 * employment verification closes it out.
 */
export const DRIVER_JOURNEY_ORDER: readonly DqItemId[] = [
  'cdlis_consent',
  'mvr',
  'psp',
  'dl_images',
  'dot_application',
  'employment_verification',
]

/**
 * Consent gates the whole journey: reports can't be ordered without it, and the
 * driver only gets into the hub to build their file by following the consent
 * link. Until it is signed, nothing downstream is "missing" in a way the
 * recruiter can act on — so an unsigned consent decides the ball by itself.
 */
const JOURNEY_GATE: DqItemId = 'cdlis_consent'

function ownerFor(item: DqItemLite): Owner | null {
  if (item.status === 'complete') return null
  if (item.status === 'failed') return 'attention'
  if (item.status === 'processing') return 'processing'

  // missing / requested / in_progress
  switch (item.id) {
    case 'dl_images':
    case 'dot_application':
      return 'driver'
    case 'cdlis_consent':
      // Not sent yet → you. Sent or started → driver has to sign.
      return item.status === 'missing' ? 'you' : 'driver'
    case 'mvr':
    case 'psp':
      // Consent is signed (otherwise blocked) but no order exists → re-order.
      return item.status === 'missing' ? 'you' : 'processing'
    case 'employment_verification':
      return item.status === 'missing' ? 'you' : 'processing'
    default:
      return null
  }
}

/** One line the recruiter can act on, matched to the owner so pill and text agree. */
export function nextStepText(id: DqItemId, status: DqItemStatus): string {
  const label = getDqItemDefinition(id).label
  if (status === 'failed') return `${label} failed — needs a look`
  if (status === 'processing') return `${label} processing`
  switch (id) {
    case 'cdlis_consent':
      return status === 'missing' ? 'Send screening consent' : status === 'requested' ? 'Consent sent — waiting for signature' : 'Consent started, not finished'
    case 'mvr':
    case 'psp':
      return `Consent signed but no ${label} order — re-order`
    case 'dl_images':
      return status === 'missing' ? 'Driver needs to scan their license barcode' : 'Barcode read, not confirmed'
    case 'dot_application':
      return status === 'missing' ? 'Driver hasn’t started the DOT application' : 'DOT application in progress'
    case 'employment_verification':
      return status === 'missing' ? 'Start employment verification' : 'Waiting on prior employers'
    default:
      return label
  }
}

export interface DriverJourney {
  ball: BallInCourt
  /** First item (journey order) owned by whoever holds the ball — so the pill and the text agree. */
  next: { id: DqItemId; status: DqItemStatus; text: string } | null
}

export function deriveDriverJourney(items: DqItemLite[]): DriverJourney {
  const byId = new Map(items.map((i) => [i.id, i]))
  const toNext = (item: DqItemLite) => ({ id: item.id, status: item.status, text: nextStepText(item.id, item.status) })

  const gate = byId.get(JOURNEY_GATE)
  if (gate && gate.status !== 'complete') {
    return { ball: ownerFor(gate) ?? 'you', next: toNext(gate) }
  }

  const owned: Array<{ item: DqItemLite; owner: Owner }> = []
  for (const id of DRIVER_JOURNEY_ORDER) {
    const item = byId.get(id)
    const owner = item && ownerFor(item)
    if (item && owner) owned.push({ item, owner })
  }

  const ball = BALL_PRIORITY.find((o) => owned.some((x) => x.owner === o)) ?? 'done'
  const first = owned.find((x) => x.owner === ball)?.item ?? null
  return { ball, next: first ? toNext(first) : null }
}

// ── Journey strip ──────────────────────────────────────────────────────────

function statusWord(s: DqItemStatus | undefined): string {
  switch (s) {
    case 'complete':
      return 'ready'
    case 'processing':
      return 'processing'
    case 'in_progress':
      return 'in progress'
    case 'requested':
      return 'sent'
    case 'failed':
      return 'failed'
    default:
      return '—'
  }
}

/** Five milestones for the strip. Derived, like everything else here. */
export function deriveDriverJourneySteps(items: DqItemLite[]): StripStep[] {
  const s = (id: DqItemId) => items.find((i) => i.id === id)?.status
  const done = (id: DqItemId) => s(id) === 'complete'
  const consent = s('cdlis_consent')
  const fileDone = [done('dl_images'), done('dot_application')].filter(Boolean).length

  return [
    {
      key: 'consent',
      label: 'Consent',
      hint: consent === 'complete' ? 'FCRA · PSP · CDLIS' : consent === 'requested' ? 'Sent, unsigned' : consent === 'in_progress' ? 'Started' : undefined,
      done: done('cdlis_consent'),
    },
    {
      key: 'reports',
      label: 'Reports',
      hint: done('cdlis_consent') ? `MVR ${statusWord(s('mvr'))} · PSP ${statusWord(s('psp'))}` : undefined,
      done: done('mvr') && done('psp'),
    },
    {
      key: 'file',
      label: 'License & DOT',
      hint: fileDone > 0 || s('dl_images') !== 'missing' || s('dot_application') !== 'missing' ? `${fileDone} of 2` : undefined,
      done: fileDone === 2,
    },
    {
      key: 'employment',
      label: 'Employment',
      hint: s('employment_verification') === 'complete' ? 'Verified' : s('employment_verification') === 'in_progress' ? 'Checking' : undefined,
      done: done('employment_verification'),
    },
    {
      key: 'complete',
      label: 'DQ complete',
      done: items.every((i) => i.status === 'complete'),
    },
  ]
}
