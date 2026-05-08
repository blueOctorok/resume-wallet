'use client'

import { useState, useEffect } from 'react'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import { Loader2, AlertCircle, FileText, Hash, Truck, Download, Shield } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { isDarkTheme } from '@/lib/theme-storage'
import { cn } from '@/lib/utils'
import Button from '@/components/ui/Button'
import {
  outcomeBadgeClasses,
  outcomeLabel,
  type ScreeningOutcome,
} from '@/lib/accio-result-status'

interface PspViewModalProps {
  isOpen: boolean
  onClose: () => void
  walletAddress: string | null
  orderId: string | null
  /** Talent modal: pass with employer wallet so status API authorizes purchaser view. */
  employerCandidateUserId?: string | null
}

/**
 * Shape of `psp_results.parsed_data`. We accept both the legacy stub format
 * (rows persisted before src/lib/accio-psp-parser.ts shipped) and the new
 * structured shape from `pspResultToJsonb` so the modal renders correctly
 * during the rollout window.
 */
interface PspParsedStub {
  // Legacy stub fields (kept for backward compatibility with existing rows).
  stub?: boolean
  extracted?: {
    orderNumber?: string | null
    subOrderNumber?: string | null
    remoteOrderNumber?: string | null
    remoteSubOrderNumber?: string | null
    dlNumber?: string | null
    dlState?: string | null
    filledCode?: string | null
  }

  // New structured fields from accio-psp-parser.ts.
  filledCode?: string | null
  filledStatus?: string | null
  crashCount?: number | null
  inspectionCount?: number | null
  oosCount?: number | null
}

interface PspOrderPayload {
  id: string
  orderNumber: string | null
  subOrderNumber: string | null
  remoteOrderNumber: string | null
  remoteSubOrderNumber: string | null
  status: string
  /** Accio-derived outcome (clear/hits/no_hits/...). Only set when status === 'completed'. */
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
  parsedData: PspParsedStub | null
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString()
}

/** Show last 4 of DL only — same privacy bar as showing MVR summary, not full number in UI. */
function maskDl(raw: string | null | undefined): string {
  const s = (raw ?? '').replace(/\s/g, '')
  if (!s) return '—'
  if (s.length <= 4) return '••••'
  return `••••${s.slice(-4)}`
}

function muted(isDark: boolean) {
  return isDark ? 'text-gray-500' : 'text-gray-500'
}

function sectionTitle(isDark: boolean) {
  return cn(
    'text-xs font-semibold uppercase tracking-wide',
    isDark ? 'text-gray-400' : 'text-gray-600',
  )
}

// Vendor `filledCode` chip — neutral/literal display of whatever Accio returned
// (e.g. `clear`, `hits`, `no hits`, `unknown`). The semantic green/amber badge
// lives separately as the "Report Outcome" chip above the Order section, driven
// by `resultOutcome` from accio-result-status.ts. This one is intentionally
// neutral so it never disagrees with the canonical outcome.
function filledCodeBadge(_code: string | null | undefined, isDark: boolean) {
  return cn(
    'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-mono',
    isDark ? 'bg-gray-700/60 text-gray-200' : 'bg-gray-100 text-gray-800',
  )
}

// PSP PDF generation moved server-side to /api/psp/[orderId]/pdf — see
// src/lib/pdf/PspReportPdf.tsx for the new branded layout. The previous
// window.print() popup produced an unsaveable browser print sheet, not a real
// archivable artifact, and didn't surface crash/inspection structure at all.

/**
 * PSP result viewer — shows everything we reliably persist today (order IDs, vendor code, DL
 * state, timestamps). Crash/inspection rows wait on Accio XML mapping (same as before).
 */
