'use client'

import { useCallback, useId, useState } from 'react'
import { FileText, Paperclip, X } from 'lucide-react'
import { useAssistantBridge } from '@/contexts/AssistantBridgeContext'
import BackToHubButton from './ui/BackToHubButton'
import Button from './ui/Button'
import Modal, { ModalHeader } from './ui/Modal'
import type { ParsedResumeExtraction } from '@/types/resume-extraction'
import { syncDriverHubFromApi } from '@/lib/sync-driver-hub-store'
import { useAuthStore } from '@/stores'

const MAX_BYTES = 5 * 1024 * 1024

interface ResumeUploadWithVerificationProps {
  onBack?: () => void
  /** Parent already supplies the block card. */
  embedInParent?: boolean
  onUploadComplete?: (payload: {
    resume: { id: string; documentUrl?: string | null }
    finalResult: {
      ipfsHash: string
      ipfsUrl: string
      databaseId: string
      blockchainData: null
    }
  }) => void
}

export default function ResumeUploadWithVerification({
  onBack,
  embedInParent = false,
  onUploadComplete,
}: ResumeUploadWithVerificationProps) {
  const inputId = useId()
  const { notifyResumeUploadEvent } = useAssistantBridge()
  const sessionUserId = useAuthStore((s) => s.sessionUserId)

  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [savedName, setSavedName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [parseModalOpen, setParseModalOpen] = useState(false)
  const [parseLoading, setParseLoading] = useState(false)
  const [applyLoading, setApplyLoading] = useState(false)
  const [parsedExtraction, setParsedExtraction] = useState<ParsedResumeExtraction | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [pendingResumeId, setPendingResumeId] = useState<string | null>(null)

  const runSmartImport = useCallback(
    async (resumeId: string) => {
      setParseLoading(true)
      setParseError(null)
      setParsedExtraction(null)
      try {
        const res = await fetch('/api/ai/parse-resume', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resumeId }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setParseError(
            typeof data.message === 'string'
              ? data.message
              : typeof data.error === 'string'
                ? data.error
                : 'Could not read this PDF. It is still saved.',
          )
          return
        }
        const extraction = data.extraction as ParsedResumeExtraction | undefined
        if (!extraction || typeof extraction !== 'object') {
          setParseError('Nothing readable in this PDF. It is still saved.')
          return
        }
        setParsedExtraction(extraction)
        setParseModalOpen(true)
        notifyResumeUploadEvent?.({
          type: 'analysis_ready',
          step: 'analysis',
          data: { resumeId },
          message: 'Review what we read from the PDF before it fills empty fields.',
        })
      } catch {
        setParseError('Could not read this PDF. It is still saved.')
      } finally {
        setParseLoading(false)
      }
    },
    [notifyResumeUploadEvent],
  )

  const applyExtraction = useCallback(async () => {
    if (!parsedExtraction || !pendingResumeId || !sessionUserId) return
    setApplyLoading(true)
    setParseError(null)
    try {
      const res = await fetch(`/api/resumes/${pendingResumeId}/apply-extraction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extraction: parsedExtraction }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setParseError(typeof data.error === 'string' ? data.error : 'Could not apply those fields.')
        return
      }
      void syncDriverHubFromApi(sessionUserId)
      setParseModalOpen(false)
    } catch {
      setParseError('Could not apply those fields.')
    } finally {
      setApplyLoading(false)
    }
  }, [parsedExtraction, pendingResumeId, sessionUserId])

  const onPickFile = (picked: File | undefined) => {
    setError(null)
    setSavedName(null)
    if (!picked) return
    if (picked.type !== 'application/pdf') {
      setError('Choose a PDF.')
      return
    }
    if (picked.size > MAX_BYTES) {
      setError('That file is over 5 MB.')
      return
    }
    setFile(picked)
  }

  const uploadResume = async () => {
    if (!file || !sessionUserId) return
    setUploading(true)
    setError(null)
    notifyResumeUploadEvent?.({
      type: 'upload_start',
      step: 'upload',
      message: 'Uploading your resume.',
    })
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('title', file.name.replace(/\.pdf$/i, ''))

      const uploadResponse = await fetch('/api/resumes/upload', {
        method: 'POST',
        body: formData,
      })
      const uploadData = await uploadResponse.json().catch(() => ({}))
      if (!uploadResponse.ok) {
        const errorMessage =
          typeof uploadData.message === 'string'
            ? uploadData.message
            : typeof uploadData.error === 'string'
              ? uploadData.error
              : 'Upload failed.'
        setError(errorMessage)
        notifyResumeUploadEvent?.({
          type: 'upload_error',
          step: 'upload',
          error: errorMessage,
          message: errorMessage,
        })
        return
      }

      const resumeId = uploadData.resume?.id as string | undefined
      const documentUrl = (uploadData.resume?.documentUrl ?? null) as string | null
      if (!resumeId) {
        setError('Upload failed.')
        return
      }

      setSavedName(file.name)
      setFile(null)
      setPendingResumeId(resumeId)
        onUploadComplete?.({
          resume: { id: resumeId, documentUrl },
          // ipfsHash is a leftover field name on the callback. Callers only
          // check that it is set. The value is the resume id, not a chain hash.
          finalResult: {
          ipfsHash: resumeId,
          ipfsUrl: documentUrl ?? '',
          databaseId: resumeId,
          blockchainData: null,
        },
      })
      notifyResumeUploadEvent?.({
        type: 'upload_complete',
        step: 'upload',
        data: { resumeId },
        message: 'Resume uploaded.',
      })
      void runSmartImport(resumeId)
    } catch {
      setError('Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  if (!sessionUserId) {
    return (
      <p className='text-sm text-[#173150]'>Sign in to upload a resume.</p>
    )
  }

  return (
    <>
      {onBack && !embedInParent && (
        <BackToHubButton onClick={onBack} className='mb-4' />
      )}
      <div className={embedInParent ? '' : 'mx-auto max-w-xl rounded-xl bg-[#f3f4f5] p-5'}>
        <label htmlFor={inputId} className='mb-2 block text-sm font-medium text-[#173150]'>
          PDF resume
        </label>
        <input
          id={inputId}
          type='file'
          accept='application/pdf,.pdf'
          className='sr-only'
          disabled={uploading}
          onChange={(e) => {
            onPickFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />

        {!file ? (
          <label
            htmlFor={inputId}
            className='flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#173150]/25 bg-white px-6 py-5 text-[#173150] transition hover:border-[#f15a2b]'
          >
            <Paperclip className='h-5 w-5 text-[#f15a2b]' aria-hidden />
            <span className='font-medium'>Choose a PDF</span>
          </label>
        ) : (
          <div className='flex items-center gap-3 rounded-xl border border-[#173150]/15 bg-white px-4 py-3'>
            <FileText className='h-5 w-5 shrink-0 text-[#f15a2b]' aria-hidden />
            <div className='min-w-0 flex-1'>
              <p className='truncate text-sm font-medium text-[#173150]'>{file.name}</p>
              <p className='text-xs text-[#939598]'>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
            {!uploading && (
              <button
                type='button'
                aria-label='Remove file'
                className='rounded-lg p-2 text-[#173150] hover:bg-[#f3f4f5]'
                onClick={() => setFile(null)}
              >
                <X className='h-4 w-4' />
              </button>
            )}
          </div>
        )}

        <Button
          type='button'
          variant='primary'
          className='mt-4 w-full'
          onClick={() => void uploadResume()}
          disabled={!file || uploading}
          isLoading={uploading}
        >
          Upload resume
        </Button>

        {parseLoading && (
          <p className='mt-3 text-sm text-[#173150]'>Reading the PDF for empty fields…</p>
        )}
        {savedName && !parseLoading && !error && (
          <p className='mt-3 text-sm text-[#173150]'>Saved {savedName}.</p>
        )}
        {(error || (parseError && !parseModalOpen)) && (
          <p className='mt-3 text-sm text-[#9b2c2c]'>{error || parseError}</p>
        )}
      </div>

      {parseModalOpen ? (
        <Modal onClose={() => setParseModalOpen(false)} maxWidth='max-w-lg' zIndex={1100} panelShape='block'>
          <ModalHeader
            variant='block'
            title='Fill empty fields'
            subtitle='These came from the PDF. Confirm to fill blanks on your file. Nothing already saved is overwritten.'
            onClose={() => setParseModalOpen(false)}
          />
          <div className='space-y-4 bg-[#f3f4f5] p-4'>
            {parsedExtraction ? (
              <ul className='list-disc space-y-1.5 pl-5 text-sm text-[#173150]'>
                {parsedExtraction.personalInfo?.firstName || parsedExtraction.personalInfo?.lastName ? (
                  <li>
                    Name:{' '}
                    {[parsedExtraction.personalInfo?.firstName, parsedExtraction.personalInfo?.lastName]
                      .filter(Boolean)
                      .join(' ')}
                  </li>
                ) : null}
                {parsedExtraction.cdlInfo?.cdlClass || parsedExtraction.cdlInfo?.cdlState ? (
                  <li>
                    CDL: {parsedExtraction.cdlInfo?.cdlClass ?? '—'} / {parsedExtraction.cdlInfo?.cdlState ?? '—'}
                  </li>
                ) : null}
                <li>Jobs found: {parsedExtraction.employments?.length ?? 0}</li>
                <li>Education: {parsedExtraction.educations?.length ?? 0}</li>
                <li>Skills: {parsedExtraction.skills?.length ?? 0}</li>
              </ul>
            ) : null}
            {parseError ? <p className='text-sm text-[#9b2c2c]'>{parseError}</p> : null}
            <div className='flex flex-wrap gap-2'>
              <Button
                type='button'
                variant='primary'
                onClick={() => void applyExtraction()}
                disabled={!parsedExtraction}
                isLoading={applyLoading}
              >
                Fill empty fields
              </Button>
              <Button type='button' variant='secondary' onClick={() => setParseModalOpen(false)}>
                Not now
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  )
}
