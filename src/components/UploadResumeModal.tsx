'use client'

import React, { useEffect } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { X } from 'lucide-react'
import ResumeUploadWithVerification from './ResumeUploadWithVerification'

interface UploadResumeModalProps {
  isOpen: boolean
  onClose: () => void
  /** User object with at least { address: string } for the upload flow */
  user: { address: string } | null
  onUploadComplete?: (payload: {
    resume: unknown
    finalResult: {
      ipfsHash: string
      ipfsUrl: string
      databaseId: string
      wasPaid: boolean
      costUSDC: number
      eligibility: unknown
      blockchainData: unknown
    }
  }) => void
}

export default function UploadResumeModal({
  isOpen,
  onClose,
  user,
  onUploadComplete,
}: UploadResumeModalProps) {
  const { theme } = useTheme()

  // Lock body scroll when modal is open so background doesn't scroll and nav stays under the modal
  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleUploadComplete = (payload: Parameters<NonNullable<UploadResumeModalProps['onUploadComplete']>>[0]) => {
    onUploadComplete?.(payload)
    onClose()
  }

  return (
    <div className='fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto p-4'>
      {/* Backdrop - above nav (z-50) so scrolling doesn't put nav on top */}
      <div
        className='fixed inset-0 bg-black/50 backdrop-blur-sm'
        aria-hidden
        onClick={onClose}
      />
      {/* Modal */}
      <div
        className={`relative z-10 w-full max-w-2xl rounded-2xl border shadow-2xl ${
          theme === 'dark'
            ? 'bg-gray-900 border-gray-700'
            : 'bg-white border-gray-200'
        }`}
        role='dialog'
        aria-modal='true'
        aria-labelledby='upload-resume-modal-title'
      >
        <div className='sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3 sm:px-6 border-inherit bg-inherit rounded-t-2xl'>
          <h2
            id='upload-resume-modal-title'
            className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
          >
            Upload Resume
          </h2>
          <button
            type='button'
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              theme === 'dark'
                ? 'hover:bg-gray-700 text-gray-400 hover:text-white'
                : 'hover:bg-gray-100 text-gray-500 hover:text-gray-900'
            }`}
            aria-label='Close'
          >
            <X className='w-5 h-5' />
          </button>
        </div>
        <div className='max-h-[calc(100vh-8rem)] overflow-y-auto p-4 sm:p-6'>
          <ResumeUploadWithVerification
            user={user ?? undefined}
            onBack={onClose}
            onUploadComplete={handleUploadComplete}
          />
        </div>
      </div>
    </div>
  )
}
