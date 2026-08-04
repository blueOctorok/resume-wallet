'use client'

/**
 * Shared "lite" building blocks for the Employer Hub layout mockups.
 *
 * Everything here is restyled WITHIN the existing design language
 * (teal / amber, dark mode, BlockCard-style rows) — no new tokens, no new
 * primitives. The three layouts (Focus Rail, Master–Detail, Priority Stack)
 * all compose these same pieces so we can compare arrangements, not styles.
 */

import { useState } from 'react'
import {
  AlertTriangle,
  Briefcase,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  FileCheck,
  Loader2,
  Mail,
  Package,
  Search,
  Send,
  Sparkles,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import type {
  DqStatus,
  FileStatus,
  MockAttention,
  MockDriver,
  MockOutreach,
  MockStat,
  OutreachStatus,
} from './mock-data'

// ── Status atoms ────────────────────────────────────────────────────────────

const OUTREACH_STATUS: Record<OutreachStatus, { label: string; dot: string; text: string }> = {
  pending: { label: 'Pending', dot: 'bg-amber-400', text: 'text-amber-600 dark:text-amber-400' },
  viewed: { label: 'Viewed', dot: 'bg-sky-400', text: 'text-sky-600 dark:text-sky-400' },
  in_progress: { label: 'In progress', dot: 'bg-teal-400', text: 'text-teal-600 dark:text-teal-400' },
  completed: { label: 'Complete', dot: 'bg-emerald-400', text: 'text-emerald-600 dark:text-emerald-400' },
  expired: { label: 'Expired', dot: 'bg-gray-400', text: 'text-gray-500 dark:text-gray-400' },
}

const DQ_STATUS: Record<DqStatus, { label: string; classes: string }> = {
  complete: {
    label: 'Complete',
    classes: 'bg-emerald-500/15 text-emerald-600 ring-emerald-500/30 dark:text-emerald-300',
  },
  in_progress: {
    label: 'In progress',
    classes: 'bg-teal-500/15 text-teal-600 ring-teal-500/30 dark:text-teal-300',
  },
  started: {
    label: 'Started',
    classes: 'bg-sky-500/15 text-sky-600 ring-sky-500/30 dark:text-sky-300',
  },
  not_started: {
    label: 'Not started',
    classes: 'bg-gray-500/10 text-gray-500 ring-gray-500/25 dark:text-gray-400',
  },
}

function StatusDot({ status }: { status: OutreachStatus }) {
  const cfg = OUTREACH_STATUS[status]
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-medium', cfg.text)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  )
}

export function DqStatusBadge({
  status,
  done,
  total,
  compact = false,
}: {
  status: DqStatus
  done: number
  total: number
  /** Dot + count only — for narrow roster rows where the word would crowd the name. */
  compact?: boolean
}) {
  const cfg = DQ_STATUS[status]
  if (compact) {
    return (
      <span
        title={cfg.label}
        className={cn(
          'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-semibold tabular-nums ring-1 ring-inset',
          cfg.classes,
        )}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
        {done}/{total}
      </span>
    )
  }
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset',
        cfg.classes,
      )}
    >
      {cfg.label}
      <span className="opacity-70">
        {done}/{total}
      </span>
    </span>
  )
}

function FilePill({ file }: { file: { label: string; status: FileStatus } }) {
  const map: Record<FileStatus, { classes: string; icon: React.ReactNode }> = {
    ready: {
      classes: 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/25 dark:text-emerald-300',
      icon: <FileCheck className="h-3 w-3" />,
    },
    processing: {
      classes: 'bg-amber-500/10 text-amber-600 ring-amber-500/25 dark:text-amber-300',
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
    },
    missing: {
      classes: 'bg-gray-500/10 text-gray-500 ring-gray-400/25 dark:text-gray-400',
      icon: <Clock className="h-3 w-3" />,
    },
  }
  const cfg = map[file.status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset',
        cfg.classes,
      )}
    >
      {cfg.icon}
      {file.label}
    </span>
  )
}

