'use client'

import { useState } from 'react'
import { FileText, CheckCircle, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import ResumePreviewModal from '@/components/ResumePreviewModal'
import ResumeFilePreviewModal from '@/components/hub/ResumeFilePreviewModal'
import { downloadDriverResumePdfFromStructured } from '@/lib/driver-resume-pdf-download'
import type { ResumeData } from '@/types/career-card'
import type { CareerCardMode } from '@/types/career-card'

interface ResumeSectionProps {
  data: ResumeData
  mode: CareerCardMode
  isDark: boolean
  onAction?: () => void
}

export default function ResumeSection({ data, mode, isDark }: ResumeSectionProps) {
  const isVerified = data.verificationStatus === 'verified'
  const [showPreview, setShowPreview] = useState(false)
  const [showIpfsPreview, setShowIpfsPreview] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)

  // Resumes uploaded to IPFS have a real hash; built resumes use a 'built_' prefix sentinel.
  const isIpfsResume = data.ipfsHash && !data.ipfsHash.startsWith('built_')
  const isBuiltResume = !!data.structuredData

  return (
    <>
      <div
        className={cn(
          'relative overflow-hidden rounded-xl border p-4',
          isDark
            ? 'border-gray-600/55 bg-gray-800/45 ring-1 ring-white/[0.04]'
            : 'border-gray-200/90 bg-white/85 ring-1 ring-gray-900/[0.04]',
          'shadow-sm',
        )}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-400/30 to-transparent dark:via-teal-400/20"
        />
        <div className='flex items-center justify-between mb-3'>
          <div className='flex items-center gap-2'>
            <FileText className={cn('w-4 h-4', isDark ? 'text-teal-400' : 'text-teal-600')} />
            <h3 className={cn('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
              Resume
            </h3>
            {isVerified && (
              <span className='flex items-center gap-1 text-xs text-green-500'>
                <CheckCircle className='w-3 h-3' /> Verified
              </span>
            )}
          </div>

          {/* Preview action — IPFS resumes open in a new tab; built resumes open the inline modal */}
          {isIpfsResume ? (
            <button
              type='button'
              onClick={() => setShowIpfsPreview(true)}
              className={cn(
                'flex items-center gap-1 text-xs px-3 py-1 rounded-lg transition-colors',
                isDark ? 'bg-teal-500/20 text-teal-400 hover:bg-teal-500/30' : 'bg-teal-50 text-teal-600 hover:bg-teal-100'
              )}
            >
              <Eye className='w-3 h-3' /> Preview
            </button>
          ) : isBuiltResume ? (
            <button
              onClick={() => setShowPreview(true)}
              className={cn(
                'flex items-center gap-1 text-xs px-3 py-1 rounded-lg transition-colors',
                isDark ? 'bg-teal-500/20 text-teal-400 hover:bg-teal-500/30' : 'bg-teal-50 text-teal-600 hover:bg-teal-100'
              )}
            >
              <Eye className='w-3 h-3' /> Preview
            </button>
          ) : null}
        </div>

        <div className='flex items-center gap-3'>
          <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', isDark ? 'bg-gray-700' : 'bg-gray-200/60')}>
            <FileText className={cn('w-5 h-5', isDark ? 'text-gray-400' : 'text-gray-500')} />
          </div>
          <div className='flex-1 min-w-0'>
            <p className={cn('text-sm font-medium truncate', isDark ? 'text-gray-200' : 'text-gray-800')}>
              {data.title || data.filename}
            </p>
            <p className={cn('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>
              {isVerified ? 'Blockchain verified' : 'Uploaded'}{' '}
              {new Date(data.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      {showIpfsPreview && data.ipfsHash && (
        <ResumeFilePreviewModal
          isOpen={showIpfsPreview}
          onClose={() => setShowIpfsPreview(false)}
          title={data.title || data.filename || 'Resume'}
          ipfsUrl={`https://gateway.pinata.cloud/ipfs/${data.ipfsHash}`}
          isDark={isDark}
        />
      )}

      {showPreview && isBuiltResume && (
        <ResumePreviewModal
          title={data.title || 'Resume'}
          structuredData={data.structuredData as Parameters<typeof ResumePreviewModal>[0]['structuredData']}
          onClose={() => setShowPreview(false)}
          onDownload={async () => {
            if (!data.structuredData) return
            setPdfLoading(true)
            try {
              await downloadDriverResumePdfFromStructured(
                data.structuredData as Record<string, unknown>,
                data.title || 'Resume',
              )
            } finally {
              setPdfLoading(false)
            }
          }}
          isDownloading={pdfLoading}
          theme={isDark ? 'dark' : 'light'}
          zIndex={10100}
        />
      )}
    </>
  )
}
