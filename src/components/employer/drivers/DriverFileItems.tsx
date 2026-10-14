'use client'

import { ChevronDown, ExternalLink, Loader2, Mail, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import Button from '@/components/ui/Button'
import type { DqItemStatusResult } from '@/lib/dq-file-status'
import type { DriverFileDetail } from '@/lib/dq-file-load'
import { outcomeLabel } from '@/lib/accio-result-status'
import { DQ_ITEM_ICONS, DqStatusBadge } from './DriverBlockBadges'

export function fmtDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

const EV_STATUS_LABEL: Record<string, string> = {
  VERIFICATION_REQUESTED: 'Requested',
  VERIFICATION_IN_PROGRESS: 'In progress',
  SELF_REPORTED: 'Self-reported',
  VERIFIED: 'Verified',
  PARTIALLY_VERIFIED: 'Partially verified',
  VERIFICATION_DENIED: 'Denied',
  ATTEMPTS_EXHAUSTED: 'No response',
  VERIFICATION_DECLINED: 'Declined',
}

export interface ItemActions {
  onViewReport: (kind: 'mvr' | 'psp', orderId: string) => void
  onViewConsent: (bundleId: string) => void
  onResendConsent: (channel: 'email' | 'sms') => Promise<void>
  resending: 'email' | 'sms' | null
  hasEmail: boolean
  hasPhone: boolean
}

/**
 * One row per DQ item: icon, name, status, and the sentence a recruiter
 * actually wants ("Completed Oct 9 · Clear", "Form 2 of 3", "Sent 2d ago,
 * unsigned"). Actions sit on the right and only appear when they can work.
 */
export default function DriverFileItemRow({
  item,
  detail,
  actions,
}: {
  item: DqItemStatusResult
  detail: DriverFileDetail
  actions: ItemActions
}) {
  const Icon = DQ_ITEM_ICONS[item.id]
  const { line, action } = describe(item, detail, actions)

  return (
    <li className="flex items-start gap-3 px-3 py-2.5">
      <span
        className={cn(
          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset',
          item.status === 'complete' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-stone-100 text-[#173150] ring-stone-200',
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-semibold text-[#173150]">{item.label}</span>
          <DqStatusBadge status={item.status} />
          {item.cfrNote && <span className="text-[10px] text-ironside">{item.cfrNote}</span>}
        </div>
        <div className="mt-0.5 text-xs text-ironside">{line}</div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </li>
  )
}

function describe(
  item: DqItemStatusResult,
  d: DriverFileDetail,
  a: ItemActions,
): { line: React.ReactNode; action?: React.ReactNode } {
  switch (item.id) {
    case 'dl_images': {
      const l = d.license
      if (!l || (!l.hasFront && !l.hasBack)) return { line: item.emptyHint }
      const sides = l.hasFront && l.hasBack ? 'Front & back on file' : l.hasFront ? 'Front only' : 'Back only'
      const read = l.barcodeStatus === 'read' ? [l.licenseClass && `Class ${l.licenseClass}`, l.state, l.expiration && `exp ${l.expiration}`].filter(Boolean).join(' · ') : null
      return {
        line: [sides, read, l.confirmedAt ? `confirmed ${fmtDate(l.confirmedAt)}` : 'not confirmed yet', 'On file — not a verified record'].filter(Boolean).join(' · '),
      }
    }

    case 'dot_application': {
      const app = d.dotApplication
      if (!app) return { line: item.emptyHint }
      return {
        line: app.isComplete
          ? `Submitted · updated ${fmtDate(app.updatedAt) ?? '—'}`
          : `Form ${app.currentStep} of 3 · last worked ${fmtDate(app.updatedAt) ?? '—'}`,
      }
    }

    case 'cdlis_consent': {
      const c = d.consent
      if (c?.status === 'complete') {
        const parts = [c.parts.fcra && 'FCRA', c.parts.psp && 'PSP', c.parts.cdlis && 'CDLIS'].filter(Boolean).join(' · ')
        return {
          line: `Signed ${fmtDate(c.completedAt) ?? '—'} · ${parts}`,
          action: (
            <Button type="button" variant="secondary" size="sm" onClick={() => a.onViewConsent(c.id)}>
              View package
            </Button>
          ),
        }
      }
      if (c) return { line: `Started ${fmtDate(c.createdAt)} · not finished` }
      if (item.status === 'requested') {
        return {
          line: `Sent ${fmtDate(item.updatedAt)} · unsigned`,
          action: (
            <div className="flex items-center gap-1">
              <ResendBtn channel="email" icon={Mail} enabled={a.hasEmail} busy={a.resending} onClick={a.onResendConsent} />
              <ResendBtn channel="sms" icon={MessageSquare} enabled={a.hasPhone} busy={a.resending} onClick={a.onResendConsent} />
            </div>
          ),
        }
      }
      return { line: item.emptyHint }
    }

    case 'mvr':
    case 'psp': {
      const kind = item.id
      const orders = d.screenings.filter((s) => s.kind === kind)
      const newest = orders[0]
      if (!newest) return { line: item.emptyHint }
      const when = fmtDate(newest.completedAt ?? newest.orderedAt)
      const outcome = newest.outcome ? outcomeLabel(newest.outcome) : null
      const extra = orders.length > 1 ? `${orders.length} pulls` : null
      const provenance = newest.orderedByYou ? null : 'On file via another employer'
      const line = [
        item.status === 'complete' ? `Completed ${when}` : item.status === 'processing' ? `Ordered ${when} · processing` : `Order ${newest.status}`,
        outcome,
        extra,
        provenance,
      ]
        .filter(Boolean)
        .join(' · ')
      // Report access follows payment (CRA rule): a pull paid by another employer is a fact on the board, not a document you can open.
      const action =
        item.status === 'complete' && newest.orderedByYou ? (
          <Button type="button" variant="secondary" size="sm" onClick={() => a.onViewReport(kind, newest.id)}>
            <ExternalLink className="h-3.5 w-3.5" />
            View report
          </Button>
        ) : undefined
      return { line, action }
    }

    case 'employment_verification': {
      const evs = d.employmentVerifications
      if (evs.length === 0) return { line: item.emptyHint }
      const verified = evs.filter((e) => e.status === 'VERIFIED' || e.status === 'PARTIALLY_VERIFIED').length
      return {
        line: (
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-1 [&::-webkit-details-marker]:hidden">
              {evs.length} employer{evs.length === 1 ? '' : 's'} · {verified} verified
              {item.hireClock && (
                <span className={cn('ml-1 rounded px-1 py-px text-[10px]', item.hireClock.overdue ? 'bg-red-100 text-red-800' : 'bg-dark-amber/10 text-dark-amber')}>
                  {item.hireClock.overdue ? '30-day clock overdue' : `due in ${item.hireClock.daysRemaining}d`}
                </span>
              )}
              <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
            </summary>
            <ul className="mt-1.5 space-y-1">
              {evs.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 rounded-md bg-stone-50 px-2 py-1">
                  <span className="truncate text-[#173150]">{e.employerName}</span>
                  <span className="shrink-0 text-[11px]">
                    {EV_STATUS_LABEL[e.status] ?? e.status}
                    {e.attemptCount > 0 && ` · ${e.attemptCount} attempt${e.attemptCount === 1 ? '' : 's'}`}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        ),
      }
    }

    default:
      return { line: item.emptyHint }
  }
}

function ResendBtn({
  channel,
  icon: Icon,
  enabled,
  busy,
  onClick,
}: {
  channel: 'email' | 'sms'
  icon: typeof Mail
  enabled: boolean
  busy: 'email' | 'sms' | null
  onClick: (channel: 'email' | 'sms') => Promise<void>
}) {
  const isBusy = busy === channel
  const word = channel === 'sms' ? 'text' : 'email'
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={!enabled || busy !== null}
      title={enabled ? `Resend the consent link by ${word}` : `No ${channel === 'sms' ? 'phone' : 'email'} on file`}
      onClick={() => void onClick(channel)}
    >
      {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
      Resend {word}
    </Button>
  )
}
