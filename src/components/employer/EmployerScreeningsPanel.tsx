'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Car, FileWarning, Eye, Loader2, RefreshCw, ShieldCheck } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { isDarkTheme } from '@/lib/theme-storage'
import { cn } from '@/lib/utils'
import HubSectionPanel from '@/components/hub/HubSectionPanel'
import BlockCard from '@/components/ui/BlockCard'
import Button from '@/components/ui/Button'
import Avatar from '@/components/ui/Avatar'
import MvrViewModal from '@/components/MvrViewModal'
import PspViewModal from '@/components/PspViewModal'
import { hubDocStatusFromScreeningOrder, hubScreeningStatusLabel } from '@/lib/hub-document-types'
import {
  outcomeBadgeClasses,
  outcomeLabel,
  type ScreeningOutcome,
} from '@/lib/accio-result-status'

/**
 * Employer hub: lists company-purchased MVR + PSP screenings with status pills and a
 * **View** action when complete. View opens the same MVR/PSP modal candidates use, but
 * authorized via `employerCandidateUserId` so the status APIs only succeed when the
 * employer's company actually paid for the order.
 */

interface ScreeningRow {
  id: string
  kind: 'mvr' | 'psp'
  candidateUserId: string | null
  candidateName: string | null
  avatarUrl: string | null
  status: string
  /** Accio-derived outcome (clear/hits/no_hits/...). Only set when status === 'completed'. */
  resultOutcome: ScreeningOutcome
  dlState: string | null
  orderedAt: string
  completedAt: string | null
}

interface ScreeningsResponse {
  success: boolean
  mvr: ScreeningRow[]
  psp: ScreeningRow[]
}

interface EmployerScreeningsPanelProps {
  walletAddress: string
}

function formatWhen(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString()
}

export default function EmployerScreeningsPanel({ walletAddress }: EmployerScreeningsPanelProps) {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<ScreeningRow[]>([])

  const [mvrViewOrderId, setMvrViewOrderId] = useState<string | null>(null)
  const [pspViewOrderId, setPspViewOrderId] = useState<string | null>(null)
  const [activeCandidateUserId, setActiveCandidateUserId] = useState<string | null>(null)

  const fetchScreenings = useCallback(
    async (silent = false) => {
      try {
        if (silent) setRefreshing(true)
        else setLoading(true)
        setError(null)
        const res = await fetch('/api/employer/screenings', {
          headers: { 'x-wallet-address': walletAddress },
        })
        const data = (await res.json()) as ScreeningsResponse | { error: string }
        if (!res.ok || !('success' in data)) {
          throw new Error('error' in data ? data.error : 'Failed to load screenings')
        }
        const merged = [...data.mvr, ...data.psp].sort(
          (a, b) => new Date(b.orderedAt).getTime() - new Date(a.orderedAt).getTime(),
        )
        setRows(merged)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load screenings')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [walletAddress],
  )

  useEffect(() => {
    void fetchScreenings()
  }, [fetchScreenings])

  const counts = useMemo(() => {
    const ready = rows.filter((r) => hubDocStatusFromScreeningOrder(r.status) === 'complete').length
    return { total: rows.length, ready }
  }, [rows])

  const handleView = (row: ScreeningRow) => {
    if (!row.candidateUserId) return
    setActiveCandidateUserId(row.candidateUserId)
    if (row.kind === 'mvr') setMvrViewOrderId(row.id)
    else setPspViewOrderId(row.id)
  }

  return (
    <>
      <HubSectionPanel isDark={isDark} accent="amber" className="mb-8">
        <BlockCard
          variant="embed"
          icon={ShieldCheck}
          title="Purchased screenings"
          description={
            counts.total === 0
              ? 'MVR and PSP reports your company orders for candidates show up here.'
              : `${counts.total} order${counts.total === 1 ? '' : 's'} · ${counts.ready} ready to view`
          }
          headerActions={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => fetchScreenings(true)}
              disabled={refreshing || loading}
              aria-label="Refresh purchased screenings"
              title="Refresh"
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            </Button>
          }
        >
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2
                className={cn('h-5 w-5 animate-spin', isDark ? 'text-teal-400' : 'text-teal-600')}
              />
            </div>
          ) : error ? (
            <div
              className={cn(
                'rounded-lg border px-3 py-2 text-sm',
                isDark ? 'border-red-500/40 bg-red-500/10 text-red-200' : 'border-red-200 bg-red-50 text-red-700',
              )}
            >
              {error}
            </div>
          ) : rows.length === 0 ? (
            <div className="py-6 text-center">
              <ShieldCheck
                className={cn('mx-auto mb-2 h-8 w-8', isDark ? 'text-gray-600' : 'text-gray-300')}
              />
              <p className={cn('text-sm font-medium', isDark ? 'text-gray-400' : 'text-gray-500')}>
                No screenings purchased yet
              </p>
              <p className={cn('mt-1 text-xs', isDark ? 'text-gray-500' : 'text-gray-500')}>
                Order MVR or PSP from a candidate&apos;s career card. Reports show up here when complete.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {rows.map((row) => (
                <ScreeningRowItem
                  key={`${row.kind}-${row.id}`}
                  row={row}
                  isDark={isDark}
                  onView={() => handleView(row)}
                />
              ))}
            </ul>
          )}
        </BlockCard>
      </HubSectionPanel>

      {mvrViewOrderId && activeCandidateUserId && (
        <MvrViewModal
          isOpen
          onClose={() => {
            setMvrViewOrderId(null)
            setActiveCandidateUserId(null)
          }}
          walletAddress={walletAddress}
          orderId={mvrViewOrderId}
          employerCandidateUserId={activeCandidateUserId}
        />
      )}

      {pspViewOrderId && activeCandidateUserId && (
        <PspViewModal
          isOpen
          onClose={() => {
            setPspViewOrderId(null)
            setActiveCandidateUserId(null)
          }}
          walletAddress={walletAddress}
          orderId={pspViewOrderId}
          employerCandidateUserId={activeCandidateUserId}
        />
      )}
    </>
  )
}

