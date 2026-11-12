'use client'

import { useEffect, useRef } from 'react'
import { Files, Loader2 } from 'lucide-react'
import BackToHubButton from '@/components/ui/BackToHubButton'
import BlockCard from '@/components/ui/BlockCard'
import Button from '@/components/ui/Button'
import HubSectionPanel from '@/components/hub/HubSectionPanel'
import { useTheme } from '@/contexts/ThemeContext'
import { getBlockDefinition } from '@/lib/block-registry'
import { syncDriverHubFromApi } from '@/lib/sync-driver-hub-store'
import { useAuthStore } from '@/stores'
import { useDocumentsBlockStore } from '@/stores/documents-block-store'

const def = getBlockDefinition('driver-documents')

/**
 * Papers the driver keeps on file. A line only reaches the resume after they
 * accept it. The line is read from the file, not checked with an issuer.
 */
export default function DocumentsBlock({ onBack }: { onBack: () => void }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const sessionUserId = useAuthStore((s) => s.sessionUserId)
  const documents = useDocumentsBlockStore((s) => s.documents)
  const isLoading = useDocumentsBlockStore((s) => s.isLoading)
  const isSaving = useDocumentsBlockStore((s) => s.isSaving)
  const error = useDocumentsBlockStore((s) => s.error)
  const load = useDocumentsBlockStore((s) => s.load)
  const upload = useDocumentsBlockStore((s) => s.upload)
  const setAccepted = useDocumentsBlockStore((s) => s.setAccepted)
  const remove = useDocumentsBlockStore((s) => s.remove)
  const openFile = useDocumentsBlockStore((s) => s.openFile)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void load()
  }, [load])

  const refreshHub = () => {
    if (sessionUserId) void syncDriverHubFromApi(sessionUserId)
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    const ok = await upload(file)
    if (ok) refreshHub()
    if (inputRef.current) inputRef.current.value = ''
  }

  const status = documents.some((doc) => doc.accepted)
    ? 'complete'
    : documents.length > 0
      ? 'in-progress'
      : 'empty'

  return (
    <div className='mx-auto max-w-2xl'>
      <BackToHubButton onClick={onBack} />
      <HubSectionPanel isDark={isDark} accent='teal'>
        <BlockCard
          variant='embed'
          icon={Files}
          title={def?.label ?? 'Documents'}
          description={def?.description ?? 'Insurance, authority, registration, and other papers.'}
          status={status}
          headerActions={
            <>
              <input
                ref={inputRef}
                type='file'
                accept='application/pdf,image/jpeg,image/png,image/webp'
                className='hidden'
                onChange={(event) => void onFile(event.target.files?.[0])}
              />
              <Button
                size='sm'
                isLoading={isSaving}
                onClick={() => inputRef.current?.click()}
              >
                Upload
              </Button>
            </>
          }
        >
          <p className='mb-4 text-xs text-gray-600 dark:text-gray-400'>
            We read insurance, operating authority, and registration. You choose which lines go on your resume. These are not verified claims.
          </p>

          {error && (
            <p className='mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200'>
              {error}
            </p>
          )}

          {isLoading && documents.length === 0 ? (
            <div className='flex items-center justify-center gap-2 py-8 text-gray-500 dark:text-gray-400'>
              <Loader2 className='h-4 w-4 animate-spin' />
              <span className='text-sm'>Loading documents…</span>
            </div>
          ) : documents.length === 0 ? (
            <div className='py-8 text-center'>
              <Files className='mx-auto mb-2 h-8 w-8 text-gray-400' />
              <p className='text-sm text-gray-500 dark:text-gray-400'>No documents yet</p>
            </div>
          ) : (
            <ul className='divide-y divide-gray-200 dark:divide-gray-700'>
              {documents.map((doc) => (
                <li key={doc.id} className='flex flex-col gap-2 py-3'>
                  <div className='flex flex-wrap items-start justify-between gap-2'>
                    <div className='min-w-0'>
                      <p className='truncate text-sm font-medium text-gray-900 dark:text-gray-100'>{doc.filename}</p>
                      {doc.proposedLine ? (
                        <p className='mt-1 text-sm text-gray-800 dark:text-gray-200'>{doc.proposedLine}</p>
                      ) : (
                        <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
                          {doc.unreadReason ?? 'Nothing on this page belongs on the resume.'}
                        </p>
                      )}
                    </div>
                    <div className='flex shrink-0 gap-2'>
                      <Button variant='secondary' size='sm' onClick={() => void openFile(doc.id)}>
                        View
                      </Button>
                      {doc.proposedLine && (
                        <Button
                          variant={doc.accepted ? 'secondary' : 'primary'}
                          size='sm'
                          disabled={isSaving}
                          onClick={() => {
                            void setAccepted(doc.id, !doc.accepted).then((ok) => {
                              if (ok) refreshHub()
                            })
                          }}
                        >
                          {doc.accepted ? 'Remove from resume' : 'Add to resume'}
                        </Button>
                      )}
                      <Button
                        variant='danger'
                        size='sm'
                        disabled={isSaving}
                        onClick={() => {
                          void remove(doc.id).then((ok) => {
                            if (ok) refreshHub()
                          })
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </BlockCard>
      </HubSectionPanel>
    </div>
  )
}
