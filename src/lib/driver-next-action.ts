/**
 * Single primary action for the driver Career Card home.
 *
 * Resume upload and the license scan come first — both fill the DOT
 * application. MVR and PSP stay in the File; they are not a card action.
 */

import type { JourneyProgress, JourneyStep } from '@/lib/journey-progress'
import type { PageType } from '@/stores/types'

export interface DriverNextAction {
  id: string
  label: string
  /** null = open profile setup modal */
  page: PageType | null
  /** True when this is a first-time start (e.g. empty DOT → show prefill prompt). */
  isFreshStart?: boolean
}

const DRIVER_STEP_PRIORITY = [
  'storm-resume',
  'driver-resume',
  'driver-license',
  'driver-dot-application',
  'profile',
  'driver-screening-consent',
] as const

const LABELS: Record<string, string> = {
  profile: 'Finish your profile',
  'driver-dot-application': 'Start your DOT application',
  'driver-screening-consent': 'Sign screening consent',
  'storm-resume': 'Upload your resume',
  'driver-resume': 'Upload your resume',
  'driver-license': 'Scan your license',
}

const CONTINUE_LABELS: Record<string, string> = {
  'driver-dot-application': 'Continue your DOT application',
  'driver-screening-consent': 'Finish screening consent',
  'driver-mvr': 'Check your MVR',
}

function isActionable(step: JourneyStep): boolean {
  return step.status === 'pending' || step.status === 'in_progress'
}

export function getDriverNextAction(journey: JourneyProgress): DriverNextAction | null {
  const byId = new Map(journey.steps.map((s) => [s.id, s]))

  for (const id of DRIVER_STEP_PRIORITY) {
    const step = byId.get(id)
    if (!step || !isActionable(step)) continue

    const page: PageType = id === 'profile' ? null : (step.action?.target ?? null)
    const label =
      step.status === 'in_progress'
        ? (CONTINUE_LABELS[id] ?? LABELS[id] ?? step.label)
        : (LABELS[id] ?? step.action?.label ?? step.label)

    return {
      id,
      label,
      page,
      isFreshStart: step.status === 'pending',
    }
  }

  // Fallback: any other actionable non-optional step with a page target
  for (const step of journey.steps) {
    if (!isActionable(step) || step.isOptional) continue
    if (step.id === 'wallet' || step.id === 'referral' || step.id === 'find-jobs' || step.id === 'driver-psp') continue
    if (!step.action?.target && step.id !== 'profile') continue
    return {
      id: step.id,
      label: step.action?.label ?? step.label,
      page: step.action?.target ?? null,
      isFreshStart: step.status === 'pending',
    }
  }

  return null
}
