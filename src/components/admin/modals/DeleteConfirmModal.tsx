'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import React, { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import type { DeleteTarget } from '@/components/admin/admin-types'

interface DeleteConfirmModalProps {
  theme: 'light' | 'dark'
  target: DeleteTarget | null
  onClose: () => void
  onConfirm: () => void
  deleting: boolean
  error?: string | null
}

export default function DeleteConfirmModal({
  theme,
  target,
  onClose,
  onConfirm,
  deleting,
  error,
}: DeleteConfirmModalProps) {
  const [confirmed, setConfirmed] = useState(false)

  // The modal stays mounted between deletes, so a checked box from the last
  // target must not carry over to the next one.
  useEffect(() => {
    setConfirmed(false)
  }, [target?.type, target?.id])

  if (!target) return null

  const handleClose = () => {
    setConfirmed(false)
    onClose()
  }

  return (
    <Modal onClose={handleClose} maxWidth="max-w-md">
      <div className='p-6'>
        <div className='flex items-center gap-3 mb-4'>
          <div className='p-2 rounded-full bg-red-100 dark:bg-red-900/30'>
            <AlertTriangle className='w-6 h-6 text-red-500' />
          </div>
          <h3
            className={`text-lg font-semibold ${
              isDarkTheme(theme) ? 'text-white' : 'text-gray-900'
            }`}
          >
            Confirm Delete
          </h3>
        </div>
        <p
          className={`mb-4 ${
            isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-600'
          }`}
        >
          Are you sure you want to delete <strong>{target.name}</strong>? This
          action cannot be undone.
        </p>
        <label
          className={`mb-4 flex items-start gap-3 text-sm cursor-pointer ${
            isDarkTheme(theme) ? 'text-gray-300' : 'text-gray-700'
          }`}
        >
          <input
            type='checkbox'
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            disabled={deleting}
            className='mt-0.5 h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500'
          />
          <span>Yes, permanently delete this.</span>
        </label>
        {error && (
          <p className='mb-3 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2'>
            {error}
          </p>
        )}
        <div className='flex gap-3'>
          <Button variant='secondary' className='flex-1' onClick={handleClose} disabled={deleting}>
            Cancel
          </Button>
          <Button
            variant='danger'
            className='flex-1'
            onClick={onConfirm}
            disabled={!confirmed}
            isLoading={deleting}
          >
            Delete
          </Button>
        </div>
      </div>
    </Modal>
  )
}
