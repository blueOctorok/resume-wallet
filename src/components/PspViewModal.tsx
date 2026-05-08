'use client'

import { useState, useEffect } from 'react'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import { Loader2, AlertCircle, FileText, Hash, Truck, Download } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { isDarkTheme } from '@/lib/theme-storage'
import { cn } from '@/lib/utils'
import Button from '@/components/ui/Button'

interface PspViewModalProps {
  isOpen: boolean
  onClose: () => void
  walletAddress: string | null
  orderId: string | null
  /** Talent modal: pass with employer wallet so status API authorizes purchaser view. */
  employerCandidateUserId?: string | null
}

/** Shape of `psp_results.parsed_data` from webhook processing (stub + Accio extract). */
interface PspParsedStub {
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
}

interface PspOrderPayload {
  id: string
  orderNumber: string | null
  subOrderNumber: string | null
  remoteOrderNumber: string | null
  remoteSubOrderNumber: string | null
  status: string
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

function filledCodeBadge(code: string | null | undefined, isDark: boolean) {
  const c = (code ?? '').toLowerCase()
  const verified = c === 'verified'
  return cn(
    'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold',
    verified
      ? isDark
        ? 'bg-emerald-500/20 text-emerald-300'
        : 'bg-emerald-100 text-emerald-900'
      : isDark
        ? 'bg-amber-500/20 text-amber-200'
        : 'bg-amber-100 text-amber-900',
  )
}

/** Tiny escape so PSP IDs / status / error notes can't break out of generated HTML. */
function htmlEscape(input: string | null | undefined): string {
  return String(input ?? '—')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Open a print-friendly PSP summary in a new window and trigger the browser's
 * Save-as-PDF / Print dialog. Mirrors `MvrViewModal`'s flow so employers (and the
 * candidate when they paid for it) get a consistent download UX without us
 * pulling in a PDF generator dependency.
 */
function openPspPrintWindow(
  order: PspOrderPayload,
  result: PspResultPayload | null,
  extracted: PspParsedStub['extracted'] | undefined,
) {
  const w = window.open('', '_blank')
  if (!w) {
    alert('Please allow popups to download the PSP report')
    return
  }

  const filledCode = extracted?.filledCode ?? null
  const filledColor = String(filledCode ?? '').toLowerCase() === 'verified' ? '#059669' : '#b45309'
  const fileTitleSuffix = order.orderNumber ? ` - ${order.orderNumber}` : ''

  const fmt = (iso: string | null | undefined): string => {
    if (!iso) return '—'
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString()
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>PSP Report${fileTitleSuffix}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1f2937; line-height: 1.5; padding: 40px; max-width: 800px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #b45309; padding-bottom: 20px; margin-bottom: 28px; }
    .header h1 { font-size: 22px; color: #b45309; }
    .header .meta { text-align: right; font-size: 12px; color: #6b7280; }
    .meta .order-num { font-family: monospace; }
    .section { margin-bottom: 22px; }
    .section h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .04em; color: #374151; margin-bottom: 10px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 24px; }
    .grid .full { grid-column: 1 / -1; }
    .label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: .03em; margin-bottom: 2px; }
    .value { font-size: 14px; color: #111827; font-weight: 500; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; color: ${filledColor}; background: ${filledColor}1A; }
    .ids { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px; font-family: monospace; font-size: 12px; }
    .ids div + div { margin-top: 6px; }
    .note { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 10px 12px; font-size: 12px; color: #92400e; margin-top: 18px; }
    .note.error { background: #fef2f2; border-color: #fecaca; color: #991b1b; }
    .footer { margin-top: 32px; padding-top: 14px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #6b7280; text-align: center; }
    .footer .brand { color: #0d9488; font-weight: 600; margin-top: 6px; }
    @media print {
      body { padding: 20px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>PSP Report Summary</h1>
      <p style="font-size:13px;color:#6b7280;margin-top:4px">FMCSA crash &amp; inspection history (Pre-Employment Screening Program)</p>
    </div>
    <div class="meta">
      <div>Generated ${new Date().toLocaleString()}</div>
      ${order.orderNumber ? `<div class="order-num">Order ${htmlEscape(order.orderNumber)}</div>` : ''}
    </div>
  </div>

  <div class="section">
    <h2>Order</h2>
    <div class="grid">
      <div><div class="label">Storm status</div><div class="value">${htmlEscape(order.status)}</div></div>
      <div><div class="label">Vendor code (FMCSA)</div><div class="value"><span class="badge">${htmlEscape(filledCode || '—')}</span></div></div>
      <div><div class="label">Result in vault</div><div class="value">${htmlEscape(result?.resultStatus)}</div></div>
      <div><div class="label">License (state)</div><div class="value">${htmlEscape(extracted?.dlState || order.dlState)}</div></div>
      <div class="full"><div class="label">License number</div><div class="value">${htmlEscape(maskDl(extracted?.dlNumber ?? order.dlNumber))}</div></div>
    </div>
  </div>

  <div class="section">
    <h2>Accio references</h2>
    <div class="ids">
      <div>Our order #: ${htmlEscape(order.orderNumber)}</div>
      <div>FMCSA suborder #: ${htmlEscape(order.subOrderNumber)}</div>
      ${order.remoteOrderNumber ? `<div>Accio remote order: ${htmlEscape(order.remoteOrderNumber)}</div>` : ''}
      ${order.remoteSubOrderNumber ? `<div>Accio remote suborder: ${htmlEscape(order.remoteSubOrderNumber)}</div>` : ''}
    </div>
  </div>

  <div class="section">
    <h2>Timeline</h2>
    <div class="grid">
      <div class="full"><div class="label">Ordered</div><div class="value">${fmt(order.orderedAt)}</div></div>
      <div><div class="label">Vendor received</div><div class="value">${fmt(result?.receivedAt)}</div></div>
      <div><div class="label">Completed</div><div class="value">${fmt(order.completedAt)}</div></div>
      ${order.expiresAt ? `<div class="full"><div class="label">Access window (expires)</div><div class="value">${fmt(order.expiresAt)}</div></div>` : ''}
    </div>
  </div>

  ${order.errorMessage ? `<div class="note error"><strong>Order note: </strong>${htmlEscape(order.errorMessage)}</div>` : ''}

  <div class="note">
    Crash and inspection line items are not yet broken out in this summary while we map Accio&apos;s PSP XML.
    The fields above (IDs, vendor code, timeline) are the trustworthy summary for support and recordkeeping.
  </div>

  <div class="footer">
    <div>Storm — Blockchain-Verified Career Platform</div>
    <div class="brand">Generated from Storm Hub · For employer / driver use only</div>
  </div>

  <script>window.onload = function() { window.print(); };</script>
</body>
</html>`

  w.document.write(html)
  w.document.close()
}

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

  const extracted = payload?.result?.parsedData?.extracted
  const filledCode = extracted?.filledCode ?? null
  const canDownload = Boolean(payload && !loading && !error)

  const handleDownloadPDF = () => {
    if (!payload) return
    openPspPrintWindow(payload.order, payload.result, extracted)
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
