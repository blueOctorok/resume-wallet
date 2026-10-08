'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Upload, CheckCircle, AlertCircle, Loader2, Sparkles } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { useAssistantBridge } from '@/contexts/AssistantBridgeContext'
import Button from '@/components/ui/Button'

interface ResumeUploadWithPrefillProps {
  onPrefillSuccess?: (formData: {
    form1Data?: unknown
    form2Data?: unknown
    form3Data?: unknown
    stats?: unknown
  }) => void
}

const MAX_BYTES = 5 * 1024 * 1024

/**
 * Read a resume to fill the DOT application. The file is not uploaded to storage
 * and no resumes row is created — the request body is the only place it exists.
 */
export default function ResumeUploadWithPrefill({
  onPrefillSuccess,
}: ResumeUploadWithPrefillProps) {
  const { theme } = useTheme()
  const { notifyResumeUploadEvent } = useAssistantBridge()
  const [file, setFile] = useState<File | null>(null)
  const [isReading, setIsReading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const dark = isDarkTheme(theme)

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return

    const name = selected.name.toLowerCase()
    const isPdf = selected.type === 'application/pdf' || name.endsWith('.pdf')
    const isText = selected.type.startsWith('text/') || name.endsWith('.txt')
    if (!isPdf && !isText) {
      setErrorMessage('Use a PDF or a .txt file. We read it once and do not keep it.')
      setFile(null)
      return
    }
    if (selected.size > MAX_BYTES) {
      setErrorMessage('File must be under 5MB.')
      setFile(null)
      return
    }

    setFile(selected)
    setErrorMessage('')
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!file) {
      setErrorMessage('Choose a file first.')
      return
    }

    setIsReading(true)
    setErrorMessage('')

    try {
      const body = new FormData()
      body.append('file', file)

      const res = await fetch('/api/driver/prefill-from-resume', {
        method: 'POST',
        credentials: 'include',
        body,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(
          typeof data.message === 'string'
            ? data.message
            : typeof data.error === 'string'
              ? data.error
              : 'Could not read that resume.',
        )
      }

      notifyResumeUploadEvent?.({
        type: 'analysis_ready',
        step: 'prefill',
        message: 'Filled your DOT application from the resume. The file was not saved.',
      })

      onPrefillSuccess?.({
        form1Data: data.form1Data,
        form2Data: data.form2Data,
        form3Data: data.form3Data,
        stats: data.stats,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not read that resume.'
      setErrorMessage(message)
    } finally {
      setIsReading(false)
    }
  }

  return (
    <div
      className={`mx-auto w-full max-w-2xl rounded-lg border-2 p-6 shadow-lg ${
        dark
          ? 'border-teal-500 bg-teal-200/20 backdrop-blur-xl'
          : 'border-teal-700/20 bg-white/80 backdrop-blur-xl'
      }`}
    >
      <div className='mb-6'>
        <div className='mb-2 flex items-center gap-3'>
          <Sparkles className={dark ? 'h-6 w-6 text-teal-400' : 'h-6 w-6 text-teal-800'} />
          <h2 className={`text-2xl font-semibold ${dark ? 'text-white' : 'text-teal-800'}`}>
            Fill from a resume
          </h2>
        </div>
        <p className={`text-sm ${dark ? 'text-gray-300' : 'text-gray-600'}`}>
          We read the file to fill your DOT application, then throw it away. Nothing is saved
          from the upload. Your Provven resume is built from this application and your MVR.
        </p>
      </div>

      <form onSubmit={handleSubmit} className='space-y-6'>
        <div className='space-y-4'>
          <label
            className={`block text-sm font-medium ${dark ? 'text-gray-300' : 'text-gray-700'}`}
            htmlFor='resume-file-prefill'
          >
            Resume file
          </label>
          <input
            type='file'
            accept='.pdf,.txt,application/pdf,text/plain'
            onChange={handleFileChange}
            className='hidden'
            id='resume-file-prefill'
            disabled={isReading}
          />
          <label
            htmlFor='resume-file-prefill'
            className={`flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors ${
              file
                ? dark
                  ? 'border-teal-500 bg-teal-600/10'
                  : 'border-green-400 bg-green-50'
                : dark
                  ? 'border-gray-600 bg-gray-800/50 hover:border-teal-500/50'
                  : 'border-gray-300 bg-gray-50 hover:border-gray-400'
            } ${isReading ? 'cursor-not-allowed opacity-50' : ''}`}
          >
            {file ? (
              <div className={`flex flex-col items-center ${dark ? 'text-teal-400' : 'text-green-700'}`}>
                <CheckCircle className='mb-2 h-8 w-8' />
                <span className='font-medium'>{file.name}</span>
                <span className={`text-sm ${dark ? 'text-gray-400' : 'text-green-600'}`}>
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </span>
              </div>
            ) : (
              <div className={`flex flex-col items-center ${dark ? 'text-teal-400' : 'text-teal-800'}`}>
                <Upload className='mb-2 h-8 w-8' />
                <span className='font-medium'>Choose a PDF or text file</span>
                <span className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Max 5MB. Not stored.
                </span>
              </div>
            )}
          </label>
        </div>

        {isReading && (
          <div
            className={`flex items-center rounded-md border p-3 ${
              dark ? 'border-blue-500/50 bg-blue-900/20' : 'border-blue-200 bg-blue-50'
            }`}
          >
            <Loader2 className='h-5 w-5 animate-spin text-blue-500' />
            <span className={`ml-2 text-sm font-medium ${dark ? 'text-blue-300' : 'text-blue-700'}`}>
              Reading your resume. This can take half a minute. The file is not saved.
            </span>
          </div>
        )}

        {errorMessage && (
          <div
            className={`flex items-center rounded-md border p-3 ${
              dark ? 'border-red-500/50 bg-red-900/20' : 'border-red-200 bg-red-50'
            }`}
          >
            <AlertCircle className={`mr-2 h-5 w-5 ${dark ? 'text-red-400' : 'text-red-500'}`} />
            <span className={`text-sm ${dark ? 'text-red-300' : 'text-red-700'}`}>{errorMessage}</span>
          </div>
        )}

        <Button type='submit' disabled={!file || isReading} isLoading={isReading} className='w-full'>
          <Sparkles className='h-4 w-4' />
          Read resume and fill application
        </Button>
      </form>
    </div>
  )
}