function ScreeningRowItem({
  row,
  isDark,
  onView,
}: {
  row: ScreeningRow
  isDark: boolean
  onView: () => void
}) {
  const Icon = row.kind === 'mvr' ? Car : FileWarning
  const docStatus = hubDocStatusFromScreeningOrder(row.status)
  const ready = docStatus === 'complete'

  const pillCls =
    docStatus === 'complete'
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
            ? 'bg-slate-600/80 text-slate-200'
            : 'bg-slate-200 text-slate-800'

  return (
    <li
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm',
        isDark ? 'border-gray-700/80 bg-gray-900/40 text-gray-200' : 'border-gray-200 bg-white text-gray-900',
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={row.candidateName ?? '?'} avatarUrl={row.avatarUrl} size="sm" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Icon className={cn('h-4 w-4', isDark ? 'text-amber-400' : 'text-amber-600')} aria-hidden />
            <span className="font-semibold">
              {row.kind === 'mvr' ? 'MVR' : 'PSP'}
              {row.candidateName ? ` · ${row.candidateName}` : ''}
            </span>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                pillCls,
              )}
            >
              {hubScreeningStatusLabel(docStatus)}
            </span>
            {/* Outcome chip (Clear / Hits / etc.) — only shown once Accio returned a verdict. */}
            {ready && row.resultOutcome ? (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                  outcomeBadgeClasses(row.resultOutcome),
                )}
              >
                {outcomeLabel(row.resultOutcome)}
              </span>
            ) : null}
          </div>
          <p className={cn('mt-0.5 text-xs', isDark ? 'text-gray-500' : 'text-gray-500')}>
            {[row.dlState, `Ordered ${formatWhen(row.orderedAt)}`].filter(Boolean).join(' · ')}
            {ready && row.completedAt ? ` · Completed ${formatWhen(row.completedAt)}` : ''}
          </p>
        </div>
      </div>

      {ready ? (
        <Button type="button" variant="secondary" size="sm" onClick={onView}>
          <Eye className="mr-1 h-4 w-4" aria-hidden />
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
