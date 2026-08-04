'use client'

import {
  CheckCircle2,
  ClipboardList,
  FileWarning,
  IdCard,
  Shield,
  Stethoscope,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import HubSectionPanel from '@/components/hub/HubSectionPanel'
import BlockCard from '@/components/ui/BlockCard'
import { isDarkTheme } from '@/lib/theme-storage'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'
import type { DqFileSnapshot, DqItemStatusResult } from '@/lib/dq-file-status'
import type { DqItemId } from '@/lib/dq-file-registry'
import { DqItemStatusBadge, DqOverallStatusBadge } from './DqStatusBadge'

const ITEM_ICONS: Partial<Record<DqItemId, LucideIcon>> = {
  mvr: Shield,
  psp: Shield,
  dot_application: ClipboardList,
  cdlis_consent: FileWarning,
  employment_verification: ClipboardList,
  dl_images: IdCard,
  med_card: Stethoscope,
  criminal_bg: Shield,
  drug_screen: Stethoscope,
  clearinghouse: Shield,
  cdlis_report: FileWarning,
}

function formatRelative(iso: string | null): string | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  const days = Math.round((Date.now() - t) / (24 * 60 * 60 * 1000))
  if (days <= 0) return 'Updated today'
  if (days === 1) return 'Updated yesterday'
  if (days < 30) return `Updated ${days}d ago`
  return `Updated ${new Date(t).toLocaleDateString()}`
}

function DqItemBox({
  item,
  isDark,
}: {
  item: DqItemStatusResult
  isDark: boolean
}) {
  const Icon = ITEM_ICONS[item.id] ?? ClipboardList
  const done = item.status === 'complete'

  return (
    <div
      className={cn(
        'rounded-xl border p-3 flex flex-col gap-2 min-h-[7.5rem]',
        done
          ? 'border-teal-200 bg-teal-50/60 dark:border-teal-500/30 dark:bg-teal-500/10'
          : isDark
            ? 'border-gray-700 bg-gray-900/40'
            : 'border-slate-200 bg-slate-50/80',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1',
              done
                ? 'bg-teal-100 text-teal-700 ring-teal-200 dark:bg-teal-500/20 dark:text-teal-200 dark:ring-teal-400/30'
                : 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-600',
            )}
          >
            {done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 dark:text-gray-100 truncate">
              {item.label}
            </p>
            {item.cfrNote && (
              <p className="text-[10px] text-slate-500 dark:text-gray-400">{item.cfrNote}</p>
            )}
          </div>
        </div>
        <DqItemStatusBadge status={item.status} />
      </div>

      <p className="text-xs text-slate-600 dark:text-gray-400 line-clamp-2">
        {item.status === 'complete' || item.status === 'processing' || item.status === 'in_progress'
          ? item.description
          : item.emptyHint}
      </p>

      <div className="mt-auto flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-gray-400">
        {item.sourceChip && (
          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 dark:bg-gray-800">
            {item.sourceChip}
          </span>
        )}
        {formatRelative(item.updatedAt) && <span>{formatRelative(item.updatedAt)}</span>}
        {item.hireClock && (
          <span
            className={cn(
              'rounded-md px-1.5 py-0.5',
              item.hireClock.overdue
                ? 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200'
                : 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200',
            )}
          >
            {item.hireClock.overdue
              ? 'EV overdue (30-day)'
              : `EV due in ${item.hireClock.daysRemaining}d`}
          </span>
        )}
      </div>
    </div>
  )
}

interface DqFileSectionProps {
  dqFile: DqFileSnapshot
  /** When true, omit outer HubSectionPanel (already inside another panel). */
  embedded?: boolean
  title?: string
  description?: string
}

export default function DqFileSection({
  dqFile,
  embedded = false,
  title = 'Driver Qualification file',
  description = 'Company-scoped compliance checklist. Employer-paid reports stay private to your company.',
}: DqFileSectionProps) {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)

  const live = dqFile.items.filter((i) => i.blocksOverallCompletion)
  const placeholders = dqFile.items.filter((i) => !i.blocksOverallCompletion)

  const body = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <DqOverallStatusBadge
          status={dqFile.overall}
          completedCount={dqFile.completedCount}
          totalLiveCount={dqFile.totalLiveCount}
        />
        <span className="text-xs text-slate-500 dark:text-gray-400">
          Live items only count toward complete in v1
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {live.map((item) => (
          <DqItemBox key={item.id} item={item} isDark={isDark} />
        ))}
      </div>

      {placeholders.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-gray-400 mb-2">
            Coming online
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {placeholders.map((item) => (
              <DqItemBox key={item.id} item={item} isDark={isDark} />
            ))}
          </div>
        </div>
      )}
    </div>
  )

  if (embedded) {
    return body
  }

  return (
    <HubSectionPanel isDark={isDark} accent="teal">
      <BlockCard variant="embed" icon={ClipboardList} title={title} description={description}>
        {body}
      </BlockCard>
    </HubSectionPanel>
  )
}
