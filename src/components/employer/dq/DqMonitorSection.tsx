'use client'

import { useCallback, useEffect, useState } from 'react'
import { ClipboardList, Loader2, RefreshCw, Search } from 'lucide-react'
import HubSectionPanel from '@/components/hub/HubSectionPanel'
import BlockCard from '@/components/ui/BlockCard'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import type { DqOverallStatus } from '@/lib/dq-file-status'
import { DqOverallStatusBadge } from './DqStatusBadge'
import CareerCardModal from '@/components/employer/CareerCardModal'

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
  sessionUserId: string
}

export default function DqMonitorSection({ sessionUserId }: DqMonitorSectionProps) {
  const isDark = false
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
  }, [])

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
          paper
          icon={ClipboardList}
          title="Drivers — DQ monitor"
          description="Candidates you’re working. Click a name for their DQ file checklist."
          headerActions={
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
          }
        >
          {loading && (
            <div className="flex items-center justify-center gap-2 py-10 text-ironside">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading drivers…</span>
            </div>
          )}

          {!loading && error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {!loading && !error && candidates.length === 0 && (
            <div className="rounded-xl border border-dashed border-stone-200 px-4 py-8 text-center">
              <ClipboardList className="mx-auto mb-2 h-8 w-8 text-ironside" />
              <p className="text-sm font-medium text-[#173150]">No drivers yet</p>
              <p className="mt-1 text-xs text-ironside">
                Invite a candidate, open talent search, or order a screening — they’ll appear here.
              </p>
            </div>
          )}

          {!loading && !error && candidates.length > 0 && (
            <div className="space-y-3">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ironside"
                  aria-hidden
                />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search drivers by name…"
                  aria-label="Search drivers"
                  className="w-full rounded-lg border border-stone-200 bg-white py-2 pl-9 pr-3 text-sm text-[#173150] placeholder-ironside outline-none focus:ring-2 focus:ring-teal-500/40"
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
                        'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                        active
                          ? 'border-[#173150] bg-[#173150] text-white'
                          : 'border-stone-200 bg-white text-[#173150] hover:border-ironside',
                      )}
                    >
                      {f.label}
                    </button>
                  )
                })}
                <span className="ml-auto text-[11px] text-ironside">
                  {filtered.length === candidates.length
                    ? `${candidates.length} drivers`
                    : `${filtered.length} of ${candidates.length}`}
                </span>
              </div>

              {filtered.length === 0 ? (
                <div className="rounded-xl border border-dashed border-stone-200 px-4 py-8 text-center">
                  <p className="text-sm text-ironside">
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
                  <ul className="max-h-[28rem] overflow-y-auto divide-y divide-stone-200 rounded-xl border border-stone-200">
                    {visible.map((c) => (
                      <li key={c.userId}>
                        <button
                          type="button"
                          onClick={() => setSelected(c)}
                          className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-stone-50"
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-100 text-sm font-semibold text-[#173150] ring-1 ring-stone-200">
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
                            <p className="truncate text-sm font-semibold text-[#173150]">
                              {c.name}
                            </p>
                            <p className="text-xs text-ironside">
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
        <CareerCardModal
          candidateUserId={selected.userId}
          sessionUserId={sessionUserId}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  )
}
