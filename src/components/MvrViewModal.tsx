'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useEffect, useMemo, useState } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { X, FileText, AlertCircle, Download, Loader2 } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'
import { outcomeLabel, type ScreeningOutcome } from '@/lib/accio-result-status'

interface MvrViewModalProps {
  isOpen: boolean
  onClose: () => void
  sessionUserId: string | null
  /** Load this order directly (My Files → View). Omit to use legacy latest-order check-status flow. */
  orderId?: string | null
  /**
   * Talent modal: candidate’s user id. Loads via GET /api/mvr/status/...?employerCandidateUserId=...
   * (company must have paid for that order).
   */
  employerCandidateUserId?: string | null
}

interface MvrSubject {
  firstName?: string
  middleName?: string
  lastName?: string
}

interface ResolvedMvr {
  orderId: string
  driverName: string
  outcome: ScreeningOutcome | null
}

function formatDriverName(subject: MvrSubject | null | undefined): string {
  if (!subject) return ''
  return [subject.firstName, subject.middleName, subject.lastName].filter(Boolean).join(' ')
}

/** Same PDF bytes as Download — `inline` only changes browser disposition for iframe preview. */
function buildMvrPdfUrl(
  orderId: string,
  opts?: { employerCandidateUserId?: string | null; inline?: boolean },
): string {
  const params = new URLSearchParams()
  if (opts?.employerCandidateUserId) params.set('employerCandidateUserId', opts.employerCandidateUserId)
  if (opts?.inline) params.set('disposition', 'inline')
  const q = params.toString()
  return `/api/mvr/${orderId}/pdf${q ? `?${q}` : ''}`
}

export default function MvrViewModal({
  isOpen,
  onClose,
  sessionUserId,
  orderId: orderIdProp,
  employerCandidateUserId,
}: MvrViewModalProps) {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)

  const [resolving, setResolving] = useState(true)
  const [pdfLoading, setPdfLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [resolved, setResolved] = useState<ResolvedMvr | null>(null)

  useEffect(() => {
    if (!isOpen || !sessionUserId) return

    let cancelled = false

    const resolveOrder = async () => {
      try {
        setResolving(true)
        setPdfLoading(true)
        setError(null)
        setResolved(null)

        const statusQuery = new URLSearchParams({ sessionUserId })
        if (employerCandidateUserId) {
          statusQuery.set('employerCandidateUserId', employerCandidateUserId)
        }

        let targetOrderId = orderIdProp ?? null

        if (!targetOrderId) {
          const checkRes = await fetch(
            `/api/mvr/check-status?sessionUserId=${encodeURIComponent(sessionUserId)}`,
          )
          if (!checkRes.ok) throw new Error('Failed to fetch MVR data')
          const checkData = await checkRes.json()
          if (!checkData.hasMvr || !checkData.order?.id) {
            throw new Error('No MVR found')
          }
          targetOrderId = checkData.order.id as string
        }

        const statusRes = await fetch(`/api/mvr/status/${targetOrderId}?${statusQuery.toString()}`)
        if (!statusRes.ok) {
          const errBody = await statusRes.json().catch(() => ({}))
          throw new Error((errBody as { error?: string }).error || 'Failed to load MVR')
        }

        const statusData = await statusRes.json()
        if (!statusData.result) {
          throw new Error('Report not yet available — order is still processing')
        }

        if (cancelled) return

        setResolved({
          orderId: targetOrderId,
          driverName: formatDriverName(statusData.result?.subject),
          outcome: (statusData.order?.resultOutcome as ScreeningOutcome) ?? null,
        })
      } catch (err: unknown) {
        if (cancelled) return
        console.error('[MVR VIEW] Error resolving order:', err)
        setError(err instanceof Error ? err.message : 'Failed to load MVR')
      } finally {
        if (!cancelled) setResolving(false)
      }
    }

    void resolveOrder()
    return () => {
      cancelled = true
    }
  }, [isOpen, sessionUserId, orderIdProp, employerCandidateUserId])

  const pdfPreviewUrl = useMemo(
    () =>
      resolved
        ? buildMvrPdfUrl(resolved.orderId, { employerCandidateUserId, inline: true })
        : null,
    [resolved, employerCandidateUserId],
  )

  const handleDownloadPDF = () => {
    if (!resolved) return
    window.location.href = buildMvrPdfUrl(resolved.orderId, { employerCandidateUserId })
  }

  if (!isOpen) return null

  const showPdf = !resolving && !error && pdfPreviewUrl

  return (
    <Modal onClose={onClose} maxWidth="max-w-6xl" zIndex={10100}>
      <div className={isDark ? 'bg-gray-900' : 'bg-white'}>
        <div
          className={cn(
            'relative flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between',
            isDark ? 'border-gray-700/50' : 'border-gray-200',
          )}
        >
          <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-teal-700 via-teal-500 to-teal-200" />

          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className={cn('rounded-xl p-2.5', isDark ? 'bg-teal-700/20' : 'bg-teal-700/10')}>
              <FileText className="h-6 w-6 text-teal-600 dark:text-teal-400" />
            </div>
            <div className="min-w-0">
              <h2 className={cn('text-xl font-bold', isDark ? 'text-white' : 'text-gray-900')}>
                Motor Vehicle Report
              </h2>
              {resolved?.driverName ? (
                <p
                  className={cn(
                    'text-sm font-medium break-words',
                    isDark ? 'text-teal-400' : 'text-teal-800',
                  )}
                >
                  {resolved.driverName}
                  {resolved.outcome ? ` · ${outcomeLabel(resolved.outcome)}` : ''}
                </p>
              ) : (
                <p className={cn('text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>
                  Official DMV Record
                </p>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2">
            {showPdf && (
              <Button variant="secondary" size="sm" onClick={handleDownloadPDF} title="Download Report PDF">
                <Download className="mr-1 h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">Download</span>
              </Button>
            )}
            <button
              type="button"
              onClick={onClose}
              className={cn(
                'rounded-xl p-2 transition-all',
                isDark
                  ? 'text-gray-400 hover:bg-gray-700/50 hover:text-white'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700',
              )}
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="relative min-h-[70vh] bg-slate-100 dark:bg-gray-950">
          {resolving && (
            <div className="flex flex-col items-center justify-center py-24">
              <Loader2 className="h-10 w-10 animate-spin text-teal-600 dark:text-teal-400" />
              <p className={cn('mt-4 text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>
                Loading report…
              </p>
            </div>
          )}

          {!resolving && error && (
            <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
              <div className={cn('rounded-full p-4', isDark ? 'bg-red-500/10' : 'bg-red-50')}>
                <AlertCircle className="h-12 w-12 text-red-500" />
              </div>
              <p className={cn('mt-4 max-w-md font-medium', isDark ? 'text-red-400' : 'text-red-600')}>
                {error}
              </p>
            </div>
          )}

          {showPdf && (
            <>
              {pdfLoading && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-100/90 dark:bg-gray-950/90">
                  <Loader2 className="h-10 w-10 animate-spin text-teal-600 dark:text-teal-400" />
                  <p className={cn('mt-4 text-sm', isDark ? 'text-gray-400' : 'text-gray-500')}>
                    Rendering PDF preview…
                  </p>
                </div>
              )}
              <iframe
                key={pdfPreviewUrl}
                src={pdfPreviewUrl}
                title="Motor Vehicle Report"
                className="h-[calc(90vh-88px)] w-full border-0 bg-white"
                onLoad={() => setPdfLoading(false)}
              />
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}
