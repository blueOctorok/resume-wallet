'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { FileText, Loader2 } from 'lucide-react'
import Button from '@/components/ui/Button'

type FileKind = 'dot_application' | 'application' | 'other'

interface EmployerFile {
  id: string
  kind: FileKind
  filename: string
  note: string | null
  createdAt: string
}

const KIND_LABEL: Record<FileKind, string> = {
  dot_application: 'DOT application',
  application: 'Application',
  other: 'Other',
}

/**
 * Company-private files on one driver. The driver never sees this list.
 */
export default function EmployerDriverFiles({ candidateUserId }: { candidateUserId: string }) {
  const [files, setFiles] = useState<EmployerFile[]>([])
  const [canManage, setCanManage] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [kind, setKind] = useState<FileKind>('dot_application')
  const [note, setNote] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/employer/drivers/${candidateUserId}/files`)
      const body = await res.json()
      if (!res.ok) {
        setError(body.error ?? 'Could not load files')
        setLoading(false)
        return
      }
      setFiles(body.files ?? [])
      setCanManage(body.canManage === true)
      setLoading(false)
    } catch {
      setError('Could not load files')
      setLoading(false)
    }
  }, [candidateUserId])

  useEffect(() => {
    void load()
  }, [load])

  const upload = async (file: File | undefined) => {
    if (!file) return
    setSaving(true)
    setError(null)
    try {
      const form = new FormData()
      form.set('file', file)
      form.set('kind', kind)
      form.set('note', note)
      const res = await fetch(`/api/employer/drivers/${candidateUserId}/files`, {
        method: 'POST',
        body: form,
      })
      const body = await res.json()
      if (!res.ok) {
        setError(body.error ?? 'Could not save that file')
        setSaving(false)
        return
      }
      setFiles((current) => [body.file, ...current])
      setNote('')
      setSaving(false)
    } catch {
      setError('Could not save that file')
      setSaving(false)
    } finally {
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const openFile = async (id: string) => {
    const res = await fetch(`/api/employer/drivers/${candidateUserId}/files?id=${encodeURIComponent(id)}`)
    const body = await res.json()
    if (!res.ok || typeof body.url !== 'string') {
      setError(body.error ?? 'Could not open that file')
      return
    }
    window.open(body.url, '_blank', 'noopener,noreferrer')
  }

  const remove = async (id: string) => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/employer/drivers/${candidateUserId}/files?id=${encodeURIComponent(id)}`,
        { method: 'DELETE' },
      )
      const body = await res.json()
      if (!res.ok) {
        setError(body.error ?? 'Could not delete that file')
        setSaving(false)
        return
      }
      setFiles((current) => current.filter((file) => file.id !== id))
      setSaving(false)
    } catch {
      setError('Could not delete that file')
      setSaving(false)
    }
  }

  return (
    <section>
      <p className='mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ironside'>
        <FileText className='h-3 w-3' /> Files
      </p>
      <p className='mb-2 text-xs text-ironside'>Only your company can see these. The driver cannot.</p>

      {error && (
        <p className='mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800'>{error}</p>
      )}

      {canManage && (
        <div className='mb-3 flex flex-wrap items-end gap-2'>
          <label className='text-xs text-[#173150]'>
            Type
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value as FileKind)}
              className='mt-1 block rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-sm text-[#173150]'
            >
              <option value='dot_application'>DOT application</option>
              <option value='application'>Application</option>
              <option value='other'>Other</option>
            </select>
          </label>
          <label className='min-w-[12rem] flex-1 text-xs text-[#173150]'>
            Note
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder='Optional'
              className='mt-1 block w-full rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-sm text-[#173150]'
            />
          </label>
          <input
            ref={inputRef}
            type='file'
            accept='application/pdf,image/jpeg,image/png,image/webp'
            className='hidden'
            onChange={(event) => void upload(event.target.files?.[0])}
          />
          <Button size='sm' isLoading={saving} onClick={() => inputRef.current?.click()}>
            Upload
          </Button>
        </div>
      )}

      {loading ? (
        <div className='flex items-center gap-2 py-3 text-xs text-ironside'>
          <Loader2 className='h-3.5 w-3.5 animate-spin' />
          Loading files…
        </div>
      ) : files.length === 0 ? (
        <p className='rounded-xl border border-dashed border-stone-200 px-3 py-3 text-xs text-ironside'>
          No files uploaded for this driver.
        </p>
      ) : (
        <ul className='divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white text-xs'>
          {files.map((file) => (
            <li key={file.id} className='flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2'>
              <span className='font-medium text-[#173150]'>{file.filename}</span>
              <span className='rounded-md bg-stone-100 px-1.5 py-0.5 text-[10px] text-[#173150]'>
                {KIND_LABEL[file.kind]}
              </span>
              {file.note && <span className='text-ironside'>{file.note}</span>}
              <span className='ml-auto flex items-center gap-2'>
                <Button variant='secondary' size='sm' onClick={() => void openFile(file.id)}>
                  View
                </Button>
                {canManage && (
                  <Button variant='danger' size='sm' disabled={saving} onClick={() => void remove(file.id)}>
                    Delete
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
