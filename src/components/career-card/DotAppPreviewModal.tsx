'use client'

import { useState, useEffect } from 'react'
import { Loader2, AlertCircle, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import DotAppPreviewContent, { type DotAppPreviewData } from '@/components/career-card/DotAppPreviewContent'

export interface DotAppPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string | null
  walletAddress: string | null
  isDark: boolean
  /** My Files row — load this application row instead of latest */
  applicationId?: string | null
}

/**
 * Fetches full DOT application (form1–3) for self-view or employer preview.
 * Used from career card, My Files, etc.
 */
export default function DotAppPreviewModal({
  isOpen,
  onClose,
  userId,
  walletAddress,
  isDark,
  applicationId,
}: DotAppPreviewModalProps) {
  const [previewData, setPreviewData] = useState<(DotAppPreviewData & { id?: string }) | null>(null)
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || !userId || !walletAddress) {
      return
    }
    let cancelled = false
    setPreviewData(null)
    setFetchError(null)
    setPdfError(null)
    setLoading(true)
    ;(async () => {
      try {
        const q = applicationId
          ? `?applicationId=${encodeURIComponent(applicationId)}`
          : ''
        const res = await fetch(`/api/employer/talent/${userId}/dot-app${q}`)
        if (!res.ok) throw new Error('Failed to load DOT application')
        const json = (await res.json()) as DotAppPreviewData & { id?: string }
        if (!cancelled) setPreviewData(json)
      } catch (err) {
        if (!cancelled) {
          setFetchError(err instanceof Error ? err.message : 'Failed to load DOT application')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isOpen, userId, walletAddress, applicationId])

  const downloadPdf = async () => {
    const id = previewData?.id
    if (!id || !walletAddress) return
    setPdfLoading(true)
    try {
      const res = await fetch(`/api/driver-applications/${id}/export-pdf`)
      if (!res.ok) throw new Error('PDF failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `DOT_Application.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setPdfError('Could not generate PDF. Try again.')
    } finally {
      setPdfLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <Modal onClose={onClose} maxWidth='max-w-2xl' zIndex={10100}>
      <ModalHeader
        title='DOT Application'
        subtitle='Your completed driver qualification file'
        onClose={onClose}
      />
      {!loading && !fetchError && previewData?.id && walletAddress && (
        <div
          className={cn(
            'flex items-center gap-2 px-4 py-3 border-b',
            isDark ? 'border-gray-700 bg-gray-800/40' : 'border-gray-100 bg-gray-50',
          )}
        >
          <button
            type='button'
            onClick={downloadPdf}
            disabled={pdfLoading}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50',
              isDark ? 'bg-teal-500/20 text-teal-300 hover:bg-teal-500/30' : 'bg-teal-600 text-white hover:bg-teal-700',
            )}
          >
            {pdfLoading ? <Loader2 className='w-4 h-4 animate-spin' /> : <Download className='w-4 h-4' />}
            {pdfLoading ? 'Generating…' : 'Download PDF'}
          </button>
        </div>
      )}
      {pdfError && (
        <p className={cn('text-xs px-4 py-2', isDark ? 'text-red-400' : 'text-red-600')}>{pdfError}</p>
      )}
      <div className='overflow-y-auto max-h-[75vh]'>
        {loading && (
          <div className='flex items-center justify-center py-16'>
            <Loader2 className={cn('w-6 h-6 animate-spin', isDark ? 'text-teal-400' : 'text-teal-600')} />
          </div>
        )}
        {fetchError && (
          <div
            className={cn(
              'm-6 flex items-center gap-2 p-4 rounded-xl text-sm',
              isDark ? 'bg-red-900/20 text-red-400' : 'bg-red-50 text-red-600',
            )}
          >
            <AlertCircle className='w-4 h-4 shrink-0' />
            {fetchError}
          </div>
        )}
        {!loading && !fetchError && previewData && (
          <DotAppPreviewContent data={previewData} isDark={isDark} />
        )}
      </div>
    </Modal>
  )
}
