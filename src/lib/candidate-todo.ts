/**
 * Candidate to-do builder — "What should I do right now?"
 *
 * Pure function over data the client already has: the block-inferred
 * journey (journey-progress.ts) plus the newest pending employer request.
 * No new backend — this only re-shapes existing signals into a short
 * checklist with exactly one primary action.
 */

import type { PageType } from '@/stores/types'
import type { JourneyProgress, JourneyStep } from '@/lib/journey-progress'
import { getBlockDefinition } from '@/lib/block-registry'

export type TodoStatus = 'todo' | 'in-progress' | 'waiting' | 'done'

export interface TodoItem {
  id: string
  label: string
  status: TodoStatus
  /** Deep link — null rows are informational (no navigation). */
  page: PageType
  /** For waiting rows: who/what we're waiting on. */
  waitingOn?: string
}

export interface PendingEmployerRequest {
  id: string
  companyName: string
  targetBlockType: string | null
  requestType: string
}

export interface CandidateTodo {
  /** Company behind the pinned request — the "Invited by {Company}" context line. */
  invitedBy: string | null
  /** 7 rows max, actionable items first. */
  items: TodoItem[]
  /** The one primary CTA (never more than one). Null when everything is done/waiting. */
  primary: TodoItem | null
  doneCount: number
}

const MAX_ITEMS = 7

/**
 * Journey steps that never belong on the to-do list: wallet is banned copy,
 * referral/attestation are perpetual optional nudges, find-jobs is a
 * permanent hub feature (not a task), employment verification is a
 * voluntary extra that would crowd the 7-row cap.
 */
const HIDDEN_STEP_IDS = new Set([
  'wallet',
  'referral',
  'verified-attestation',
  'find-jobs',
  'general-employment-verification',
])

/** Short action-voice labels per journey step id (fallback: the step's own label). */
const STEP_LABELS: Record<string, string> = {
  profile: 'Finish your profile',
  'driver-dot-application': 'Complete your DOT application',
  'driver-screening-consent': 'Sign your screening consent',
  'driver-mvr': 'Order your MVR',
  'driver-psp': 'Order your PSP report',
  'storm-resume': 'Build your resume',
  'driver-resume': 'Build your resume',
  'developer-resume': 'Build your resume',
  'general-resume': 'Build your resume',
  'developer-portfolio': 'Add your portfolio link',
  'developer-github': 'Connect GitHub',
}

function stepToItem(step: JourneyStep): TodoItem | null {
  if (HIDDEN_STEP_IDS.has(step.id)) return null

  const page = step.action?.target ?? null
  const label = STEP_LABELS[step.id] ?? step.label

  if (step.status === 'complete') {
    return { id: step.id, label, status: 'done', page }
  }

  // MVR / PSP "in progress" means an order is processing — the candidate has
  // nothing to do, so show an honest Waiting row instead of fake work.
  if (step.id === 'driver-mvr' && step.status === 'in_progress') {
    return { id: step.id, label: 'MVR processing', status: 'waiting', page, waitingOn: 'Record is being pulled — no action needed' }
  }
  if (step.id === 'driver-psp' && step.status === 'in_progress') {
    return { id: step.id, label: 'PSP report processing', status: 'waiting', page, waitingOn: 'Report is being pulled — no action needed' }
  }

  return {
    id: step.id,
    label,
    status: step.status === 'in_progress' ? 'in-progress' : 'todo',
    page,
  }
}

/** Build the pinned "Finish X for {Company}" item from the newest pending request. */
function requestToItem(
  request: PendingEmployerRequest,
  journeyItems: TodoItem[],
): TodoItem {
  // Legacy mvr_order / psp_order rows have no targetBlockType — normalize.
  const blockType =
    request.targetBlockType ??
    (request.requestType === 'psp_order' ? 'driver-psp' : 'driver-mvr')

  const def = getBlockDefinition(blockType)
  const page = (def?.pageRoute ?? 'screening-consent') as PageType
  const what = def?.requestLabel?.toLowerCase() ?? 'screening'

  // If the candidate already finished their side (e.g. consent signed but the
  // request row is still open), the ball is in the employer's court.
  const journeyMatch = journeyItems.find((i) => i.id === blockType)
  if (journeyMatch?.status === 'done' || journeyMatch?.status === 'waiting') {
    return {
      id: `request-${request.id}`,
      label: `${def?.requestLabel ?? 'Screening'} sent to ${request.companyName}`,
      status: 'waiting',
      page,
      waitingOn: `Waiting on ${request.companyName}`,
    }
  }

  return {
    id: `request-${request.id}`,
    label: `Finish ${what} for ${request.companyName}`,
    status: 'todo',
    page,
  }
}

export function buildCandidateTodo(
  journey: JourneyProgress,
  pendingRequest: PendingEmployerRequest | null,
  hasBlocks: boolean,
): CandidateTodo {
  const journeyItems = journey.steps
    .map(stepToItem)
    .filter((i): i is TodoItem => i !== null)

  const items: TodoItem[] = []

  // 1. Pinned employer request always wins the top slot (and the primary CTA).
  if (pendingRequest) {
    const pinned = requestToItem(pendingRequest, journeyItems)
    items.push(pinned)
    // Drop the journey twin so the same task doesn't appear twice.
    const twin =
      pendingRequest.targetBlockType ??
      (pendingRequest.requestType === 'psp_order' ? 'driver-psp' : 'driver-mvr')
    const idx = journeyItems.findIndex((i) => i.id === twin)
    if (idx !== -1) journeyItems.splice(idx, 1)
  }

  // 2. Brand-new user with zero blocks — one obvious step, never an empty hub.
  if (!hasBlocks) {
    items.push({ id: 'add-block', label: 'Add your first block', status: 'todo', page: 'hub' })
  }

  items.push(...journeyItems)

  // 3. Cap at 7, keeping actionable rows over done ones.
  const actionable = items.filter((i) => i.status !== 'done')
  const done = items.filter((i) => i.status === 'done')
  const capped = [...actionable, ...done].slice(0, MAX_ITEMS)
  // Restore original (journey) order inside the cap so done rows stay in place.
  const kept = new Set(capped.map((i) => i.id))
  const final = items.filter((i) => kept.has(i.id))

  const primary = final.find((i) => i.status === 'todo' || i.status === 'in-progress') ?? null

  return {
    invitedBy: pendingRequest?.companyName ?? null,
    items: final,
    primary,
    doneCount: final.filter((i) => i.status === 'done').length,
  }
}
