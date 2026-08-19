'use client'

import { useState, useEffect } from 'react'
import { Loader2, AlertCircle, Download } from 'lucide-react'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import DotAppPreviewContent, { type DotAppPreviewData } from '@/components/career-card/DotAppPreviewContent'

export interface DotAppPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string | null
  sessionUserId: string | null
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
  sessionUserId,
  isDark: _isDark,
  applicationId,
}: DotAppPreviewModalProps) {
  const [previewData, setPreviewData] = useState<(DotAppPreviewData & { id?: string }) | null>(null)
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || !userId || !sessionUserId) {
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
  }, [isOpen, userId, sessionUserId, applicationId])

  const downloadPdf = async () => {
    const id = previewData?.id
    if (!id || !sessionUserId) return
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

  // DOT preview is a legal packet — cream paper + midnight ink, same as the form.
  // Never follow app Dark: that paints dark type on a navy modal (unreadable).
  const paper = true

  return (
    <Modal
      onClose={onClose}
      maxWidth='max-w-3xl'
      zIndex={10100}
      paper={paper}
      panelClassName='!bg-[#fbf8f1] scrollbar-none overscroll-contain max-sm:!max-h-[calc(100dvh-2rem)]'
    >
      <ModalHeader
        title='DOT Application'
        subtitle='Your completed driver qualification file'
        onClose={onClose}
        paper={paper}
      />
      {/* Owner-only: the export route is scoped to the application's own user, so
          showing this to an employer just produces a 404. */}
      {!loading && !fetchError && previewData?.id && sessionUserId === userId && (
        <div className='flex items-center gap-2 border-b border-ironside/20 bg-[#fbf8f1] px-4 py-3 sm:px-7'>
          <Button
            type='button'
            variant='primary'
            size='sm'
            isLoading={pdfLoading}
            onClick={() => void downloadPdf()}
            className='gap-1.5'
          >
            <Download className='h-4 w-4' aria-hidden />
            Download PDF
          </Button>
        </div>
      )}
      {pdfError && (
        <p className='px-4 py-2 text-xs text-red-700'>{pdfError}</p>
      )}
      <div className='dot-app-paper bg-[#fbf8f1] text-[#173150]'>
        {loading && (
          <div className='flex items-center justify-center py-16'>
            <Loader2 className='h-6 w-6 animate-spin text-[#173150]' />
          </div>
        )}
        {fetchError && (
          <div className='m-6 flex items-center gap-2 rounded-xl bg-red-50 p-4 text-sm text-red-700'>
            <AlertCircle className='h-4 w-4 shrink-0' />
            {fetchError}
          </div>
        )}
        {!loading && !fetchError && previewData && (
          <DotAppPreviewContent data={previewData} isDark={false} />
        )}
      </div>
    </Modal>
  )
}
