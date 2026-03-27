'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, Download, Loader2 } from 'lucide-react'
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
 * In-app preview for uploaded (IPFS) resumes.
 * Pinata and many gateways send X-Frame-Options: sameorigin — embedding the gateway
 * URL in an iframe fails. We fetch the PDF as a blob and iframe the blob: URL instead.
 */
export default function ResumeFilePreviewModal({
  isOpen,
  onClose,
  title,
  ipfsUrl,
  isDark,
}: ResumeFilePreviewModalProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'error'>('idle')

  useEffect(() => {
    if (!isOpen || !ipfsUrl) {
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      setLoadState('idle')
      return
    }

    let cancelled = false
    setLoadState('loading')
    setBlobUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })

    ;(async () => {
      try {
        const res = await fetch(ipfsUrl, { mode: 'cors' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const blob = await res.blob()
        if (cancelled) return
        const url = URL.createObjectURL(blob)
        setBlobUrl(url)
        setLoadState('idle')
      } catch {
        if (!cancelled) setLoadState('error')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isOpen, ipfsUrl])

  useEffect(() => {
    return () => {
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
    }
  }, [])

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
        Preview loads via a local copy so gateways that block iframes (e.g. Pinata) still work. If
        preview fails (CORS), use <strong>Open PDF in new tab</strong>.
      </p>
      <div
        className={cn(
          'h-[min(72vh,640px)] mx-2 mb-4 rounded-lg overflow-hidden border flex flex-col items-center justify-center',
          isDark ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-white',
        )}
      >
        {loadState === 'loading' && (
          <Loader2 className={cn('w-10 h-10 animate-spin', isDark ? 'text-teal-400' : 'text-teal-600')} />
        )}
        {loadState === 'error' && (
          <p className={cn('px-4 text-sm text-center', isDark ? 'text-gray-400' : 'text-gray-600')}>
            Could not load preview in-app (network or CORS). Use <strong>Open PDF in new tab</strong> above.
          </p>
        )}
        {blobUrl && loadState !== 'loading' && (
          <iframe src={blobUrl} className='w-full h-full min-h-[400px] border-0' title={title} />
        )}
      </div>
    </Modal>
  )
}
