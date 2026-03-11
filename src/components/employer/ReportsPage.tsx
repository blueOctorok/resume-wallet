'use client'

import { useState, useEffect } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import {
  BarChart3,
  Car,
  ClipboardCheck,
  ShieldCheck,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import BackToHubButton from '@/components/ui/BackToHubButton'
import AnalyticsDashboard from './AnalyticsDashboard'

interface MvrOrder {
  id: string
  candidateName: string
  candidateUserId: string
  status: string
  dlState: string | null
  orderedAt: string
  orderedByEmployer: boolean
  result: {
    licenseStatus: string | null
    totalPoints: number | null
    violationCount: number
    resultStatus: string | null
  } | null
}

interface DotCandidate {
  candidateName: string
  candidateUserId: string
  hasApp: boolean
  isComplete: boolean
  currentStep: number
  updatedAt: string | null
}

interface BgcheckCandidate {
  candidateName: string
  candidateUserId: string
  signed: boolean
  signedAt: string | null
  signedName: string | null
  requestPending: boolean
}

interface ReportData {
  mvr: {
    orders: MvrOrder[]
    summary: { total: number; pending: number; processing: number; complete: number; failed: number }
  }
  dot: {
    total: number
    completed: number
    incomplete: number
    candidates: DotCandidate[]
  }
  bgcheck: {
    total: number
    signed: number
    pending: number
    candidates: BgcheckCandidate[]
  }
}

interface ReportsPageProps {
  walletAddress: string
  onBack: () => void
}

type Tab = 'compliance' | 'analytics'

export default function ReportsPage({ walletAddress, onBack }: ReportsPageProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [activeTab, setActiveTab] = useState<Tab>('compliance')
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Expanded state for DOT and bgcheck tables (collapsed by default if large)
  const [dotExpanded, setDotExpanded] = useState(false)
  const [bgExpanded, setBgExpanded] = useState(false)

  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/employer/reports', {
          headers: { 'x-wallet-address': walletAddress },
        })
        if (!res.ok) throw new Error('Failed to load reports')
        setData(await res.json())
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load reports')
      } finally {
        setLoading(false)
      }
    }
    fetchReports()
  }, [walletAddress])

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <BackToHubButton onClick={onBack} />
      </div>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <BarChart3 className={`w-7 h-7 ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Reports
          </h1>
        </div>
      </div>

      {/* Tab bar */}
      <div className={`flex gap-1 p-1 rounded-xl mb-6 w-fit ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`}>
        {([['compliance', 'Compliance'], ['analytics', 'Pipeline Analytics']] as [Tab, string][]).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab
                ? isDark ? 'bg-gray-700 text-white' : 'bg-white text-gray-900 shadow-sm'
                : isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Pipeline Analytics tab */}
      {activeTab === 'analytics' && (
        <AnalyticsDashboard walletAddress={walletAddress} />
      )}

      {/* Compliance tab */}
      {activeTab === 'compliance' && (
        loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className={`w-6 h-6 animate-spin ${isDark ? 'text-teal-400' : 'text-teal-600'}`} />
          </div>
        ) : error ? (
          <div className={`flex items-center gap-2 p-4 rounded-xl text-sm ${isDark ? 'bg-red-900/20 text-red-400' : 'bg-red-50 text-red-600'}`}>
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        ) : !data ? null : (
          <div className="space-y-8">

            {/* ── MVR Orders ─────────────────────────────────────────────── */}
            <section>
              <SectionHeader icon={<Car className="w-5 h-5" />} title="Motor Vehicle Records" isDark={isDark} />

              {/* Summary chips */}
              <div className="flex flex-wrap gap-3 mb-4">
                <SummaryChip label="Total" value={data.mvr.summary.total} color="gray" isDark={isDark} />
                <SummaryChip label="Processing" value={data.mvr.summary.pending + data.mvr.summary.processing} color="yellow" isDark={isDark} />
                <SummaryChip label="Complete" value={data.mvr.summary.complete} color="green" isDark={isDark} />
                {data.mvr.summary.failed > 0 && (
                  <SummaryChip label="Failed" value={data.mvr.summary.failed} color="red" isDark={isDark} />
                )}
              </div>

              {data.mvr.orders.length === 0 ? (
                <EmptyState message="No MVR orders yet" isDark={isDark} />
              ) : (
                <div className={`rounded-xl overflow-hidden border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className={isDark ? 'bg-gray-800' : 'bg-gray-50'}>
                        {['Candidate', 'DL State', 'Status', 'Result', 'Initiated by', 'Date'].map(h => (
                          <th key={h} className={`px-4 py-2.5 text-left font-medium text-xs uppercase tracking-wide ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.mvr.orders.map((order, i) => (
                        <tr
                          key={order.id}
                          className={`border-t ${isDark ? 'border-gray-700' : 'border-gray-100'} ${
                            i % 2 === 0
                              ? isDark ? 'bg-gray-900' : 'bg-white'
                              : isDark ? 'bg-gray-800/40' : 'bg-gray-50/60'
                          }`}
                        >
                          <td className={`px-4 py-3 font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{order.candidateName}</td>
                          <td className={`px-4 py-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{order.dlState ?? '—'}</td>
                          <td className="px-4 py-3"><MvrStatusChip status={order.status} isDark={isDark} /></td>
                          <td className={`px-4 py-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {order.result ? (
                              <span className="flex flex-col gap-0.5">
                                <span>{order.result.licenseStatus ?? '—'}</span>
                                {order.result.totalPoints != null && (
                                  <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{order.result.totalPoints} pts · {order.result.violationCount} violations</span>
                                )}
                              </span>
                            ) : '—'}
                          </td>
                          <td className={`px-4 py-3 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {order.orderedByEmployer ? 'Employer' : 'Driver'}
                          </td>
                          <td className={`px-4 py-3 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{formatDate(order.orderedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* ── DOT Applications ───────────────────────────────────────── */}
            <section>
              <SectionHeader icon={<ClipboardCheck className="w-5 h-5" />} title="DOT Applications" isDark={isDark} />

              <div className="flex flex-wrap gap-3 mb-4">
                <SummaryChip label="In Pipeline" value={data.dot.total} color="gray" isDark={isDark} />
                <SummaryChip label="Complete" value={data.dot.completed} color="green" isDark={isDark} />
                <SummaryChip label="Incomplete" value={data.dot.incomplete} color="yellow" isDark={isDark} />
              </div>

              {data.dot.candidates.length === 0 ? (
                <EmptyState message="No candidates in pipeline yet" isDark={isDark} />
              ) : (
                <>
                  <CandidateTable
                    rows={dotExpanded ? data.dot.candidates : data.dot.candidates.slice(0, 5)}
                    columns={[
                      { key: 'candidateName', label: 'Candidate' },
                      {
                        key: 'status',
                        label: 'DOT App',
                        render: (row: DotCandidate) => (
                          row.isComplete
                            ? <StatusPill label="Complete" color="green" isDark={isDark} />
                            : row.hasApp
                              ? <StatusPill label={`In progress (step ${row.currentStep})`} color="yellow" isDark={isDark} />
                              : <StatusPill label="Not started" color="gray" isDark={isDark} />
                        ),
                      },
                      {
                        key: 'updatedAt',
                        label: 'Last updated',
                        render: (row: DotCandidate) => (
                          <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {row.updatedAt ? formatDate(row.updatedAt) : '—'}
                          </span>
                        ),
                      },
                    ]}
                    isDark={isDark}
                  />
                  {data.dot.candidates.length > 5 && (
                    <ExpandToggle
                      expanded={dotExpanded}
                      totalCount={data.dot.candidates.length}
                      onToggle={() => setDotExpanded(v => !v)}
                      isDark={isDark}
                    />
                  )}
                </>
              )}
            </section>

            {/* ── Background Check Disclosures ───────────────────────────── */}
            <section>
              <SectionHeader icon={<ShieldCheck className="w-5 h-5" />} title="Background Check Disclosures" isDark={isDark} />

              <div className="flex flex-wrap gap-3 mb-4">
                <SummaryChip label="In Pipeline" value={data.bgcheck.total} color="gray" isDark={isDark} />
                <SummaryChip label="Signed" value={data.bgcheck.signed} color="green" isDark={isDark} />
                <SummaryChip label="Awaiting Signature" value={data.bgcheck.pending} color="yellow" isDark={isDark} />
              </div>

              {data.bgcheck.candidates.length === 0 ? (
                <EmptyState message="No candidates in pipeline yet" isDark={isDark} />
              ) : (
                <>
                  <CandidateTable
                    rows={bgExpanded ? data.bgcheck.candidates : data.bgcheck.candidates.slice(0, 5)}
                    columns={[
                      { key: 'candidateName', label: 'Candidate' },
                      {
                        key: 'disclosure',
                        label: 'Disclosure',
                        render: (row: BgcheckCandidate) => (
                          row.signed
                            ? <StatusPill label="Signed" color="green" isDark={isDark} />
                            : row.requestPending
                              ? <StatusPill label="Requested — awaiting signature" color="yellow" isDark={isDark} />
                              : <StatusPill label="Not requested" color="gray" isDark={isDark} />
                        ),
                      },
                      {
                        key: 'signedAt',
                        label: 'Signed',
                        render: (row: BgcheckCandidate) => (
                          <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {row.signedAt ? formatDate(row.signedAt) : '—'}
                          </span>
                        ),
                      },
                    ]}
                    isDark={isDark}
                  />
                  {data.bgcheck.candidates.length > 5 && (
                    <ExpandToggle
                      expanded={bgExpanded}
                      totalCount={data.bgcheck.candidates.length}
                      onToggle={() => setBgExpanded(v => !v)}
                      isDark={isDark}
                    />
                  )}
                </>
              )}
            </section>

          </div>
        )
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ icon, title, isDark }: { icon: React.ReactNode; title: string; isDark: boolean }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className={isDark ? 'text-teal-400' : 'text-teal-600'}>{icon}</span>
      <h2 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{title}</h2>
    </div>
  )
}

function SummaryChip({ label, value, color, isDark }: { label: string; value: number; color: 'gray' | 'green' | 'yellow' | 'red'; isDark: boolean }) {
  const colors = {
    gray:   isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700',
    green:  isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-50 text-green-700',
    yellow: isDark ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-50 text-yellow-700',
    red:    isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-50 text-red-600',
  }
  return (
    <div className={`px-3 py-1.5 rounded-lg text-sm ${colors[color]}`}>
      <span className="font-bold">{value}</span> {label}
    </div>
  )
}

function StatusPill({ label, color, isDark }: { label: string; color: 'green' | 'yellow' | 'gray'; isDark: boolean }) {
  const cls = {
    green:  isDark ? 'bg-green-500/15 text-green-400' : 'bg-green-50 text-green-700',
    yellow: isDark ? 'bg-yellow-500/15 text-yellow-400' : 'bg-yellow-50 text-yellow-700',
    gray:   isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500',
  }
  return <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${cls[color]}`}>{label}</span>
}

function MvrStatusChip({ status, isDark }: { status: string; isDark: boolean }) {
  const s = status.toLowerCase()
  if (s === 'complete' || s === 'completed' || s === 'returned') {
    return (
      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${isDark ? 'bg-green-500/15 text-green-400' : 'bg-green-50 text-green-700'}`}>
        <CheckCircle className="w-3 h-3" /> Complete
      </span>
    )
  }
  if (s === 'pending' || s === 'processing' || s === 'submitted' || s === 'in_progress') {
    return (
      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${isDark ? 'bg-yellow-500/15 text-yellow-400' : 'bg-yellow-50 text-yellow-700'}`}>
        <Clock className="w-3 h-3" /> Processing
      </span>
    )
  }
  if (s === 'failed' || s === 'error') {
    return (
      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${isDark ? 'bg-red-500/15 text-red-400' : 'bg-red-50 text-red-600'}`}>
        <AlertCircle className="w-3 h-3" /> Failed
      </span>
    )
  }
  return <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{status}</span>
}

