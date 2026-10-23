/**
 * A short recruiter note about one driver.
 * The facts are the same status lines the board already shows. The model
 * may only rephrase those. If it is down, the fallback says the same thing.
 */

import { rosterWhereLine } from '@/lib/dq-board-lines'
import { deriveDriverJourney } from '@/lib/driver-journey'
import type { DqItemId } from '@/lib/dq-file-registry'
import type { DqItemStatus } from '@/lib/dq-file-status'

const PLAIN_LABEL: Partial<Record<DqItemId, string>> = {
  cdlis_consent: 'Screening consent',
  mvr: 'Motor vehicle record',
  psp: 'PSP report',
  dl_images: 'License',
  dot_application: 'DOT application',
  employment_verification: 'Employment check',
}

export interface RecruiterStatusItem {
  id: DqItemId
  status: DqItemStatus
  line: string
}

export function recruiterStatusFacts(items: readonly RecruiterStatusItem[]): { stuck: string; lines: string[] } {
  const journey = deriveDriverJourney([...items])
  return {
    stuck: rosterWhereLine(journey.next, items),
    lines: items.map((item) => `${PLAIN_LABEL[item.id] ?? item.id}: ${item.line}`),
  }
}

/** Used when the model is unavailable, and as the facts the model is allowed to rephrase. */
export function recruiterStatusFallback(name: string, items: readonly RecruiterStatusItem[]): string {
  const { stuck, lines } = recruiterStatusFacts(items)
  const detail = lines.join(' ')
  if (stuck === 'DQ file complete') {
    return `${name}'s qualification file is complete. ${detail}`.trim()
  }
  return `${name} is stuck on this: ${stuck}. ${detail}`.trim()
}

export function recruiterStatusPrompt(name: string, items: readonly RecruiterStatusItem[]): string {
  const { stuck, lines } = recruiterStatusFacts(items)
  return [
    `Driver: ${name}`,
    `Hung up on: ${stuck}`,
    'File:',
    ...lines.map((line) => `- ${line}`),
  ].join('\n')
}

export const RECRUITER_STATUS_SYSTEM = `You write a short note from a trucking company's HR person to a recruiter.
The recruiter does not use this app.

Use only the facts in the user message. Do not add steps, dates, employers, or reasons that are not written there.
Write 2 or 3 short sentences. Say what is already done and what the driver is stuck on.
If the file is complete, say that in one sentence.
Plain words. No greeting, no sign-off, no bullet list.`
