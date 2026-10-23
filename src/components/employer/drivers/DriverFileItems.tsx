'use client'

import { ExternalLink, Loader2, Mail, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import Button from '@/components/ui/Button'
import type { DriverFileDetail } from '@/lib/dq-file-load'
import { dqItemHasWorkToShow, type DqItemStatusResult } from '@/lib/dq-file-status'
import { consentBoardLine, dotBoardLine, evBoardLine, licenseBoardLine, screeningBoardLine } from '@/lib/dq-board-lines'
import { DQ_ITEM_ICONS, DqStatusBadge } from './DriverBlockBadges'

export function fmtDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export interface ItemActions {
  onViewReport: (kind: 'mvr' | 'psp', orderId: string) => void
  onViewConsent: (bundleId: string) => void
  onViewDot: (applicationId: string) => void
  onViewLicense: () => void
  onViewEmployment: () => void
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
      const base = licenseBoardLine({
        confirmed: Boolean(l?.confirmedAt),
        barcodeRead: l?.barcodeStatus === 'read',
      })
      if (!l || (l.barcodeStatus !== 'read' && !l.confirmedAt)) return { line: base }
      const read = [l.licenseClass && `Class ${l.licenseClass}`, l.state, l.expiration && `exp ${l.expiration}`].filter(Boolean).join(' · ')
      const source = l.barcodeStatus === 'read' ? 'Read from the license barcode' : 'Entered by the driver'
      return {
        line: [base, read, source].filter(Boolean).join(' · '),
        action: dqItemHasWorkToShow(item.status) ? <ViewBtn label="View license" onClick={a.onViewLicense} /> : undefined,
      }
    }

    case 'dot_application': {
      const app = d.dotApplication
      const base = dotBoardLine({ status: item.status, currentStep: app?.currentStep })
      if (!app) return { line: base }
      const when = fmtDate(app.updatedAt)
      return {
        line: when ? `${base} · ${when}` : base,
        action: dqItemHasWorkToShow(item.status) ? <ViewBtn label="View application" onClick={() => a.onViewDot(app.id)} /> : undefined,
      }
    }

    case 'cdlis_consent': {
      const c = d.consent
      const invite = d.invites.find(
        (row) => row.blockType === 'driver-screening-consent' && ['pending', 'viewed', 'in_progress'].includes(row.status),
      )
      const line = consentBoardLine({
        status: item.status,
        signedAt: c?.completedAt,
        startedAt: c?.createdAt,
        invite: invite ? { status: invite.status, viewCount: invite.viewCount, createdAt: invite.createdAt } : null,
      })
      const parts = c?.status === 'complete'
        ? [c.parts.fcra && 'FCRA', c.parts.psp && 'PSP', c.parts.cdlis && 'CDLIS'].filter(Boolean).join(' · ')
        : ''
      if (c?.status === 'complete') {
        return {
          line: parts ? `${line} · ${parts}` : line,
          action: <ViewBtn label="View package" onClick={() => a.onViewConsent(c.id)} />,
        }
      }
      if (c) {
        return {
          line,
          action: dqItemHasWorkToShow(item.status) ? <ViewBtn label="View package" onClick={() => a.onViewConsent(c.id)} /> : undefined,
        }
      }
      if (item.status === 'requested') {
        return {
          line,
          action: (
            <div className="flex items-center gap-1">
              <ResendBtn channel="email" icon={Mail} enabled={a.hasEmail} busy={a.resending} onClick={a.onResendConsent} />
              <ResendBtn channel="sms" icon={MessageSquare} enabled={a.hasPhone} busy={a.resending} onClick={a.onResendConsent} />
            </div>
          ),
        }
      }
      return { line }
    }

    case 'mvr':
    case 'psp': {
      const kind = item.id
      const orders = d.screenings.filter((s) => s.kind === kind)
      const newest = orders[0]
      if (!newest) return { line: item.emptyHint }
      const base = screeningBoardLine({
        itemStatus: item.status,
        orderStatus: newest.status,
        outcome: newest.outcome,
        errorMessage: newest.errorMessage,
        errorCode: newest.errorCode,
      })
      const extra = orders.length > 1 ? `${orders.length} pulls` : null
      const provenance = newest.orderedByYou ? null : 'On file via another employer'
      const refresh = item.refreshDue ? 'refresh due' : null
      const line = [base, refresh, extra, provenance].filter(Boolean).join(' · ')
      // A pull paid by a different company stays a fact on the board. This
      // company's own order, including one placed from its consent, opens.
      const action =
        item.status === 'complete' && newest.orderedByYou ? (
          <ViewBtn label="View report" onClick={() => a.onViewReport(kind, newest.id)} />
        ) : undefined
      return { line, action }
    }

    case 'employment_verification': {
      const base = evBoardLine(item.status)
      const evs = d.employmentVerifications
      if (evs.length === 0) return { line: base }
      const verified = evs.filter((e) => e.status === 'VERIFIED' || e.status === 'PARTIALLY_VERIFIED').length
      const clock = item.hireClock
        ? item.hireClock.overdue
          ? '30-day clock overdue'
          : `due in ${item.hireClock.daysRemaining}d`
        : null
      const detail = `${evs.length} employer${evs.length === 1 ? '' : 's'} · ${verified} verified`
      return {
        line: [base, detail, clock].filter(Boolean).join(' · '),
        action: dqItemHasWorkToShow(item.status) ? <ViewBtn label="View" onClick={a.onViewEmployment} /> : undefined,
      }
    }

    default:
      return { line: item.emptyHint }
  }
}

function ViewBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button type="button" variant="secondary" size="sm" onClick={onClick}>
      <ExternalLink className="h-3.5 w-3.5" />
      {label}
    </Button>
  )
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
