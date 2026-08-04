'use client'

import { useCallback, useEffect, useState } from 'react'
import { ClipboardList, Loader2, RefreshCw, Search, Users } from 'lucide-react'
import HubSectionPanel from '@/components/hub/HubSectionPanel'
import BlockCard from '@/components/ui/BlockCard'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { isDarkTheme } from '@/lib/theme-storage'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'
import type { DqOverallStatus } from '@/lib/dq-file-status'
import { DqOverallStatusBadge } from './DqStatusBadge'
import EmployerCandidateDetail from './EmployerCandidateDetail'

interface MonitorCandidate {
  userId: string
  name: string
  avatarUrl: string | null
  overallStatus: DqOverallStatus
  completedCount: number
  totalLiveCount: number
  lastActivityAt: string | null
}

const PAGE_SIZE = 12

type StatusFilter = 'all' | DqOverallStatus

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'started', label: 'Started' },
  { id: 'complete', label: 'Complete' },
  { id: 'not_started', label: 'Not started' },
]

function formatActivity(iso: string | null): string {
  if (!iso) return 'No activity yet'
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return 'No activity yet'
  const days = Math.round((Date.now() - t) / (24 * 60 * 60 * 1000))
  if (days <= 0) return 'Active today'
  if (days === 1) return 'Active yesterday'
  if (days < 30) return `Active ${days}d ago`
  return `Active ${new Date(t).toLocaleDateString()}`
}

interface DqMonitorSectionProps {
  /** When false, section still mounts but shows an install hint. */
  screeningCapable: boolean
}

export default function DqMonitorSection({ screeningCapable }: DqMonitorSectionProps) {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)
  const [candidates, setCandidates] = useState<MonitorCandidate[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<MonitorCandidate | null>(null)
  // Local list UX only — search / status chip / page size
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const load = useCallback(async (silent = false) => {
    if (!screeningCapable) {
      setLoading(false)
      setCandidates([])
      return
    }
    if (silent) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/employer/dq-monitor')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load drivers')
      setCandidates(data.candidates ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [screeningCapable])

  useEffect(() => {
    void load()
  }, [load])

  // Reset pagination when filters change so you don't land on an empty "page"
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [search, statusFilter])

  const q = search.trim().toLowerCase()
  const filtered = candidates.filter((c) => {
    if (statusFilter !== 'all' && c.overallStatus !== statusFilter) return false
    if (q && !c.name.toLowerCase().includes(q)) return false
    return true
  })
  const visible = filtered.slice(0, visibleCount)
  const remaining = Math.max(0, filtered.length - visible.length)

  return (
    <>
      <HubSectionPanel isDark={isDark} accent="teal" className="mb-8">
        <BlockCard
          variant="embed"
          icon={ClipboardList}
          title="Drivers — DQ monitor"
          description="Candidates you’re working. Click a name for their DQ file checklist."
          headerActions={
            screeningCapable ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void load(true)}
                disabled={refreshing || loading}
                aria-label="Refresh DQ monitor"
              >
                <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
              </Button>
            ) : undefined
          }
        >
          {!screeningCapable && (
            <div className="rounded-xl border border-dashed border-slate-200 dark:border-gray-700 px-4 py-8 text-center">
              <Users className="mx-auto mb-2 h-8 w-8 text-slate-400 dark:text-gray-500" />
              <p className="text-sm text-slate-600 dark:text-gray-400">
                Install a screening block (consent, MVR, PSP, or DOT) to monitor DQ completeness.
              </p>
            </div>
          )}

          {screeningCapable && loading && (
            <div className="flex items-center justify-center gap-2 py-10 text-slate-500 dark:text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading drivers…</span>
            </div>
          )}

          {screeningCapable && !loading && error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
              {error}
            </div>
          )}

          {screeningCapable && !loading && !error && candidates.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 dark:border-gray-700 px-4 py-8 text-center">
              <ClipboardList className="mx-auto mb-2 h-8 w-8 text-slate-400 dark:text-gray-500" />
              <p className="text-sm font-medium text-slate-700 dark:text-gray-300">No drivers yet</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-gray-400">
                Invite a candidate, open talent search, or order a screening — they’ll appear here.
              </p>
            </div>
          )}

          {screeningCapable && !loading && !error && candidates.length > 0 && (
            <div className="space-y-3">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-gray-500"
                  aria-hidden
                />
                <Input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search drivers by name…"
                  className="pl-9 py-2"
                  aria-label="Search drivers"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {STATUS_FILTERS.map((f) => {
                  const active = statusFilter === f.id
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setStatusFilter(f.id)}
                      className={cn(
                        'rounded-md px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset transition-colors',
                        active
                          ? 'bg-teal-100 text-teal-800 ring-teal-200 dark:bg-teal-500/20 dark:text-teal-200 dark:ring-teal-400/30'
                          : 'bg-slate-50 text-slate-600 ring-slate-200 hover:bg-slate-100 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-600 dark:hover:bg-gray-700',
                      )}
                    >
                      {f.label}
                    </button>
                  )
                })}
                <span className="ml-auto text-[11px] text-slate-500 dark:text-gray-400">
                  {filtered.length === candidates.length
                    ? `${candidates.length} drivers`
                    : `${filtered.length} of ${candidates.length}`}
                </span>
              </div>

              {filtered.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 dark:border-gray-700 px-4 py-8 text-center">
                  <p className="text-sm text-slate-600 dark:text-gray-400">
                    No drivers match this search / filter.
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="mt-3"
                    onClick={() => {
                      setSearch('')
                      setStatusFilter('all')
                    }}
                  >
                    Clear filters
                  </Button>
                </div>
              ) : (
                <>
                  <ul className="max-h-[28rem] overflow-y-auto divide-y divide-slate-200 dark:divide-gray-700/80 rounded-xl border border-slate-200/80 dark:border-gray-700/60">
                    {visible.map((c) => (
                      <li key={c.userId}>
                        <button
                          type="button"
                          onClick={() => setSelected(c)}
                          className={cn(
                            'flex w-full items-center gap-3 px-3 py-3 text-left transition-colors',
                            'hover:bg-slate-50 dark:hover:bg-gray-800/60',
                          )}
                        >
                          <div
                            className={cn(
                              'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                              'bg-teal-50 text-teal-800 ring-1 ring-teal-200',
                              'dark:bg-teal-500/15 dark:text-teal-200 dark:ring-teal-400/30',
                            )}
                          >
                            {c.avatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={c.avatarUrl}
                                alt=""
                                className="h-10 w-10 rounded-full object-cover"
                              />
                            ) : (
                              (c.name || '?').charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-900 dark:text-gray-100">
                              {c.name}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-gray-400">
                              {formatActivity(c.lastActivityAt)}
                            </p>
                          </div>
                          <DqOverallStatusBadge
                            status={c.overallStatus}
                            completedCount={c.completedCount}
                            totalLiveCount={c.totalLiveCount}
                          />
                        </button>
                      </li>
                    ))}
                  </ul>

                  {remaining > 0 && (
                    <div className="flex justify-center pt-1">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                      >
                        Show more ({remaining} remaining)
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </BlockCard>
      </HubSectionPanel>

      {selected && (
        <EmployerCandidateDetail
          userId={selected.userId}
          initialName={selected.name}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  )
}