// ── Segmented control (single primary workspace tabs) ────────────────────────

export function SegTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: string; count?: number }[]
  value: T
  onChange: (id: T) => void
}) {
  return (
    <div className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-slate-100/80 p-1 ring-1 ring-inset ring-slate-200/80 dark:bg-gray-800/70 dark:ring-gray-700/70">
      {tabs.map((t) => {
        const active = t.id === value
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
              active
                ? 'bg-white text-teal-700 shadow-sm ring-1 ring-teal-500/20 dark:bg-gray-950 dark:text-teal-300 dark:ring-teal-400/25'
                : 'text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-gray-200',
            )}
          >
            {t.label}
            {t.count != null && (
              <span
                className={cn(
                  'rounded-full px-1.5 text-[10px]',
                  active
                    ? 'bg-teal-500/15 text-teal-700 dark:text-teal-300'
                    : 'bg-slate-200/80 text-slate-500 dark:bg-gray-700 dark:text-gray-400',
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ── Attention strip — the single loud, signature element ─────────────────────

export function AttentionList({
  items,
  compact = false,
}: {
  items: MockOutreach[]
  compact?: boolean
}) {
  if (items.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-700 ring-1 ring-inset ring-emerald-500/20 dark:text-emerald-300">
        <CheckCircle className="h-4 w-4" />
        You&apos;re all caught up — nothing needs attention right now.
      </div>
    )
  }
  return (
    <ul className={cn('space-y-2', compact && 'space-y-1.5')}>
      {items.map((o) => (
        <li
          key={o.id}
          className={cn(
            'flex items-start gap-3 rounded-lg border border-amber-300/60 bg-amber-50/70 px-3 py-2.5',
            'dark:border-amber-500/25 dark:bg-amber-950/25',
          )}
        >
          <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-violet-500/15 text-violet-600 dark:text-violet-300">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-900 dark:text-gray-100">
              {o.name}
              <span className="mx-1.5 text-amber-500">·</span>
              <span className="text-amber-700 dark:text-amber-300">{o.attention?.label}</span>
            </p>
            {!compact && (
              <p className="mt-0.5 text-[11px] leading-snug text-slate-600 dark:text-gray-400">
                {o.attention?.reason}
              </p>
            )}
          </div>
          <Button type="button" variant="primary" size="sm" className="shrink-0 !py-1 !text-xs">
            {o.attention?.cta}
          </Button>
        </li>
      ))}
    </ul>
  )
}

// ── Outreach row (LIGHT) — secondary info collapsed behind a chevron ─────────

export function OutreachRowLite({
  o,
  defaultOpen = false,
}: {
  o: MockOutreach
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const readyCount = o.files.filter((f) => f.status === 'ready').length
  return (
    <li className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-gray-800/60"
      >
        <Avatar name={o.name} avatarUrl={null} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-gray-100">{o.name}</p>
            {o.attention && (
              <span
                className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300"
                title={o.attention.reason}
              >
                <AlertTriangle className="h-2.5 w-2.5" />
                Action
              </span>
            )}
          </div>
          {/* Secondary line stays to ONE quiet row: block + age only */}
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-slate-500 dark:text-gray-400">
            <Package className="h-3 w-3" />
            {o.block}
            <span>·</span>
            {o.agedLabel}
            <span>·</span>
            {readyCount}/{o.files.length} files
          </p>
        </div>
        <StatusDot status={o.status} />
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-slate-400 transition-transform dark:text-gray-500',
            open && 'rotate-180',
          )}
        />
      </button>

      {/* Everything heavy — files, contact, actions — lives here, hidden until asked for */}
      {open && (
        <div className="border-t border-slate-100 bg-slate-50/60 px-3 py-3 dark:border-gray-800 dark:bg-gray-900/40">
          {o.attention && (
            <div className="mb-3 flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50/80 px-2.5 py-2 dark:border-amber-500/25 dark:bg-amber-950/25">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-600 dark:text-violet-300" />
              <p className="text-[11px] leading-snug text-slate-700 dark:text-gray-300">
                {o.attention.reason}
              </p>
            </div>
          )}
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            {o.files.map((f) => (
              <FilePill key={f.label} file={f} />
            ))}
          </div>
          <p className="mb-3 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-gray-400">
            <Mail className="h-3 w-3" />
            {o.email}
            {o.jobTitle && (
              <>
                <span>·</span>
                <Briefcase className="h-3 w-3" />
                {o.jobTitle}
              </>
            )}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {o.attention ? (
              <Button type="button" variant="primary" size="sm" className="!py-1 !text-xs">
                {o.attention.cta}
              </Button>
            ) : (
              <Button type="button" variant="secondary" size="sm" className="!py-1 !text-xs">
                <Send className="h-3 w-3" />
                Send reminder
              </Button>
            )}
            <Button type="button" variant="ghost" size="sm" className="!py-1 !text-xs">
              <Copy className="h-3 w-3" />
              Copy link
            </Button>
            <Button type="button" variant="ghost" size="sm" className="!py-1 !text-xs">
              <Sparkles className="h-3 w-3" />
              Ask Stormi
            </Button>
          </div>
        </div>
      )}
    </li>
  )
}

export function OutreachRowList({ items }: { items: MockOutreach[] }) {
  return (
    <ul className="divide-y divide-slate-200/80 overflow-hidden rounded-xl border border-slate-200/80 dark:divide-gray-700/60 dark:border-gray-700/60">
      {items.map((o) => (
        <OutreachRowLite key={o.id} o={o} />
      ))}
    </ul>
  )
}

// ── DQ roster (list → click name → detail) ───────────────────────────────────

export function DriverRosterList({
  drivers,
  selectedId,
  onSelect,
  compact = false,
}: {
  drivers: MockDriver[]
  selectedId?: string | null
  onSelect: (d: MockDriver) => void
  /** Use dot + count status pills so long names survive a narrow column. */
  compact?: boolean
}) {
  const [q, setQ] = useState('')
  const filtered = drivers.filter((d) => d.name.toLowerCase().includes(q.trim().toLowerCase()))
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-gray-500" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search drivers by name…"
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-teal-500/30 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:placeholder:text-gray-500"
        />
      </div>
      <ul className="max-h-[26rem] divide-y divide-slate-200/80 overflow-y-auto rounded-xl border border-slate-200/80 dark:divide-gray-700/60 dark:border-gray-700/60">
        {filtered.map((d) => {
          const active = d.id === selectedId
          return (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => onSelect(d)}
                className={cn(
                  'flex w-full items-center gap-2.5 px-3 py-3 text-left transition-colors',
                  active
                    ? 'bg-teal-50 dark:bg-teal-500/10'
                    : 'hover:bg-slate-50 dark:hover:bg-gray-800/60',
                )}
              >
                <Avatar name={d.name} avatarUrl={null} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-gray-100">
                    {d.name}
                  </p>
                  <p className="truncate text-[11px] text-slate-500 dark:text-gray-400">
                    {d.activity}
                  </p>
                </div>
                <DqStatusBadge
                  status={d.status}
                  done={d.done}
                  total={d.total}
                  compact={compact}
                />
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 dark:text-gray-600" />
              </button>
            </li>
          )
        })}
        {filtered.length === 0 && (
          <li className="px-3 py-8 text-center text-sm text-slate-500 dark:text-gray-400">
            No drivers match &ldquo;{q}&rdquo;.
          </li>
        )}
      </ul>
    </div>
  )
}

// ── Candidate detail (opened from a roster row) ──────────────────────────────

export function CandidateDetailCard({
  driver,
  onClose,
}: {
  driver: MockDriver
  onClose?: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Avatar name={driver.name} avatarUrl={null} size="lg" />
        <div className="min-w-0 flex-1">
          <h4 className="text-base font-semibold text-slate-900 dark:text-white">{driver.name}</h4>
          <p className="text-xs text-slate-500 dark:text-gray-400">{driver.activity}</p>
        </div>
        <DqStatusBadge status={driver.status} done={driver.done} total={driver.total} />
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">
          DQ file checklist
        </p>
        <ul className="divide-y divide-slate-200/80 overflow-hidden rounded-xl border border-slate-200/80 dark:divide-gray-700/60 dark:border-gray-700/60">
          {driver.files.map((f) => (
            <li key={f.label} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <span className="flex items-center gap-2 text-sm text-slate-700 dark:text-gray-300">
                {f.status === 'ready' ? (
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                ) : f.status === 'processing' ? (
                  <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                ) : (
                  <Clock className="h-4 w-4 text-slate-400 dark:text-gray-500" />
                )}
                {f.label}
              </span>
              {f.status === 'ready' ? (
                <Button type="button" variant="ghost" size="sm" className="!py-1 !text-xs">
                  View
                </Button>
              ) : f.status === 'processing' ? (
                <span className="text-[11px] text-amber-600 dark:text-amber-400">Processing…</span>
              ) : (
                <Button type="button" variant="secondary" size="sm" className="!py-1 !text-xs">
                  Order
                </Button>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="primary" size="sm">
          <Sparkles className="h-3.5 w-3.5" />
          Ask Stormi about {driver.name.split(' ')[0]}
        </Button>
        <Button type="button" variant="ghost" size="sm">
          <Mail className="h-3.5 w-3.5" />
          Message
        </Button>
        {onClose && (
          <Button type="button" variant="ghost" size="sm" className="ml-auto" onClick={onClose}>
            Close
          </Button>
        )}
      </div>
    </div>
  )
}

// ── Quiet secondary pieces (recede below the primary work) ───────────────────

export function StatStrip({ stats }: { stats: MockStat[] }) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-slate-200/70 ring-1 ring-slate-200/70 dark:bg-gray-800 dark:ring-gray-700/60 sm:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="bg-white px-4 py-3 dark:bg-gray-950">
          <p className="text-[11px] font-medium text-slate-500 dark:text-gray-400">{s.label}</p>
          <p
            className={cn(
              'mt-0.5 text-xl font-bold tracking-tight',
              s.highlight
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-slate-900 dark:text-white',
            )}
          >
            {s.value}
          </p>
          {s.sub && <p className="text-[10px] text-slate-400 dark:text-gray-500">{s.sub}</p>}
        </div>
      ))}
    </div>
  )
}

export function JobsMini({
  jobs,
}: {
  jobs: { id: string; title: string; applicants: number; isActive: boolean }[]
}) {
  return (
    <ul className="space-y-1.5">
      {jobs.map((j) => (
        <li
          key={j.id}
          className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-gray-800/60"
        >
          <Briefcase className="h-3.5 w-3.5 text-slate-400 dark:text-gray-500" />
          <span className="flex-1 truncate text-sm text-slate-700 dark:text-gray-300">{j.title}</span>
          {!j.isActive && (
            <span className="text-[10px] text-slate-400 dark:text-gray-500">Paused</span>
          )}
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-gray-800 dark:text-gray-300">
            {j.applicants}
          </span>
        </li>
      ))}
    </ul>
  )
}

export function BlocksStrip({ blocks }: { blocks: { id: string; label: string }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-2">
      {blocks.map((b) => (
        <li
          key={b.id}
          className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200/80 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700/70"
        >
          <Package className="h-3 w-3 text-teal-500 dark:text-teal-400" />
          {b.label}
        </li>
      ))}
      <li>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-3 py-1 text-xs font-medium text-slate-500 hover:border-teal-400 hover:text-teal-600 dark:border-gray-600 dark:text-gray-400 dark:hover:border-teal-400/50 dark:hover:text-teal-300"
        >
          + Add block
        </button>
      </li>
    </ul>
  )
}

// tiny helper re-exported for layouts
export { Users, Check }
