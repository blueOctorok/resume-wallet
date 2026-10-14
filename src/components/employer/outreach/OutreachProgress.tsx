'use client'

import { employerScreeningReportReady, hubDocStatusFromScreeningOrder } from '@/lib/hub-document-types'
import StepStrip, { type StripStep } from '@/components/employer/StepStrip'
import type { Invite, ScreeningRow } from './types'
import type { ConsentBundleSummary } from '@/hooks/useEmployerScreenings'

function reportHint(files: ScreeningRow[]): string | undefined {
  const parts = (['mvr', 'psp'] as const).map((kind) => {
    const f = files.find((r) => r.kind === kind)
    if (!f) return `${kind.toUpperCase()} —`
    if (employerScreeningReportReady(f.status)) return `${kind.toUpperCase()} ready`
    const s = hubDocStatusFromScreeningOrder(f.status)
    return `${kind.toUpperCase()} ${s === 'processing' || s === 'in-progress' ? 'processing' : s}`
  })
  return parts.join(' · ')
}

/**
 * Where this invite is, at a glance. Every step is derived from data the
 * modal already has — nothing is stored. The first step that isn't done is
 * "current", which is also exactly what the recruiter should be chasing.
 */
export function deriveOutreachSteps(
  invite: Invite,
  files: ScreeningRow[],
  consentBundle: ConsentBundleSummary | null | undefined,
): StripStep[] {
  const delivered = [invite.emailSentAt && 'Email', invite.smsSentAt && 'Text'].filter(Boolean).join(' · ')
  const opened = invite.viewCount > 0 || ['viewed', 'in_progress', 'completed'].includes(invite.status)
  const isConsent = invite.targetBlockType === 'driver-screening-consent'

  const base: StripStep[] = [
    {
      key: 'sent',
      label: 'Sent',
      hint: delivered || 'Link created, not delivered',
      done: Boolean(delivered),
    },
    { key: 'opened', label: 'Opened', hint: opened ? `${invite.viewCount || 1} view${invite.viewCount === 1 ? '' : 's'}` : undefined, done: opened },
  ]

  if (!isConsent) {
    return [...base, { key: 'completed', label: 'Completed', done: invite.status === 'completed' }]
  }

  const signed = consentBundle?.status === 'complete' || invite.status === 'completed'
  const mvrReady = files.some((f) => f.kind === 'mvr' && employerScreeningReportReady(f.status))
  const pspReady = files.some((f) => f.kind === 'psp' && employerScreeningReportReady(f.status))

  return [
    ...base,
    {
      key: 'signed',
      label: 'Consent signed',
      hint: signed ? 'FCRA · PSP · CDLIS' : consentBundle ? 'Started, not finished' : undefined,
      done: signed,
    },
    {
      key: 'reports',
      label: 'Reports',
      hint: files.length > 0 ? reportHint(files) : signed ? 'Ordering MVR + PSP' : undefined,
      done: mvrReady && pspReady,
    },
  ]
}

export default function OutreachProgress({
  invite,
  files,
  consentBundle,
}: {
  invite: Invite
  files: ScreeningRow[]
  consentBundle?: ConsentBundleSummary | null
}) {
  const terminal = invite.status === 'cancelled' || invite.status === 'expired'
  return (
    <StepStrip
      steps={deriveOutreachSteps(invite, files, consentBundle)}
      muted={terminal}
      ariaLabel="Outreach progress"
    />
  )
}
