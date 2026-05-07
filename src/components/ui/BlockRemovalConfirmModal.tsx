'use client'

import { useState } from 'react'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import Button from '@/components/ui/Button'

export interface BlockRemovalConfirmModalProps {
  open: boolean
  onClose: () => void
  /** e.g. "MVR" or block label from registry */
  blockLabel: string
  /** When true, user must enter `reason` (min length) before confirm */
  requireReason?: boolean
  /** Minimum trimmed length for reason when requireReason is true */
  minReasonLength?: number
  confirmLabel?: string
  /** Return / resolve successfully only after the server accepted the action (so the modal can close). */
  onConfirm: (reason: string | null) => void | Promise<void>
}

/**
 * Shared removal confirmation: block uninstall hides UI but preserves
 * paid records, orders, and signed disclosures in the database.
 */
export default function BlockRemovalConfirmModal({
  open,
  onClose,
  blockLabel,
  requireReason = false,
  minReasonLength = 3,
  confirmLabel = 'Remove block',
  onConfirm,
}: BlockRemovalConfirmModalProps) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  if (!open) return null

  const trimmed = reason.trim()
  const reasonOk = !requireReason || trimmed.length >= minReasonLength

  const handleConfirm = async () => {
    if (!reasonOk || busy) return
    setBusy(true)
    try {
      await onConfirm(requireReason ? trimmed : null)
      setReason('')
      onClose()
    } catch {
      // Keep modal open so the user can fix validation or retry (parent may alert).
    } finally {
      setBusy(false)
    }
  }

  const handleClose = () => {
    if (busy) return
    setReason('')
    onClose()
  }

  return (
    <Modal onClose={handleClose} maxWidth='max-w-md' zIndex={1100} panelShape='block'>
      <ModalHeader
        variant='block'
        title={`Remove ${blockLabel}?`}
        subtitle='Your historical records (orders, signed disclosures, paid reports) are preserved and will reappear if you reinstall this block.'
        onClose={handleClose}
      />
      <div className='space-y-4 border-t border-gray-200/80 p-4 dark:border-gray-700/80'>
        {requireReason && (
          <div>
            <label
              htmlFor='block-removal-reason'
              className='mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300'
            >
              Reason (required for audit log)
            </label>
            <textarea
              id='block-removal-reason'
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className='w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500'
              placeholder='e.g. Customer requested PSP off during pilot…'
            />
            {!reasonOk && trimmed.length > 0 && (
              <p className='mt-1 text-xs text-amber-600 dark:text-amber-400'>
                Enter at least {minReasonLength} characters.
              </p>
            )}
          </div>
        )}
        <div className='flex justify-end gap-2'>
          <Button type='button' variant='secondary' onClick={handleClose} disabled={busy}>
            Cancel
          </Button>
          <Button type='button' variant='danger' onClick={handleConfirm} disabled={!reasonOk || busy} isLoading={busy}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
