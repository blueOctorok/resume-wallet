'use client'

import { cn } from '@/lib/utils'
import type { DqItemStatus, DqOverallStatus } from '@/lib/dq-file-status'
import { dqOverallLabel } from '@/lib/dq-file-status'

const ITEM_LABELS: Record<DqItemStatus, string> = {
  complete: 'Complete',
  processing: 'Processing',
  in_progress: 'In progress',
  requested: 'Requested',
  missing: 'Missing',
  failed: 'Failed',
  needs_driver: 'Needs driver',
  needs_key: 'Needs Key',
  needs_gov: 'Needs gov’t',
  needs_employer: 'Needs employer',
  coming_soon: 'Coming soon',
}

function toneForItem(status: DqItemStatus): string {
  switch (status) {
    case 'complete':
      // Emerald, not teal — teal is remapped to gold and washes out on paper.
      return 'bg-emerald-50 text-emerald-900 ring-emerald-200'
    case 'processing':
    case 'in_progress':
    case 'requested':
      return 'bg-stone-100 text-[#173150] ring-stone-200'
    case 'failed':
      return 'bg-red-50 text-red-800 ring-red-200'
    default:
      return 'bg-stone-100 text-[#173150] ring-stone-200'
  }
}

function toneForOverall(status: DqOverallStatus): string {
  switch (status) {
    case 'complete':
      return 'bg-emerald-50 text-emerald-900 ring-emerald-200'
    case 'in_progress':
    case 'started':
      return 'bg-stone-100 text-[#173150] ring-stone-200'
    default:
      return 'bg-stone-100 text-[#173150] ring-stone-200'
  }
}

export function DqItemStatusBadge({ status }: { status: DqItemStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset',
        toneForItem(status),
      )}
    >
      {ITEM_LABELS[status]}
    </span>
  )
}

export function DqOverallStatusBadge({
  status,
  completedCount,
  totalLiveCount,
}: {
  status: DqOverallStatus
  completedCount?: number
  totalLiveCount?: number
}) {
  const count =
    typeof completedCount === 'number' && typeof totalLiveCount === 'number'
      ? ` · ${completedCount}/${totalLiveCount}`
      : ''
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset',
        toneForOverall(status),
      )}
    >
      {dqOverallLabel(status)}
      {count}
    </span>
  )
}