type Column<T> = {
  key: string
  label: string
  render?: (row: T) => React.ReactNode
}

function CandidateTable<T extends { candidateName: string }>({ rows, columns, isDark }: { rows: T[]; columns: Column<T>[]; isDark: boolean }) {
  return (
    <div className={`rounded-xl overflow-hidden border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
      <table className="w-full text-sm">
        <thead>
          <tr className={isDark ? 'bg-gray-800' : 'bg-gray-50'}>
            {columns.map(c => (
              <th key={c.key} className={`px-4 py-2.5 text-left font-medium text-xs uppercase tracking-wide ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className={`border-t ${isDark ? 'border-gray-700' : 'border-gray-100'} ${
                i % 2 === 0
                  ? isDark ? 'bg-gray-900' : 'bg-white'
                  : isDark ? 'bg-gray-800/40' : 'bg-gray-50/60'
              }`}
            >
              {columns.map(c => (
                <td key={c.key} className={`px-4 py-3 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                  {c.render ? c.render(row) : (row as Record<string, unknown>)[c.key] as string}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ExpandToggle({ expanded, totalCount, onToggle, isDark }: { expanded: boolean; totalCount: number; onToggle: () => void; isDark: boolean }) {
  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-1 mt-2 text-xs font-medium ${isDark ? 'text-teal-400 hover:text-teal-300' : 'text-teal-600 hover:text-teal-700'}`}
    >
      {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      {expanded ? 'Show less' : `Show all ${totalCount}`}
    </button>
  )
}

function EmptyState({ message, isDark }: { message: string; isDark: boolean }) {
  return (
    <div className={`py-8 text-center text-sm rounded-xl border ${isDark ? 'border-gray-700 text-gray-500' : 'border-gray-200 text-gray-400'}`}>
      {message}
    </div>
  )
}

function formatDate(dateString: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(dateString))
  } catch {
    return dateString
  }
}
