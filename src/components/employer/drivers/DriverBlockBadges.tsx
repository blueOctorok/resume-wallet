'use client'

import {
  Building2,
  Car,
  ClipboardList,
  FileSearch,
  IdCard,
  ShieldCheck,
  Stethoscope,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DqItemId } from '@/lib/dq-file-registry'
import type { DqItemStatus } from '@/lib/dq-file-status'
import { BALL_LABEL, type BallInCourt, type DqItemLite } from '@/lib/driver-journey'

// ── Shared visual vocabulary for DQ items (board chips + driver file rows) ──

export const DQ_ITEM_ICONS: Record<DqItemId, LucideIcon> = {
  dl_images: IdCard,
  dot_application: ClipboardList,
  cdlis_consent: ShieldCheck,
  mvr: Car,
  psp: FileSearch,
  employment_verification: Building2,
  med_card: Stethoscope,
}

/** Short names that fit in a chip. Full labels come from the registry. */
export const DQ_ITEM_SHORT: Record<DqItemId, string> = {
  dl_images: 'License',
  dot_application: 'DOT',
  cdlis_consent: 'Consent',
  mvr: 'MVR',
  psp: 'PSP',
  employment_verification: 'EV',
  med_card: 'Med',
}

export const DQ_STATUS_LABEL: Record<DqItemStatus, string> = {
  complete: 'Complete',
  processing: 'Processing',
  in_progress: 'In progress',
  requested: 'Sent, unsigned',
  missing: 'Missing',
  failed: 'Failed',
  needs_driver: 'Needs driver',
  needs_key: 'Needs Key',
  needs_gov: 'Needs gov’t',
  needs_employer: 'Needs employer',
  coming_soon: 'Coming soon',
}

/** One palette, used everywhere a status shows: done = emerald, moving = amber, with driver = denim, broken = red, missing = hollow. */
export function dqStatusTone(status: DqItemStatus): string {
  switch (status) {
    case 'complete':
      return 'bg-emerald-50 text-emerald-800 ring-emerald-200'
    case 'processing':
      return 'bg-dark-amber/10 text-dark-amber ring-dark-amber/30'
    case 'in_progress':
    case 'requested':
      return 'bg-sky-50 text-sky-900 ring-sky-200'
    case 'failed':
      return 'bg-red-50 text-red-800 ring-red-200'
    case 'missing':
      return 'bg-white text-ironside ring-stone-300 ring-dashed'
    default:
      return 'bg-stone-50 text-ironside/70 ring-stone-200'
  }
}

export function DqStatusBadge({ status, className }: { status: DqItemStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset',
        dqStatusTone(status),
        className,
      )}
    >
      {status === 'processing' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
      {DQ_STATUS_LABEL[status]}
    </span>
  )
}

/**
 * The at-a-glance strip: one chip per live DQ item, colored by status.
 * Hover for the full label — the chip itself stays short so six fit on a row.
 */
export default function DriverBlockBadges({ items, className }: { items: DqItemLite[]; className?: string }) {
  return (
    <ul className={cn('flex flex-wrap items-center gap-1', className)} aria-label="DQ items">
      {items.map((item) => {
        const Icon = DQ_ITEM_ICONS[item.id]
        return (
          <li
            key={item.id}
            title={`${DQ_ITEM_SHORT[item.id]} — ${DQ_STATUS_LABEL[item.status]}`}
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset',
              dqStatusTone(item.status),
            )}
          >
            <Icon className="h-3 w-3" />
            {DQ_ITEM_SHORT[item.id]}
            {item.status === 'processing' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
          </li>
        )
      })}
    </ul>
  )
}

// ── Whose move ────────────────────────────────────────────────────────────

export function ballTone(ball: BallInCourt): string {
  switch (ball) {
    case 'you':
      return 'bg-[#f15a2b] text-white ring-[#f15a2b]'
    case 'attention':
      return 'bg-red-600 text-white ring-red-600'
    case 'processing':
      return 'bg-dark-amber/10 text-dark-amber ring-dark-amber/30'
    case 'driver':
      return 'bg-sky-50 text-sky-900 ring-sky-200'
    case 'done':
      return 'bg-emerald-50 text-emerald-800 ring-emerald-200'
  }
}

export function BallPill({ ball, className }: { ball: BallInCourt; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
        ballTone(ball),
        className,
      )}
    >
      {ball === 'processing' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
      {BALL_LABEL[ball]}
    </span>
  )
}
