'use client'

import { useState, useEffect } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import {
  Download, Loader2, AlertCircle, Shield, Hash, Truck,
  AlertTriangle, ChevronDown, ClipboardCheck, User as UserIcon,
  Activity, FileText, X,
} from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { isDarkTheme } from '@/lib/theme-storage'
import { cn } from '@/lib/utils'
import {
  outcomeBadgeClasses,
  outcomeLabel,
  type ScreeningOutcome,
} from '@/lib/accio-result-status'

interface PspViewModalProps {
  isOpen: boolean
  onClose: () => void
  sessionUserId: string | null
  orderId: string | null
  /** Talent modal: pass with employer wallet so status API authorizes purchaser view. */
  employerCandidateUserId?: string | null
}

// ── typed shapes for parsed_data ──────────────────────────────────────────

interface PspSubject {
  firstName?: string | null
  middleName?: string | null
  lastName?: string | null
  dateOfBirth?: string | null
  licenseNumber?: string | null
  licenseState?: string | null
}

interface PspInspectionViolation {
  code?: string | null
  description?: string | null
  outOfService?: boolean | null
  category?: string | null
  section?: string | null
}

interface PspInspection {
  date?: string | null
  reportNumber?: string | null
  level?: string | null
  state?: string | null
  county?: string | null
  vehicleType?: string | null
  result?: string | null
  outOfService?: boolean | null
  violations: PspInspectionViolation[]
}

interface PspCrash {
  date?: string | null
  reportNumber?: string | null
  city?: string | null
  state?: string | null
  fatalities?: number | null
  injuries?: number | null
  towAway?: boolean | null
  hazmatReleased?: boolean | null
  vehicleType?: string | null
  description?: string | null
}

interface PspParsedData {
  subject?: PspSubject | null
  crashes?: PspCrash[]
  inspections?: PspInspection[]
  crashCount?: number | null
  inspectionCount?: number | null
  oosCount?: number | null
  filledCode?: string | null
  filledStatus?: string | null
  reportText?: string | null
  // legacy stub shape
  extracted?: {
    filledCode?: string | null
    dlNumber?: string | null
    dlState?: string | null
  } | null
}

interface PspOrderPayload {
  id: string
  orderNumber: string | null
  subOrderNumber: string | null
  remoteOrderNumber: string | null
  remoteSubOrderNumber: string | null
  status: string
  resultOutcome: ScreeningOutcome
  dlNumber: string | null
  dlState: string | null
  orderedAt: string | null
  processedAt: string | null
  completedAt: string | null
  expiresAt: string | null
  feeAmount: number | string | null
  errorMessage: string | null
  orderedByEmployer: boolean
}

interface PspResultPayload {
  id: string
  resultStatus: string | null
  receivedAt: string | null
  parsedAt: string | null
  parsedData: PspParsedData | null
}

// ── helpers ──────────────────────────────────────────────────────────────

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString()
}

function maskDl(raw: string | null | undefined): string {
  const s = (raw ?? '').replace(/\s/g, '')
  if (!s) return '—'
  if (s.length <= 4) return '••••'
  return `••••${s.slice(-4)}`
}

function yesNo(val: boolean | null | undefined): string {
  if (val === true) return 'Yes'
  if (val === false) return 'No'
  return '—'
}

function formatDriverName(subject: PspSubject | null | undefined): string {
  if (!subject) return ''
  return [subject.firstName, subject.middleName, subject.lastName].filter(Boolean).join(' ')
}

type IconAccent = 'teal' | 'amber' | 'emerald' | 'red' | 'slate'

