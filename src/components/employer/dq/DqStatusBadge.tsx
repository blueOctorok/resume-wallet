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
      return 'bg-teal-100 text-teal-800 dark:bg-teal-500/20 dark:text-teal-200 ring-teal-200/80 dark:ring-teal-400/30'
    case 'processing':
    case 'in_progress':
    case 'requested':
      return 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200 ring-amber-200/80 dark:ring-amber-400/30'
    case 'failed':
      return 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200 ring-red-200/80 dark:ring-red-400/30'
    default:
      return 'bg-slate-100 text-slate-700 dark:bg-gray-700 dark:text-gray-300 ring-slate-200/80 dark:ring-gray-600'
  }
}

function toneForOverall(status: DqOverallStatus): string {
  switch (status) {
    case 'complete':
      return 'bg-teal-100 text-teal-800 dark:bg-teal-500/20 dark:text-teal-200 ring-teal-200/80 dark:ring-teal-400/30'
    case 'in_progress':
    case 'started':
      return 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200 ring-amber-200/80 dark:ring-amber-400/30'
    default:
      return 'bg-slate-100 text-slate-700 dark:bg-gray-700 dark:text-gray-300 ring-slate-200/80 dark:ring-gray-600'
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
