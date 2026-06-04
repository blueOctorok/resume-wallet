'use client'

import { useMemo, useState } from 'react'
import {
  ShieldCheck,
  Car,
  FileWarning,
  Eye,
  Download,
  Loader2,
  Inbox,
  FileCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { isDarkTheme } from '@/lib/theme-storage'
import Button from '@/components/ui/Button'
import Avatar from '@/components/ui/Avatar'
import OutreachFilterBar, { type FilterChipDef, type SortKey } from './OutreachFilterBar'
import {
  hubDocStatusFromScreeningOrder,
  hubScreeningStatusLabel,
} from '@/lib/hub-document-types'
import {
  outcomeBadgeClasses,
  outcomeLabel,
} from '@/lib/accio-result-status'
import type { ScreeningRow } from './types'
import type { ConsentBundleSummary } from '@/hooks/useEmployerScreenings'

interface FilesVaultProps {
  rows: ScreeningRow[]
  consentBundles?: ConsentBundleSummary[]
  loading: boolean
  error: string | null
  theme: string
  onView: (row: ScreeningRow) => void
  onViewConsent?: (bundle: ConsentBundleSummary) => void
}

/**
 * Permanent, candidate-grouped record of every MVR/PSP this company has paid for.
 *
 * Why it exists: invites can be cancelled/removed, candidates can drop off, but
 * `mvr_orders` / `psp_orders` are anchored to `driver_user_id` + `ordered_by_company_id`
 * (NOT to the invite — verified at the DB schema level). This tab surfaces those
 * records so a recruiter can always find a screening they paid for, even months
 * after the invite was deleted.
 *
 * Filtering: search by name, type chips (MVR/PSP), outcome chips (Clear/Hits/etc).
 */
export default function FilesVault({ rows, consentBundles = [], loading, error, theme, onView, onViewConsent }: FilesVaultProps) {
  const isDark = isDarkTheme(theme)

  const [search, setSearch] = useState('')
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set())
  const [selectedOutcomes, setSelectedOutcomes] = useState<Set<string>>(new Set())
  const [sort, setSort] = useState<SortKey>('newest')

  // ── Derived: chip definitions with live counts ──────────────────────────
  const typeChips: FilterChipDef[] = useMemo(() => {
    const mvr = rows.filter((r) => r.kind === 'mvr').length
    const psp = rows.filter((r) => r.kind === 'psp').length
    return [
      { id: 'mvr', label: 'MVR', count: mvr, dotClass: 'bg-amber-400' },
      { id: 'psp', label: 'PSP', count: psp, dotClass: 'bg-purple-400' },
    ].filter((c) => c.count > 0)
  }, [rows])

  const outcomeChips: FilterChipDef[] = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const r of rows) {
      const k = r.resultOutcome ?? 'pending'
      counts[k] = (counts[k] ?? 0) + 1
    }
    const order = ['clear', 'hits', 'no_hits', 'unknown', 'pending']
    return order
      .filter((k) => (counts[k] ?? 0) > 0)
      .map((k) => ({
        id: k,
        label: k === 'pending' ? 'Pending' : outcomeLabel(k as ScreeningRow['resultOutcome']),
        count: counts[k] ?? 0,
      }))
  }, [rows])

  // ── Filtered + sorted ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = rows.filter((r) => {
      if (selectedTypes.size > 0 && !selectedTypes.has(r.kind)) return false
      if (selectedOutcomes.size > 0) {
        const k = r.resultOutcome ?? 'pending'
        if (!selectedOutcomes.has(k)) return false
      }
      if (q) {
        const blob = `${r.candidateName ?? ''} ${r.dlState ?? ''}`.toLowerCase()
        if (!blob.includes(q)) return false
      }
      return true
    })

    if (sort === 'newest') {
      list.sort((a, b) => new Date(b.orderedAt).getTime() - new Date(a.orderedAt).getTime())
    } else if (sort === 'oldest') {
      list.sort((a, b) => new Date(a.orderedAt).getTime() - new Date(b.orderedAt).getTime())
    } else {
      list.sort((a, b) => (a.candidateName ?? '').localeCompare(b.candidateName ?? ''))
    }

    return list
  }, [rows, search, selectedTypes, selectedOutcomes, sort])

  const completedRows = useMemo(
    () => filtered.filter((r) => hubDocStatusFromScreeningOrder(r.status) === 'complete'),
    [filtered],
  )
  const processingRows = useMemo(
    () => filtered.filter((r) => hubDocStatusFromScreeningOrder(r.status) !== 'complete'),
    [filtered],
  )

  const completedGroups = useMemo(() => groupScreeningsByCandidate(completedRows), [completedRows])
  const processingGroups = useMemo(() => groupScreeningsByCandidate(processingRows), [processingRows])

  const hasAnyGroups = completedGroups.length > 0 || processingGroups.length > 0

  const hasActiveFilters = search.trim().length > 0 || selectedTypes.size > 0 || selectedOutcomes.size > 0

  const clearAll = () => {
    setSearch('')
    setSelectedTypes(new Set())
    setSelectedOutcomes(new Set())
  }

  const toggleSet = (set: Set<string>, id: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setter(next)
  }

  // ── CSV export ─────────────────────────────────────────────────────────
  const exportCsv = () => {
    const headers = ['Candidate', 'Type', 'DL State', 'Status', 'Outcome', 'Ordered', 'Completed', 'Fee']
    const rowsCsv = filtered.map((r) =>
      [
        csvCell(r.candidateName ?? ''),
        r.kind.toUpperCase(),
        r.dlState ?? '',
        hubScreeningStatusLabel(hubDocStatusFromScreeningOrder(r.status)),
        r.resultOutcome ? outcomeLabel(r.resultOutcome) : '',
        r.orderedAt ? new Date(r.orderedAt).toISOString().slice(0, 10) : '',
        r.completedAt ? new Date(r.completedAt).toISOString().slice(0, 10) : '',
        r.feeAmount != null ? String(r.feeAmount) : '',
      ].join(','),
    )
    const blob = new Blob([[headers.join(','), ...rowsCsv].join('\n')], {
      type: 'text/csv;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `storm-screenings-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Render ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className={cn('h-5 w-5 animate-spin', isDark ? 'text-teal-400' : 'text-teal-600')} />
      </div>
    )
  }

  if (error) {
    return (
      <div
        className={cn(
          'rounded-lg border px-3 py-2 text-sm',
          isDark ? 'border-red-500/40 bg-red-500/10 text-red-200' : 'border-red-200 bg-red-50 text-red-700',
        )}
      >
        {error}
      </div>
    )
  }

  if (rows.length === 0 && consentBundles.length === 0) {
    return (
      <div className="py-10 text-center">
        <ShieldCheck className={cn('mx-auto mb-2 h-10 w-10', isDark ? 'text-gray-600' : 'text-gray-300')} />
        <p className={cn('text-sm font-medium', isDark ? 'text-gray-400' : 'text-gray-500')}>
          No screenings purchased yet
        </p>
        <p className={cn('mt-1 text-xs', isDark ? 'text-gray-500' : 'text-gray-500')}>
          Order MVR or PSP from a candidate&apos;s career card. Reports show up here when complete.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Consent packages (always shown, no filter applies) ────────── */}
      {consentBundles.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="vault-consent-heading">
          <h3
            id="vault-consent-heading"
            className={cn(
              'text-xs font-semibold uppercase tracking-wide',
              isDark ? 'text-teal-400/90' : 'text-teal-700',
            )}
          >
            Signed consent packages ({consentBundles.length})
          </h3>
          <ul className="space-y-3">
            {consentBundles.map((bundle) => (
              <ConsentBundleRow
                key={bundle.id}
                bundle={bundle}
                isDark={isDark}
                onViewConsent={onViewConsent}
              />
            ))}
          </ul>
        </section>
      )}

      {/* ── MVR / PSP order filter + list ─────────────────────────────── */}
      {rows.length > 0 && (
        <>
          <OutreachFilterBar
            theme={theme}
            search={search}
            onSearchChange={setSearch}
            enableKeyboardShortcut={false}
            statusFilters={typeChips}
            selectedStatuses={selectedTypes}
            onToggleStatus={(id) => toggleSet(selectedTypes, id, setSelectedTypes)}
            statusFilterLabel="Type"
            blockFilters={outcomeChips}
            selectedBlocks={selectedOutcomes}
            onToggleBlock={(id) => toggleSet(selectedOutcomes, id, setSelectedOutcomes)}
            blockFilterLabel="Outcome"
            sort={sort}
            onSortChange={setSort}
            showingCount={filtered.length}
            totalCount={rows.length}
            onClearAll={clearAll}
            hasActiveFilters={hasActiveFilters}
          />

          <div className="flex items-center justify-between">
            <p className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-500')}>
              {completedRows.length} completed · {processingRows.length} processing · {filtered.length} report
              {filtered.length === 1 ? '' : 's'}
            </p>
            <Button type="button" variant="ghost" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          </div>

          {!hasAnyGroups ? (
            <div className="py-10 text-center">
              <Inbox className={cn('mx-auto mb-2 h-8 w-8', isDark ? 'text-gray-600' : 'text-gray-300')} />
              <p className={cn('text-sm font-medium', isDark ? 'text-gray-400' : 'text-gray-500')}>
                No matches
              </p>
              <p className={cn('mt-1 text-xs', isDark ? 'text-gray-500' : 'text-gray-500')}>
                Try broadening your filters or clearing the search.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-8">
              {completedGroups.length > 0 && (
                <section className="flex flex-col gap-3" aria-labelledby="vault-completed-heading">
                  <h3
                    id="vault-completed-heading"
                    className={cn(
                      'text-xs font-semibold uppercase tracking-wide',
                      isDark ? 'text-emerald-400/90' : 'text-emerald-700 dark:text-emerald-400/90',
                    )}
                  >
                    Completed reports ({completedRows.length})
                  </h3>
                  <ul className="space-y-3">
                    {completedGroups.map((group) => (
                      <VaultCandidateGroup key={`done-${group.userId ?? group.name}`} group={group} isDark={isDark} onView={onView} />
                    ))}
                  </ul>
                </section>
              )}
              {processingGroups.length > 0 && (
                <section className="flex flex-col gap-3" aria-labelledby="vault-processing-heading">
                  <h3
                    id="vault-processing-heading"
                    className={cn(
                      'text-xs font-semibold uppercase tracking-wide',
                      isDark ? 'text-amber-400/90' : 'text-amber-800 dark:text-amber-400/90',
                    )}
                  >
                    Processing / pending ({processingRows.length})
                  </h3>
                  <ul className="space-y-3">
                    {processingGroups.map((group) => (
                      <VaultCandidateGroup key={`pend-${group.userId ?? group.name}`} group={group} isDark={isDark} onView={onView} />
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/** Group screening rows by candidate for the vault list. */
function groupScreeningsByCandidate(rows: ScreeningRow[]) {
  const m = new Map<string, { name: string; userId: string | null; avatarUrl: string | null; files: ScreeningRow[] }>()
  for (const r of rows) {
    const key = r.candidateUserId ?? `__noid__${r.candidateName ?? 'Unknown'}`
    const existing = m.get(key)
    if (existing) existing.files.push(r)
    else
      m.set(key, {
        name: r.candidateName ?? 'Unknown candidate',
        userId: r.candidateUserId,
        avatarUrl: r.avatarUrl,
        files: [r],
      })
  }
  return Array.from(m.values())
}

function VaultCandidateGroup({
  group,
  isDark,
  onView,
}: {
  group: { name: string; userId: string | null; avatarUrl: string | null; files: ScreeningRow[] }
  isDark: boolean
  onView: (row: ScreeningRow) => void
}) {
  return (
    <li
      className={cn(
        'rounded-xl border',
        isDark ? 'border-gray-700/80 bg-gray-900/30' : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900/20',
      )}
    >
      <div className="flex items-center gap-3 border-b border-gray-100 px-3 py-2 dark:border-gray-700/70">
        <Avatar name={group.name} avatarUrl={group.avatarUrl} size="sm" />
        <div className="min-w-0 flex-1">
          <p className={cn('truncate text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
            {group.name}
          </p>
          <p className={cn('text-[11px]', isDark ? 'text-gray-500' : 'text-gray-500')}>
            {group.files.length} report{group.files.length === 1 ? '' : 's'}
          </p>
        </div>
      </div>
      <ul className="divide-y divide-gray-100 dark:divide-gray-700/60">
        {group.files.map((file) => (
          <VaultRow key={`${file.kind}-${file.id}`} file={file} isDark={isDark} onView={() => onView(file)} />
        ))}
      </ul>
    </li>
  )
}

function VaultRow({
  file,
  isDark,
  onView,
}: {
  file: ScreeningRow
  isDark: boolean
  onView: () => void
}) {
  const Icon = file.kind === 'mvr' ? Car : FileWarning
  const docStatus = hubDocStatusFromScreeningOrder(file.status)
  const ready = docStatus === 'complete'
  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : '—')

  const pillCls = ready
    ? isDark
      ? 'bg-emerald-500/15 text-emerald-300'
      : 'bg-emerald-100 text-emerald-800'
    : docStatus === 'processing'
      ? isDark
        ? 'bg-amber-500/15 text-amber-200'
        : 'bg-amber-100 text-amber-900'
      : docStatus === 'failed'
        ? isDark
          ? 'bg-red-500/15 text-red-300'
          : 'bg-red-100 text-red-800'
        : isDark
          ? 'bg-slate-700/70 text-slate-200'
          : 'bg-slate-200 text-slate-800'

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
      <div className="flex min-w-0 items-center gap-2">
        <Icon className={cn('h-4 w-4 shrink-0', isDark ? 'text-amber-400' : 'text-amber-600')} aria-hidden />
        <span className={cn('font-semibold shrink-0', isDark ? 'text-gray-100' : 'text-gray-900')}>
          {file.kind === 'mvr' ? 'MVR' : 'PSP'}
        </span>
        {file.dlState && <span className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-500')}>{file.dlState}</span>}
        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', pillCls)}>
          {hubScreeningStatusLabel(docStatus)}
        </span>
        {ready && file.resultOutcome && (
          <span
            className={cn(
              'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
              outcomeBadgeClasses(file.resultOutcome),
            )}
          >
            {outcomeLabel(file.resultOutcome)}
          </span>
        )}
        <span className={cn('text-[11px]', isDark ? 'text-gray-500' : 'text-gray-500')}>
          Ordered {fmt(file.orderedAt)}
          {ready && file.completedAt ? ` · Completed ${fmt(file.completedAt)}` : ''}
        </span>
      </div>
      {ready ? (
        <Button type="button" variant="secondary" size="sm" onClick={onView}>
          <Eye className="mr-1 h-3.5 w-3.5" />
          View
        </Button>
      ) : (
        <span className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-500')}>
          {docStatus === 'failed' ? 'Contact support' : 'Awaiting vendor'}
        </span>
      )}
    </li>
  )
}

/** Quote a CSV cell so commas + quotes inside names don't break the column count. */
function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function ConsentBundleRow({
  bundle,
  isDark,
  onViewConsent,
}: {
  bundle: ConsentBundleSummary
  isDark: boolean
  onViewConsent?: (bundle: ConsentBundleSummary) => void
}) {
  const name = bundle.candidateName ?? 'Unknown candidate'
  const isComplete = bundle.status === 'complete'
  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : null)

  const pillCls = isComplete
    ? isDark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-100 text-emerald-800'
    : isDark ? 'bg-amber-500/15 text-amber-200' : 'bg-amber-100 text-amber-900'

  const instruments = [
    bundle.bg ? `FCRA (signed ${fmt(bundle.bg.signedAt)})` : null,
    bundle.psp ? `FMCSA PSP (signed ${fmt(bundle.psp.signedAt)})` : null,
    bundle.cdlisSignedAt ? `CDLIS (signed ${fmt(bundle.cdlisSignedAt)})` : null,
  ].filter(Boolean)

  return (
    <li
      className={cn(
        'rounded-xl border',
        isDark ? 'border-gray-700/80 bg-gray-900/30' : 'border-gray-200 bg-white',
      )}
    >
      <div className="flex items-center gap-3 border-b border-gray-100 px-3 py-2 dark:border-gray-700/70">
        <Avatar name={name} avatarUrl={bundle.avatarUrl} size="sm" />
        <div className="min-w-0 flex-1">
          <p className={cn('truncate text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
            {name}
          </p>
          <p className={cn('text-[11px]', isDark ? 'text-gray-500' : 'text-gray-500')}>
            Consent package
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
        <FileCheck className={cn('h-4 w-4 shrink-0', isDark ? 'text-teal-400' : 'text-teal-600')} aria-hidden />
        <span className={cn('font-semibold shrink-0', isDark ? 'text-gray-100' : 'text-gray-900')}>
          Signed Consent Package
        </span>
        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', pillCls)}>
          {isComplete ? 'Complete' : 'Pending'}
        </span>
        {instruments.length > 0 && (
          <span className={cn('text-[11px]', isDark ? 'text-gray-500' : 'text-gray-500')}>
            {instruments.join(' · ')}
          </span>
        )}
        {isComplete && bundle.completedAt && (
          <span className={cn('text-[11px]', isDark ? 'text-gray-500' : 'text-gray-500')}>
            · Completed {fmt(bundle.completedAt)}
          </span>
        )}
        {isComplete && onViewConsent && (
          <Button type="button" variant="secondary" size="sm" className="ml-auto" onClick={() => onViewConsent(bundle)}>
            <Eye className="mr-1 h-3.5 w-3.5" />
            View
          </Button>
        )}
      </div>
    </li>
  )
}