function SectionHeader({
  icon: Icon,
  title,
  accent = 'amber',
  count,
  isDark,
}: {
  icon: React.ElementType
  title: string
  accent?: IconAccent
  count?: number
  isDark: boolean
}) {
  const tile: Record<IconAccent, string> = {
    teal:    'bg-teal-50 dark:bg-teal-500/15 text-teal-700 dark:text-teal-200 ring-1 ring-teal-200 dark:ring-teal-400/30',
    amber:   'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-200 ring-1 ring-amber-200 dark:ring-amber-400/30',
    emerald: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-200 ring-1 ring-emerald-200 dark:ring-emerald-400/30',
    red:     'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 ring-1 ring-red-200 dark:ring-red-400/30',
    slate:   'bg-slate-100 dark:bg-slate-700/40 text-slate-600 dark:text-slate-300 ring-1 ring-slate-200 dark:ring-slate-600/40',
  }
  const countBg: Record<IconAccent, string> = {
    teal:    'bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300',
    amber:   'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300',
    emerald: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
    red:     'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300',
    slate:   'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
  }
  return (
    <div className="flex items-center gap-2.5">
      <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', tile[accent])}>
        <Icon className="h-4 w-4" aria-hidden />
      </div>
      <h3 className={cn('font-semibold text-sm', isDark ? 'text-white' : 'text-gray-900')}>{title}</h3>
      {count !== undefined && (
        <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', countBg[accent])}>
          {count}
        </span>
      )}
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────

export default function PspViewModal({
  isOpen,
  onClose,
  sessionUserId,
  orderId,
  employerCandidateUserId,
}: PspViewModalProps) {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [payload, setPayload] = useState<{
    order: PspOrderPayload
    result: PspResultPayload | null
  } | null>(null)
  const [showRefs, setShowRefs] = useState(false)
  const [showReportText, setShowReportText] = useState(false)

  useEffect(() => {
    if (!isOpen || !orderId || !sessionUserId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const q = new URLSearchParams({ sessionUserId })
        if (employerCandidateUserId) q.set('employerCandidateUserId', employerCandidateUserId)
        const res = await fetch(`/api/psp/status/${orderId}?${q.toString()}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load PSP order')
        if (!cancelled) {
          setPayload({
            order: data.order as PspOrderPayload,
            result: (data.result as PspResultPayload | null) ?? null,
          })
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [isOpen, orderId, sessionUserId, employerCandidateUserId])

  const parsed = payload?.result?.parsedData ?? null
  // Support both legacy stub shape and new structured shape
  const extracted = parsed?.extracted
  const filledCode = parsed?.filledCode ?? extracted?.filledCode ?? null
  const crashCount = parsed?.crashCount ?? null
  const inspectionCount = parsed?.inspectionCount ?? null
  const oosCount = parsed?.oosCount ?? null
  const hasCounts = crashCount !== null || inspectionCount !== null || oosCount !== null
  const crashes: PspCrash[] = parsed?.crashes ?? []
  const inspections: PspInspection[] = parsed?.inspections ?? []
  const subject = parsed?.subject ?? null
  const reportText = parsed?.reportText ?? null

  const handleDownloadPDF = () => {
    if (!payload || !orderId || !sessionUserId) return
    const params = new URLSearchParams({ sessionUserId })
    if (employerCandidateUserId) params.set('employerCandidateUserId', employerCandidateUserId)
    window.location.href = `/api/psp/${orderId}/pdf?${params.toString()}`
  }

  if (!isOpen) return null

  const card = cn(
    'rounded-xl overflow-hidden',
    isDark ? 'bg-gray-800/50 border border-gray-700/50' : 'bg-white border border-gray-200 shadow-sm',
  )
  const cardHeader = cn('px-5 py-4 border-b', isDark ? 'border-gray-700/50' : 'border-gray-200')
  const muted = isDark ? 'text-gray-500' : 'text-gray-500'
  const strong = isDark ? 'text-white' : 'text-gray-900'

  return (
    <Modal onClose={onClose} maxWidth="max-w-3xl" zIndex={10100}>
      <div className={cn('overflow-hidden', isDark ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' : '')}>

        {/* Header */}
        <div className={cn('relative px-6 py-5 border-b', isDark ? 'border-gray-700/50' : 'border-gray-200')}>
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-700 via-amber-500 to-amber-200" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn('p-2.5 rounded-xl', isDark ? 'bg-amber-500/15' : 'bg-amber-50')}>
                <Shield className="h-6 w-6 text-amber-600 dark:text-amber-400" aria-hidden />
              </div>
              <div>
                <h2 className={cn('text-xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>
                  PSP Report
                </h2>
                <p className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>
                  FMCSA Crash &amp; Inspection History
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {payload && !loading && !error && (
                <Button variant="secondary" size="sm" onClick={handleDownloadPDF}>
                  <Download className="h-4 w-4 mr-1" aria-hidden />
                  <span className="hidden sm:inline">Download</span>
                </Button>
              )}
              <button
                onClick={onClose}
                className={cn(
                  'p-2 rounded-xl transition-all',
                  isDark ? 'hover:bg-gray-700/50 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700',
                )}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto max-h-[calc(90vh-80px)] p-6 space-y-5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {loading && (
            <div className="flex items-center gap-2 py-8 justify-center text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          )}
          {error && (
            <div className={cn('flex items-start gap-2 rounded-lg p-3 text-sm', isDark ? 'bg-red-500/15 text-red-300' : 'bg-red-50 text-red-700')}>
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {!loading && !error && payload && (
            <>
              {/* ── Outcome banner ── */}
              {payload.order.status === 'completed' && payload.order.resultOutcome && (
                <div className={cn('flex items-center justify-between rounded-xl border px-4 py-3', isDark ? 'border-gray-700/60 bg-gray-800/40' : 'border-gray-200 bg-white')}>
                  <div className="flex items-center gap-3">
                    <Shield className={cn('h-5 w-5', isDark ? 'text-amber-400' : 'text-amber-600')} />
                    <div>
                      <p className={cn('text-xs uppercase tracking-wider', muted)}>Report Outcome</p>
                      <p className={cn('text-sm font-semibold', strong)}>{outcomeLabel(payload.order.resultOutcome)}</p>
                    </div>
                  </div>
                  <span className={cn('rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide', outcomeBadgeClasses(payload.order.resultOutcome))}>
                    {outcomeLabel(payload.order.resultOutcome)}
                  </span>
                </div>
              )}

              {/* ── Driver identity ── */}
              {(subject || payload.order.dlNumber || payload.order.dlState) && (
                <div className={card}>
                  <div className={cardHeader}>
                    <SectionHeader icon={UserIcon} title="Driver" accent="teal" isDark={isDark} />
                  </div>
                  <div className="p-5 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    {formatDriverName(subject) && (
                      <div className="col-span-2 md:col-span-1">
                        <p className={cn('text-xs', muted)}>Name</p>
                        <p className={cn('mt-1 font-semibold', strong)}>{formatDriverName(subject)}</p>
                      </div>
                    )}
                    <div>
                      <p className={cn('text-xs', muted)}>License (state)</p>
                      <p className={cn('mt-1 font-medium', strong)}>
                        {(extracted?.dlState || payload.order.dlState || subject?.licenseState || '—').toString()}
                      </p>
                    </div>
                    <div>
                      <p className={cn('text-xs', muted)}>License number</p>
                      <p className={cn('mt-1 font-medium', strong)}>
                        {maskDl(extracted?.dlNumber ?? payload.order.dlNumber ?? subject?.licenseNumber)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Summary counts ── */}
              {hasCounts && (
                <div className={card}>
                  <div className={cardHeader}>
                    <SectionHeader icon={Activity} title="Record Summary" accent="amber" isDark={isDark} />
                  </div>
                  <div className="grid grid-cols-3 gap-px">
                    {([
                      { label: 'Crashes', value: crashCount ?? 0, danger: (crashCount ?? 0) > 0 },
                      { label: 'Inspections', value: inspectionCount ?? 0, danger: false },
                      { label: 'Out of Service', value: oosCount ?? 0, danger: (oosCount ?? 0) > 0 },
                    ] as const).map(({ label, value, danger }) => (
                      <div key={label} className={cn('p-4 text-center', isDark ? 'bg-gray-800/30' : 'bg-gray-50/60')}>
                        <p className={cn('text-3xl font-black', danger ? 'text-red-400' : value === 0 ? 'text-emerald-400' : 'text-amber-400')}>
                          {value}
                        </p>
                        <p className={cn('mt-1 text-xs', muted)}>{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Crashes ── */}
              <div className={card}>
                <div className={cardHeader}>
                  <SectionHeader icon={AlertTriangle} title="Crash History" accent="red" count={crashes.length} isDark={isDark} />
                </div>
                <div className="p-5">
                  {crashes.length === 0 ? (
                    <p className={cn('text-sm text-center py-4', muted)}>No crashes on record</p>
                  ) : (
                    <div className="space-y-3">
                      {crashes.map((crash, idx) => (
                        <div
                          key={idx}
                          className={cn(
                            'rounded-xl border-l-4 border-red-500 p-4',
                            isDark ? 'bg-red-500/5' : 'bg-red-50',
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <p className={cn('font-semibold', strong)}>
                                {[crash.city, crash.state].filter(Boolean).join(', ') || crash.description || 'Crash'}
                              </p>
                              {crash.date && (
                                <p className={cn('mt-0.5 text-xs', muted)}>{crash.date}</p>
                              )}
                            </div>
                            {crash.reportNumber && (
                              <span className={cn('text-xs font-mono', muted)}>#{crash.reportNumber}</span>
                            )}
                          </div>
                          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                            <div>
                              <span className={muted}>Fatalities: </span>
                              <span className={cn('font-medium', (crash.fatalities ?? 0) > 0 ? 'text-red-400' : strong)}>
                                {crash.fatalities ?? 0}
                              </span>
                            </div>
                            <div>
                              <span className={muted}>Injuries: </span>
                              <span className={cn('font-medium', (crash.injuries ?? 0) > 0 ? 'text-amber-400' : strong)}>
                                {crash.injuries ?? 0}
                              </span>
                            </div>
                            <div>
                              <span className={muted}>Tow-away: </span>
                              <span className={cn('font-medium', crash.towAway ? 'text-amber-400' : strong)}>
                                {yesNo(crash.towAway)}
                              </span>
                            </div>
                            <div>
                              <span className={muted}>Hazmat: </span>
                              <span className={cn('font-medium', crash.hazmatReleased ? 'text-red-400' : strong)}>
                                {yesNo(crash.hazmatReleased)}
                              </span>
                            </div>
                            {crash.vehicleType && (
                              <div className="col-span-2">
                                <span className={muted}>Vehicle: </span>
                                <span className={cn('font-medium', strong)}>{crash.vehicleType}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Inspections ── */}
              <div className={card}>
                <div className={cardHeader}>
                  <SectionHeader icon={ClipboardCheck} title="Inspection History" accent="amber" count={inspections.length} isDark={isDark} />
                </div>
                <div className="p-5">
                  {inspections.length === 0 ? (
                    <p className={cn('text-sm text-center py-4', muted)}>No inspections on record</p>
                  ) : (
                    <div className="space-y-4">
                      {inspections.map((insp, idx) => {
                        const oosViolations = insp.violations.filter((v) => v.outOfService)
                        return (
                          <div
                            key={idx}
                            className={cn(
                              'rounded-xl border',
                              isDark ? 'border-gray-700/50 bg-gray-900/30' : 'border-gray-200 bg-gray-50',
                            )}
                          >
                            {/* Inspection header row */}
                            <div className="flex items-center justify-between gap-3 px-4 py-3">
                              <div className="flex-1 min-w-0">
                                <p className={cn('font-semibold text-sm', strong)}>
                                  {[insp.date, insp.state].filter(Boolean).join(' · ') || 'Inspection'}
                                </p>
                                <p className={cn('mt-0.5 text-xs', muted)}>
                                  {[insp.level && `Level ${insp.level}`, insp.vehicleType, insp.county].filter(Boolean).join(' · ')}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {insp.result && (
                                  <span className={cn(
                                    'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                                    insp.result.toLowerCase().includes('no violation')
                                      ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                                      : 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300',
                                  )}>
                                    {insp.result}
                                  </span>
                                )}
                                {oosViolations.length > 0 && (
                                  <span className="rounded-full bg-red-100 dark:bg-red-500/20 px-2.5 py-0.5 text-xs font-semibold text-red-700 dark:text-red-300">
                                    {oosViolations.length} OOS
                                  </span>
                                )}
                                {insp.reportNumber && (
                                  <span className={cn('text-xs font-mono', muted)}>#{insp.reportNumber}</span>
                                )}
                              </div>
                            </div>
                            {/* Nested violations */}
                            {insp.violations.length > 0 && (
                              <div className={cn('border-t divide-y', isDark ? 'border-gray-700/50 divide-gray-700/40' : 'border-gray-200 divide-gray-100')}>
                                {insp.violations.map((viol, vIdx) => (
                                  <div key={vIdx} className="flex items-start gap-3 px-4 py-2.5">
                                    {viol.outOfService && (
                                      <span className="mt-0.5 shrink-0 rounded bg-red-100 dark:bg-red-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-red-600 dark:text-red-300">
                                        OOS
                                      </span>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <p className={cn('text-xs font-medium', strong)}>
                                        {viol.description || viol.code || 'Violation'}
                                      </p>
                                      <p className={cn('mt-0.5 text-xs', muted)}>
                                        {[viol.code, viol.category, viol.section].filter(Boolean).join(' · ')}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Full report text (collapsed) ── */}
              {reportText && (
                <div className={cn('rounded-xl overflow-hidden', isDark ? 'border border-gray-700/50' : 'border border-gray-200')}>
                  <button
                    type="button"
                    onClick={() => setShowReportText(!showReportText)}
                    className={cn(
                      'w-full flex items-center justify-between px-5 py-3.5 transition-colors',
                      isDark ? 'hover:bg-gray-800/60 bg-gray-800/40' : 'hover:bg-gray-50 bg-white',
                    )}
                  >
                    <SectionHeader icon={FileText} title="Full Report Text" accent="slate" isDark={isDark} />
                    <ChevronDown className={cn('h-4 w-4 transition-transform', isDark ? 'text-gray-400' : 'text-gray-500', showReportText && 'rotate-180')} />
                  </button>
                  {showReportText && (
                    <div className={cn('px-5 pb-5 pt-2 border-t', isDark ? 'border-gray-700/50 bg-gray-800/40' : 'border-gray-200 bg-white')}>
                      <pre className={cn('whitespace-pre-wrap font-mono text-[11px] leading-relaxed max-h-72 overflow-y-auto', isDark ? 'text-gray-300' : 'text-gray-700')}>
                        {reportText}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {/* ── Order references (collapsed) ── */}
              <div className={cn('rounded-xl overflow-hidden', isDark ? 'border border-gray-700/50' : 'border border-gray-200')}>
                <button
                  type="button"
                  onClick={() => setShowRefs(!showRefs)}
                  className={cn(
                    'w-full flex items-center justify-between px-5 py-3.5 transition-colors',
                    isDark ? 'hover:bg-gray-800/60 bg-gray-800/40' : 'hover:bg-gray-50 bg-white',
                  )}
                >
                  <SectionHeader icon={Hash} title="Order References" accent="slate" isDark={isDark} />
                  <ChevronDown className={cn('h-4 w-4 transition-transform', isDark ? 'text-gray-400' : 'text-gray-500', showRefs && 'rotate-180')} />
                </button>
                {showRefs && (
                  <div className={cn('px-5 pb-5 pt-2 border-t', isDark ? 'border-gray-700/50 bg-gray-800/40' : 'border-gray-200 bg-white')}>
                    <dl className="grid gap-2 font-mono text-[11px] leading-snug">
                      <div>
                        <dt className={muted}>Storm status</dt>
                        <dd className={cn('font-medium text-xs', strong)}>{payload.order.status}</dd>
                      </div>
                      {filledCode && (
                        <div>
                          <dt className={muted}>Vendor code (FMCSA)</dt>
                          <dd className={cn(isDark ? 'text-gray-200' : 'text-gray-800')}>{filledCode}</dd>
                        </div>
                      )}
                      {payload.order.orderNumber && (
                        <div>
                          <dt className={muted}>Our order #</dt>
                          <dd className={cn('break-all', isDark ? 'text-gray-200' : 'text-gray-800')}>{payload.order.orderNumber}</dd>
                        </div>
                      )}
                      {payload.order.subOrderNumber && (
                        <div>
                          <dt className={muted}>FMCSA suborder #</dt>
                          <dd className={cn('break-all', isDark ? 'text-gray-200' : 'text-gray-800')}>{payload.order.subOrderNumber}</dd>
                        </div>
                      )}
                    </dl>
                    <div className={cn('mt-4 grid grid-cols-2 gap-3 text-sm border-t pt-4', isDark ? 'border-gray-700/50' : 'border-gray-200')}>
                      <div>
                        <p className={cn('text-xs', muted)}>Ordered</p>
                        <p className={cn('mt-0.5 font-medium text-xs', strong)}>{formatWhen(payload.order.orderedAt)}</p>
                      </div>
                      <div>
                        <p className={cn('text-xs', muted)}>Completed</p>
                        <p className={cn('mt-0.5 font-medium text-xs', strong)}>{formatWhen(payload.order.completedAt)}</p>
                      </div>
                      <div>
                        <p className={cn('text-xs', muted)}>Vendor received</p>
                        <p className={cn('mt-0.5 font-medium text-xs', strong)}>{formatWhen(payload.result?.receivedAt)}</p>
                      </div>
                      {payload.order.expiresAt && (
                        <div>
                          <p className={cn('text-xs', muted)}>Access expires</p>
                          <p className={cn('mt-0.5 font-medium text-xs', strong)}>{formatWhen(payload.order.expiresAt)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Truck icon for employer-ordered banner */}
              {payload.order.orderedByEmployer && (
                <div className={cn(
                  'flex gap-2 rounded-lg border px-3 py-2 text-xs',
                  employerCandidateUserId
                    ? isDark ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100' : 'border-emerald-200 bg-emerald-50 text-emerald-950'
                    : isDark ? 'border-amber-500/30 bg-amber-500/10 text-amber-100' : 'border-amber-200 bg-amber-50 text-amber-950',
                )}>
                  <Truck className="mt-0.5 h-4 w-4 shrink-0 opacity-70" aria-hidden />
                  <p className="leading-relaxed">
                    {employerCandidateUserId
                      ? 'You purchased this screening. Full vendor XML is retained for compliance.'
                      : 'This PSP was ordered as part of an employer screening request.'}
                  </p>
                </div>
              )}

              {payload.order.errorMessage && (
                <div className={cn('rounded-lg border px-3 py-2 text-sm', isDark ? 'border-red-500/40 bg-red-500/10 text-red-200' : 'border-red-200 bg-red-50 text-red-900')}>
                  <span className="font-semibold">Order note: </span>
                  {payload.order.errorMessage}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}
