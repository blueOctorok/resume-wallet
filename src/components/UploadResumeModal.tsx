'use client'

import React from 'react'
import Modal, { ModalHeader } from '@/components/ui/Modal'
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
  if (!isOpen) return null

  const handleUploadComplete = (payload: Parameters<NonNullable<UploadResumeModalProps['onUploadComplete']>>[0]) => {
    onUploadComplete?.(payload)
    onClose()
  }

  return (
    <Modal onClose={onClose} maxWidth="max-w-2xl" zIndex={60}>
      <ModalHeader title="Upload Resume" onClose={onClose} />
      <div className='p-4 sm:p-6'>
        <ResumeUploadWithVerification
          user={user ?? undefined}
          onBack={onClose}
          onUploadComplete={handleUploadComplete}
        />
      </div>
    </Modal>
  )
}
