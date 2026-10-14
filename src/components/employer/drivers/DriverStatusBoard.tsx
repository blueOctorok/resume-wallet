'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, Loader2, RefreshCw, Search, Users } from 'lucide-react'
import HubSectionPanel from '@/components/hub/HubSectionPanel'
import BlockCard from '@/components/ui/BlockCard'
import Button from '@/components/ui/Button'
import Avatar from '@/components/ui/Avatar'
import { cn } from '@/lib/utils'
import { BALL_LABEL, deriveDriverJourney, type BallInCourt } from '@/lib/driver-journey'
import { useDriverBoardStore, type DriverBoardFilter, type DriverRosterRow } from '@/stores/driver-board-store'
import DriverBlockBadges, { BallPill } from './DriverBlockBadges'
import DriverFileModal from './DriverFileModal'

const PAGE_SIZE = 15

/** Chip order = sort order. The board reads top-down as "what do I do next". */
const BALL_ORDER: BallInCourt[] = ['attention', 'you', 'processing', 'driver', 'done']

function activityLabel(iso: string | null): string {
  if (!iso) return 'No activity yet'
  const days = Math.round((Date.now() - Date.parse(iso)) / 86400000)
  if (Number.isNaN(days)) return 'No activity yet'
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

function cdlLabel(row: DriverRosterRow): string | null {
  const parts = [row.cdl?.cdlClass && `Class ${row.cdl.cdlClass}`, row.cdl?.state].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : row.headline
}

/**
 * Every driver this company is working, one row each, sorted by whose move it
 * is. The roster API already returns live DQ item statuses per driver, so the
 * ball / next-step / badges are all derived here — no second request per row.
 */
export default function DriverStatusBoard({ sessionUserId }: { sessionUserId: string }) {
  const {
    roster,
    includesSelfServe,
    isLoading,
    isRefreshing,
    error,
    filter,
    search,
    selectedUserId,
    fetchRoster,
    setFilter,
    setSearch,
    openDriver,
  } = useDriverBoardStore()
  // Pagination is purely local list UX — nobody else needs it.
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  useEffect(() => {
    void fetchRoster()
  }, [fetchRoster])

  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [filter, search])

  const rows = useMemo(
    () =>
      roster
        .map((r) => ({ row: r, journey: deriveDriverJourney(r.items) }))
        .sort((a, b) => {
          const d = BALL_ORDER.indexOf(a.journey.ball) - BALL_ORDER.indexOf(b.journey.ball)
          if (d !== 0) return d
          const at = a.row.lastActivityAt ? Date.parse(a.row.lastActivityAt) : 0
          const bt = b.row.lastActivityAt ? Date.parse(b.row.lastActivityAt) : 0
          return bt - at || a.row.name.localeCompare(b.row.name)
        }),
    [roster],
  )

  const counts = useMemo(() => {
    const c: Record<BallInCourt, number> = { attention: 0, you: 0, processing: 0, driver: 0, done: 0 }
    for (const r of rows) c[r.journey.ball] += 1
    return c
  }, [rows])

  const q = search.trim().toLowerCase()
  const filtered = rows.filter(
    ({ row, journey }) => (filter === 'all' || journey.ball === filter) && (!q || row.name.toLowerCase().includes(q)),
  )
  const visible = filtered.slice(0, visibleCount)
  const remaining = filtered.length - visible.length

  const chips: Array<{ id: DriverBoardFilter; label: string; count: number }> = [
    { id: 'all', label: 'All', count: rows.length },
    ...BALL_ORDER.map((b) => ({ id: b, label: BALL_LABEL[b], count: counts[b] })),
  ]

  return (
    <>
      <HubSectionPanel isDark={false} accent="teal" className="mb-8">
        <BlockCard
          variant="embed"
          paper
          icon={Users}
          title="Driver status board"
          description={
            includesSelfServe
              ? 'Every driver you’re working plus anyone who signed up on their own — and whose move it is. Click a row for the full file.'
              : 'Every driver you’re working, and whose move it is. Click a row for the full file.'
          }
          headerActions={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void fetchRoster(true)}
              disabled={isRefreshing || isLoading}
              aria-label="Refresh driver board"
            >
              <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
            </Button>
          }
        >
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-10 text-ironside">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading drivers…</span>
            </div>
          )}

          {!isLoading && error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
          )}

          {!isLoading && !error && roster.length === 0 && (
            <div className="rounded-xl border border-dashed border-stone-200 px-4 py-8 text-center">
              <Users className="mx-auto mb-2 h-8 w-8 text-ironside" />
              <p className="text-sm font-medium text-[#173150]">No drivers yet</p>
              <p className="mt-1 text-xs text-ironside">
                {includesSelfServe
                  ? 'Drivers who sign up on their own appear here. A driver invited by another company stays on that company’s roster.'
                  : 'Send a consent invite, open talent search, or order a screening — they’ll appear here.'}
              </p>
            </div>
          )}

          {!isLoading && !error && roster.length > 0 && (
            <div className="space-y-3">
              {/* Count chips double as the filter — the numbers are the summary. */}
              <div className="flex flex-wrap items-center gap-1.5">
                {chips.map((chip) => {
                  const active = filter === chip.id
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => setFilter(chip.id)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                        active
                          ? 'border-[#173150] bg-[#173150] text-white'
                          : chip.count === 0
                            ? 'border-stone-200 bg-white text-ironside/60'
                            : 'border-stone-200 bg-white text-[#173150] hover:border-ironside',
                      )}
                    >
                      {chip.label}
                      <span
                        className={cn(
                          'rounded-full px-1.5 text-[10px] tabular-nums',
                          active ? 'bg-white/20' : chip.id === 'you' && chip.count > 0 ? 'bg-[#f15a2b] text-white' : 'bg-stone-100',
                        )}
                      >
                        {chip.count}
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ironside" aria-hidden />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search drivers by name…"
                  aria-label="Search drivers"
                  className="w-full rounded-lg border border-stone-200 bg-white py-2 pl-9 pr-3 text-sm text-[#173150] placeholder-ironside outline-none focus:ring-2 focus:ring-[#173150]/20"
                />
              </div>

              {filtered.length === 0 ? (
                <div className="rounded-xl border border-dashed border-stone-200 px-4 py-8 text-center">
                  <p className="text-sm text-ironside">No drivers match.</p>
                  <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={() => { setSearch(''); setFilter('all') }}>
                    Clear filters
                  </Button>
                </div>
              ) : (
                <>
                  <ul className="max-h-[36rem] divide-y divide-stone-200 overflow-y-auto rounded-xl border border-stone-200">
                    {visible.map(({ row, journey }) => (
                      <li key={row.userId}>
                        <button
                          type="button"
                          onClick={() => openDriver(row.userId)}
                          className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-2 px-3 py-3 text-left transition-colors hover:bg-stone-50 md:grid-cols-[auto_minmax(0,13rem)_1fr_auto_auto]"
                        >
                          <Avatar name={row.name} avatarUrl={row.avatarUrl} size="md" color="amber" round />

                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[#173150]">{row.name}</p>
                            <p className="truncate text-xs text-ironside">{cdlLabel(row) ?? `${row.completedCount} of ${row.totalLiveCount} on file`}</p>
                          </div>

                          {/* Mobile: pill sits top-right; desktop: it moves into its own column. */}
                          <BallPill ball={journey.ball} className="md:hidden" />

                          <div className="col-span-3 min-w-0 md:col-span-1">
                            <DriverBlockBadges items={row.items} />
                            {journey.next && (
                              <p className={cn('mt-1 truncate text-xs', journey.ball === 'you' || journey.ball === 'attention' ? 'font-medium text-[#173150]' : 'text-ironside')}>
                                {journey.next.text}
                              </p>
                            )}
                          </div>

                          <div className="hidden flex-col items-end gap-1 md:flex">
                            <BallPill ball={journey.ball} />
                            <span className="text-[10px] text-ironside">{activityLabel(row.lastActivityAt)}</span>
                          </div>

                          <ChevronRight className="hidden h-4 w-4 text-ironside md:block" />
                        </button>
                      </li>
                    ))}
                  </ul>

                  {remaining > 0 && (
                    <div className="flex justify-center pt-1">
                      <Button type="button" variant="secondary" size="sm" onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}>
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

      {selectedUserId && <DriverFileModal userId={selectedUserId} sessionUserId={sessionUserId} />}
    </>
  )
}
