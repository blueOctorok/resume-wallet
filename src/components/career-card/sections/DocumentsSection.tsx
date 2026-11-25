'use client'

import { useEffect, useRef, useState } from 'react'
import { Files, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import Button from '@/components/ui/Button'
import ResumePaperCard, {
  PaperKicker,
  paperPrimaryButtonClass,
  paperSecondaryButtonClass,
} from '@/components/hub/ResumePaperCard'
import {
  isCareerCardOwnerMode,
  type CareerCardMode,
  type DriverDocumentCardFile,
  type DriverDocumentsCardData,
} from '@/types/career-card'

interface DocumentsSectionProps {
  data: DriverDocumentsCardData
  mode: CareerCardMode
  isDark: boolean
  /** Candidate id. Employer mode needs it to open a file. */
  userId?: string
  /**
   * Resume paper, for the hub card next to Career path. The career card and
   * the documents page keep the plain box.
   */
  paper?: boolean
}

const ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp'

/**
 * Upload area on the career card.
 * The driver adds PDFs or photos here. An employer only sees them after a
 * relationship exists (application, used invite, or accepted request).
 * A public share link never includes this section.
 */
export default function DocumentsSection({ data, mode, isDark, userId, paper = false }: DocumentsSectionProps) {
  const owner = isCareerCardOwnerMode(mode)
  const [files, setFiles] = useState<DriverDocumentCardFile[]>(data.files)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // Bumped when the driver uploads, so a refresh that started earlier cannot
  // replace the list with the copy from before the upload.
  const listVersion = useRef(0)
  const seed = data.files.map((file) => file.id).join(',')

  useEffect(() => {
    setFiles(data.files)
    // `seed` is the id list. Reading `data.files` here keeps a parent re-render
    // with the same ids from wiping a file that was just uploaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed])

  useEffect(() => {
    if (!owner) return
    const version = listVersion.current
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/driver/documents')
        const body = (await res.json()) as { documents?: DriverDocumentCardFile[]; error?: string }
        if (!res.ok || cancelled || version !== listVersion.current) return
        setFiles(
          (body.documents ?? []).map((file) => ({
            id: file.id,
            filename: file.filename,
            uploadedAt: file.uploadedAt,
          })),
        )
      } catch {
        // The card payload is enough if this refresh fails.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [owner])

  const openFile = async (id: string) => {
    const path = owner
      ? `/api/driver/documents?id=${encodeURIComponent(id)}`
      : userId
        ? `/api/employer/drivers/${userId}/documents?id=${encodeURIComponent(id)}`
        : null
    if (!path) return
    setError(null)
    const res = await fetch(path)
    const body = (await res.json()) as { url?: string; error?: string }
    if (!res.ok || typeof body.url !== 'string') {
      setError(body.error ?? 'Could not open that file')
      return
    }
    window.open(body.url, '_blank', 'noopener,noreferrer')
  }

  const upload = async (list: FileList | null) => {
    const picked = list ? Array.from(list) : []
    if (picked.length === 0) return
    listVersion.current += 1
    setSaving(true)
    setError(null)
    try {
      for (const file of picked) {
        const form = new FormData()
        form.set('file', file)
        const res = await fetch('/api/driver/documents', { method: 'POST', body: form })
        const body = (await res.json()) as { document?: DriverDocumentCardFile; error?: string }
        if (!res.ok || !body.document) {
          setError(body.error ?? 'Could not save that document')
          break
        }
        const saved = body.document
        setFiles((current) => [
          { id: saved.id, filename: saved.filename, uploadedAt: saved.uploadedAt },
          ...current.filter((row) => row.id !== saved.id),
        ])
      }
    } catch {
      setError('Could not save that document')
    } finally {
      setSaving(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const remove = async (id: string) => {
    listVersion.current += 1
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/driver/documents?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      const body = (await res.json()) as { error?: string }
      if (!res.ok) {
        setError(body.error ?? 'Could not delete that document')
        setSaving(false)
        return
      }
      setFiles((current) => current.filter((file) => file.id !== id))
      setSaving(false)
    } catch {
      setError('Could not delete that document')
      setSaving(false)
    }
  }

  const blurb = owner
    ? 'PDF or a photo. An employer you apply to, or who invited you, can open these. They are not verified.'
    : 'Files this driver uploaded. They are not verified.'

  const fileInput = owner ? (
    <input
      ref={inputRef}
      type='file'
      accept={ACCEPT}
      multiple
      className='hidden'
      onChange={(event) => void upload(event.target.files)}
    />
  ) : null

  const uploadButton = owner ? (
    <Button
      type='button'
      size='sm'
      isLoading={saving}
      onClick={() => inputRef.current?.click()}
      className={paper ? paperPrimaryButtonClass : undefined}
    >
      Upload
    </Button>
  ) : null

  const errorLine = error ? (
    <p className='mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200'>
      {error}
    </p>
  ) : null

  const fileList =
    files.length === 0 ? (
      <div
        className={cn(
          'mt-4 rounded-xl border-2 border-dashed px-4 py-6 text-center',
          paper ? 'border-[#173150]/20' : isDark ? 'border-teal-400/25' : 'border-teal-300/60',
        )}
      >
        {saving ? (
          <Loader2 className='mx-auto h-5 w-5 animate-spin text-gray-400' />
        ) : (
          <p className={cn('text-sm', paper ? 'text-stone-500' : isDark ? 'text-gray-300' : 'text-gray-600')}>
            {owner ? 'No documents yet' : 'No documents shared'}
          </p>
        )}
      </div>
    ) : (
      <ul className={cn('mt-3 divide-y', paper ? 'divide-stone-300/80' : isDark ? 'divide-gray-700' : 'divide-gray-200')}>
        {files.map((file) => (
          <li key={file.id} className='flex items-center justify-between gap-2 py-2.5'>
            <div className='min-w-0'>
              <p className={cn('truncate text-sm font-medium', paper || !isDark ? 'text-[#173150]' : 'text-gray-100')}>
                {file.filename}
              </p>
              <p className='text-[11px] text-stone-500'>{new Date(file.uploadedAt).toLocaleDateString()}</p>
            </div>
            <div className='flex shrink-0 gap-2'>
              <Button
                type='button'
                variant='secondary'
                size='sm'
                onClick={() => void openFile(file.id)}
                className={paper ? paperSecondaryButtonClass : undefined}
              >
                View
              </Button>
              {owner && (
                <Button type='button' variant='danger' size='sm' disabled={saving} onClick={() => void remove(file.id)}>
                  Delete
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    )

  if (paper) {
    return (
      <ResumePaperCard>
        <PaperKicker>Documents</PaperKicker>
        <p className='text-center text-xs leading-relaxed text-stone-500'>{blurb}</p>
        {fileInput}
        {owner ? <div className='mt-4 flex justify-center'>{uploadButton}</div> : null}
        {errorLine}
        {fileList}
      </ResumePaperCard>
    )
  }

  return (
    <div className={cn('rounded-xl p-3.5 sm:p-4', isDark ? 'bg-gray-800/40' : 'bg-slate-50/80')}>
      <div className='flex items-start justify-between gap-3'>
        <div className='flex min-w-0 items-start gap-3'>
          <Files className={cn('mt-0.5 h-5 w-5 shrink-0', isDark ? 'text-teal-300' : 'text-teal-700')} />
          <div>
            <p className={cn('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>Documents</p>
            <p className={cn('mt-0.5 text-xs', isDark ? 'text-gray-400' : 'text-gray-500')}>{blurb}</p>
          </div>
        </div>
        {fileInput}
        {uploadButton}
      </div>
      {errorLine}
      {fileList}
    </div>
  )
}
