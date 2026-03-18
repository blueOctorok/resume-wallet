'use client'

import { ExternalLink, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import Modal, { ModalHeader } from '@/components/ui/Modal'

interface ResumeFilePreviewModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  /** Full IPFS gateway URL to the file */
  ipfsUrl: string
  isDark: boolean
}

/**
 * In-app preview for uploaded (IPFS) resumes — iframe + open/download PDF.
 * Some gateways block iframes; "Open in new tab" always works.
 */
export default function ResumeFilePreviewModal({
  isOpen,
  onClose,
  title,
  ipfsUrl,
  isDark,
}: ResumeFilePreviewModalProps) {
  if (!isOpen) return null

  const btnClass = cn(
    'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
    isDark
      ? 'bg-teal-500/20 text-teal-300 hover:bg-teal-500/30'
      : 'bg-teal-600 text-white hover:bg-teal-700',
  )

  return (
    <Modal onClose={onClose} maxWidth='max-w-4xl' zIndex={10100}>
      <ModalHeader
        title={title}
        subtitle='Uploaded resume — preview and PDF'
        onClose={onClose}
      />
      <div
        className={cn(
          'flex flex-wrap gap-2 px-4 py-3 border-b',
          isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50',
        )}
      >
        <a href={ipfsUrl} target='_blank' rel='noopener noreferrer' className={btnClass}>
          <ExternalLink className='w-4 h-4' />
          Open PDF in new tab
        </a>
        <a href={ipfsUrl} target='_blank' rel='noopener noreferrer' download className={btnClass}>
          <Download className='w-4 h-4' />
          Download PDF
        </a>
      </div>
      <p className={cn('px-4 py-2 text-xs', isDark ? 'text-gray-500' : 'text-gray-500')}>
        If the preview below is empty, use <strong>Open PDF in new tab</strong> — some IPFS gateways
        block embedded viewers.
      </p>
      <div className={cn('h-[min(72vh,640px)] mx-2 mb-4 rounded-lg overflow-hidden border', isDark ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-white')}>
        <iframe src={ipfsUrl} className='w-full h-full border-0' title={title} />
      </div>
    </Modal>
  )
}