export default function PspViewModal({
  isOpen,
  onClose,
  walletAddress,
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

  useEffect(() => {
    if (!isOpen || !orderId || !walletAddress) return
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const q = new URLSearchParams({ walletAddress })
        if (employerCandidateUserId) {
          q.set('employerCandidateUserId', employerCandidateUserId)
        }
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
    return () => {
      cancelled = true
    }
  }, [isOpen, orderId, walletAddress, employerCandidateUserId])

  // parsed_data carries either the legacy stub shape (extracted.filledCode) or
  // the new structured shape from accio-psp-parser.ts (filledCode at the top
  // level + counts). Fall back gracefully so old rows still render.
  const parsed = payload?.result?.parsedData ?? null
  const extracted = parsed?.extracted
  const filledCode = parsed?.filledCode ?? extracted?.filledCode ?? null
  const crashCount = parsed?.crashCount ?? null
  const inspectionCount = parsed?.inspectionCount ?? null
  const oosCount = parsed?.oosCount ?? null
  const hasCounts = crashCount !== null || inspectionCount !== null || oosCount !== null
  const canDownload = Boolean(payload && !loading && !error)

  const handleDownloadPDF = () => {
    if (!payload || !orderId) return
    const params = new URLSearchParams({ walletAddress })
    if (employerCandidateUserId) params.set('employerCandidateUserId', employerCandidateUserId)
    window.location.href = `/api/psp/${orderId}/pdf?${params.toString()}`
  }

  if (!isOpen) return null

  return (
    <Modal onClose={onClose} maxWidth="max-w-lg" zIndex={10100}>
      <ModalHeader title="PSP Report" subtitle="FMCSA crash & inspection history" onClose={onClose} />
      <div
        className={cn(
          'p-5 space-y-5',
          isDark ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-900',
        )}
      >
        {canDownload && (
          <div className="flex justify-end">
            <Button type="button" variant="secondary" size="sm" onClick={handleDownloadPDF}>
              <Download className="mr-1 h-4 w-4" aria-hidden />
              Download PDF
            </Button>
          </div>
        )}
        {loading && (
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        )}
        {error && (
          <div
            className={cn(
              'flex items-start gap-2 rounded-lg p-3 text-sm',
              isDark ? 'bg-red-500/15 text-red-300' : 'bg-red-50 text-red-700',
            )}
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {!loading && !error && payload && (
          <>
            {/* Outcome banner — Clear / Hits / etc. Same pattern as the MVR
                modal so employers + candidates see one consistent verdict. */}
            {payload.order.status === 'completed' && payload.order.resultOutcome && (
              <div
                className={cn(
                  'flex items-center justify-between rounded-xl border px-4 py-3',
                  isDark ? 'border-gray-700/60 bg-gray-800/40' : 'border-gray-200 bg-white',
                )}
              >
                <div className="flex items-center gap-3">
                  <Shield className={cn('h-5 w-5', isDark ? 'text-amber-400' : 'text-amber-600')} />
                  <div>
                    <p className={cn('text-xs uppercase tracking-wider', muted(isDark))}>
                      Report Outcome
                    </p>
                    <p className={cn('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
                      {outcomeLabel(payload.order.resultOutcome)}
                    </p>
                  </div>
                </div>
                <span
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide',
                    outcomeBadgeClasses(payload.order.resultOutcome),
                  )}
                >
                  {outcomeLabel(payload.order.resultOutcome)}
                </span>
              </div>
            )}

            {/* Summary counts surface as soon as the parser writes them. We
                show the banner regardless of values (zeros are meaningful — a
                clean PSP). */}
            {hasCounts && (
              <div
                className={cn(
                  'grid grid-cols-3 gap-3 rounded-xl border p-3 text-center',
                  isDark ? 'border-gray-700/60 bg-gray-800/40' : 'border-gray-200 bg-white',
                )}
              >
                <div>
                  <p className={cn('text-xs uppercase tracking-wider', muted(isDark))}>Crashes</p>
                  <p className={cn('text-lg font-bold', isDark ? 'text-white' : 'text-gray-900')}>
                    {crashCount ?? 0}
                  </p>
                </div>
                <div>
                  <p className={cn('text-xs uppercase tracking-wider', muted(isDark))}>Inspections</p>
                  <p className={cn('text-lg font-bold', isDark ? 'text-white' : 'text-gray-900')}>
                    {inspectionCount ?? 0}
                  </p>
                </div>
                <div>
                  <p className={cn('text-xs uppercase tracking-wider', muted(isDark))}>Out of service</p>
                  <p
                    className={cn(
                      'text-lg font-bold',
                      (oosCount ?? 0) > 0
                        ? isDark
                          ? 'text-red-300'
                          : 'text-red-700'
                        : isDark
                          ? 'text-white'
                          : 'text-gray-900',
                    )}
                  >
                    {oosCount ?? 0}
                  </p>
                </div>
              </div>
            )}

            {payload.order.orderedByEmployer && (
              <p
                className={cn(
                  'rounded-lg border px-3 py-2 text-xs',
                  employerCandidateUserId
                    ? isDark
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-950'
                    : isDark
                      ? 'border-amber-500/30 bg-amber-500/10 text-amber-100'
                      : 'border-amber-200 bg-amber-50 text-amber-950',
                )}
              >
                {employerCandidateUserId
                  ? 'You purchased this screening for your company. Full vendor XML is retained for compliance; structured crash/inspection rows below will grow as we map Accio&apos;s format.'
                  : 'This PSP was ordered as part of an employer screening request. Full vendor XML is retained for compliance; structured crash/inspection rows below will grow as we map Accio&apos;s format.'}
              </p>
            )}

            <div className="space-y-2">
              <p className={sectionTitle(isDark)}>Order</p>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className={muted(isDark)}>Storm status</dt>
                  <dd className="font-medium">{payload.order.status}</dd>
                </div>
                <div>
                  <dt className={muted(isDark)}>Vendor code (FMCSA)</dt>
                  <dd className="mt-0.5">
                    <span className={filledCodeBadge(filledCode, isDark)}>
                      {filledCode || '—'}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className={muted(isDark)}>Result in vault</dt>
                  <dd className="font-medium">{payload.result?.resultStatus ?? '—'}</dd>
                </div>
                <div>
                  <dt className={muted(isDark)}>License (state)</dt>
                  <dd className="font-medium">
                    {(extracted?.dlState || payload.order.dlState || '—').toString()}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className={muted(isDark)}>License number</dt>
                  <dd className="font-medium">{maskDl(extracted?.dlNumber ?? payload.order.dlNumber)}</dd>
                </div>
              </dl>
            </div>

            <div
              className={cn(
                'space-y-2 rounded-xl border p-3',
                isDark ? 'border-gray-700 bg-gray-800/40' : 'border-slate-200 bg-slate-50/80',
              )}
            >
              <p className={cn('flex items-center gap-1.5', sectionTitle(isDark))}>
                <Hash className="h-3.5 w-3.5" aria-hidden />
                Accio references
              </p>
              <dl className="grid gap-2 font-mono text-[11px] leading-snug">
                <div>
                  <dt className={muted(isDark)}>Our order #</dt>
                  <dd className={cn('break-all', isDark ? 'text-gray-200' : 'text-gray-800')}>
                    {payload.order.orderNumber ?? '—'}
                  </dd>
                </div>
                <div>
                  <dt className={muted(isDark)}>FMCSA suborder #</dt>
                  <dd className={cn('break-all', isDark ? 'text-gray-200' : 'text-gray-800')}>
                    {payload.order.subOrderNumber ?? '—'}
                  </dd>
                </div>
                {(payload.order.remoteOrderNumber || payload.order.remoteSubOrderNumber) && (
                  <>
                    <div>
                      <dt className={muted(isDark)}>Accio remote order</dt>
                      <dd className={cn('break-all', isDark ? 'text-gray-200' : 'text-gray-800')}>
                        {payload.order.remoteOrderNumber ?? '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className={muted(isDark)}>Accio remote suborder</dt>
                      <dd className={cn('break-all', isDark ? 'text-gray-200' : 'text-gray-800')}>
                        {payload.order.remoteSubOrderNumber ?? '—'}
                      </dd>
                    </div>
                  </>
                )}
              </dl>
            </div>

            <div className="space-y-2">
              <p className={cn('flex items-center gap-1.5', sectionTitle(isDark))}>
                <Truck className="h-3.5 w-3.5" aria-hidden />
                Timeline
              </p>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div className="col-span-2">
                  <dt className={muted(isDark)}>Ordered</dt>
                  <dd className="font-medium">{formatWhen(payload.order.orderedAt)}</dd>
                </div>
                <div>
                  <dt className={muted(isDark)}>Vendor received</dt>
                  <dd className="font-medium">{formatWhen(payload.result?.receivedAt)}</dd>
                </div>
                <div>
                  <dt className={muted(isDark)}>Completed</dt>
                  <dd className="font-medium">{formatWhen(payload.order.completedAt)}</dd>
                </div>
                {payload.order.expiresAt && (
                  <div className="col-span-2">
                    <dt className={muted(isDark)}>Access window (expires)</dt>
                    <dd className="font-medium">{formatWhen(payload.order.expiresAt)}</dd>
                  </div>
                )}
              </dl>
            </div>

            {payload.order.errorMessage && (
              <div
                className={cn(
                  'rounded-lg border px-3 py-2 text-sm',
                  isDark ? 'border-red-500/40 bg-red-500/10 text-red-200' : 'border-red-200 bg-red-50 text-red-900',
                )}
              >
                <span className="font-semibold">Order note: </span>
                {payload.order.errorMessage}
              </div>
            )}

            <div
              className={cn(
                'flex gap-2 rounded-lg border px-3 py-2 text-xs',
                isDark ? 'border-gray-700 text-gray-400' : 'border-slate-200 text-gray-600',
              )}
            >
              <FileText className="mt-0.5 h-4 w-4 shrink-0 opacity-70" aria-hidden />
              <p className="leading-relaxed">
                Crash and inspection <span className="font-medium">line items</span> will list here after we map
                Accio&apos;s PSP XML into structured fields (same pattern as your MVR modal). Until then, the
                fields above are the trustworthy summary: IDs for support, vendor code, and timeline.
              </p>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
