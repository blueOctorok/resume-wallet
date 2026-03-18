'use client'

import React, { useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import Modal from '@/components/ui/Modal'
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
  const [confirmText, setConfirmText] = useState('')

  if (!target) return null

  const handleClose = () => {
    setConfirmText('')
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
              theme === 'dark' ? 'text-white' : 'text-gray-900'
            }`}
          >
            Confirm Delete
          </h3>
        </div>
        <p
          className={`mb-4 ${
            theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
          }`}
        >
          Are you sure you want to delete <strong>{target.name}</strong>? This
          action cannot be undone.
        </p>
        <div className='mb-4'>
          <label
            className={`block text-sm mb-1 ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
            }`}
          >
            Type DELETE to confirm
          </label>
          <input
            type='text'
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className={`w-full px-3 py-2 rounded-lg border ${
              theme === 'dark'
                ? 'bg-gray-800 border-gray-700 text-white'
                : 'bg-white border-gray-300 text-gray-900'
            } focus:outline-none focus:ring-2 focus:ring-red-500`}
            placeholder='DELETE'
          />
        </div>
        {error && (
          <p className='mb-3 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2'>
            {error}
          </p>
        )}
        <div className='flex gap-3'>
          <button
            onClick={handleClose}
            className={`flex-1 px-4 py-2 rounded-lg font-medium ${
              theme === 'dark'
                ? 'bg-gray-700 text-white hover:bg-gray-600'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={confirmText !== 'DELETE' || deleting}
            className='flex-1 px-4 py-2 rounded-lg font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed'
          >
            {deleting ? (
              <Loader2 className='w-4 h-4 animate-spin mx-auto' />
            ) : (
              'Delete'
            )}
          </button>
        </div>
      </div>
    </Modal>
  )
}
