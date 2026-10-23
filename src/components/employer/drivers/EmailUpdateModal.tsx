'use client'

import { useEffect, useMemo, useState } from 'react'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { isRecruiterInbox, RECRUITER_INBOXES, recruiterInboxLabel, type RecruiterInbox } from '@/lib/recruiter-inboxes'
import {
  driversForStatusUpdate,
  STATUS_UPDATE_REASONS,
  statusUpdateReason,
  type StatusUpdateReasonId,
  type StatusUpdateRow,
} from '@/lib/status-update-reasons'

const SEND_CAP = 200

const inputBase =
  'w-full px-3 py-2 rounded-lg text-sm border border-stone-200 bg-white text-[#173150] placeholder-ironside outline-none transition-colors focus:ring-2 focus:ring-teal-500/40'

/**
 * She picks a recruiter and what the email is about, here.
 * The pills on the board do not decide who gets included.
 */
export default function EmailUpdateModal({
  rows,
  storageKey,
  onClose,
}: {
  rows: readonly StatusUpdateRow[]
  storageKey: string
  onClose: () => void
}) {
  const [to, setTo] = useState<RecruiterInbox | ''>('')
  const [reasonId, setReasonId] = useState<StatusUpdateReasonId | ''>('')
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved && isRecruiterInbox(saved)) setTo(saved)
    } catch {
      /* This browser is blocking storage. She can still pick from the list. */
    }
  }, [storageKey])

  const reason = reasonId ? statusUpdateReason(reasonId) : null
  const matched = useMemo(() => (reason ? driversForStatusUpdate(rows, reason.id) : []), [reason, rows])
  const drivers = matched.slice(0, SEND_CAP)

  const handleSend = async () => {
    if (!reason) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/employer/dq-monitor/email-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: to.trim(), reasonId: reason.id, note: note.trim(), drivers }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error || 'Could not send')
      try {
        localStorage.setItem(storageKey, to.trim())
      } catch {
        /* Remembering the address is a convenience. */
      }
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send')
    } finally {
      setSending(false)
    }
  }

  const countLine =
    matched.length === 0
      ? 'Nobody fits this right now.'
      : matched.length > SEND_CAP
        ? `The first ${SEND_CAP} of ${matched.length} drivers will be included.`
        : `${matched.length} driver${matched.length === 1 ? '' : 's'} will be included.`

  return (
    <Modal
      onClose={onClose}
      maxWidth="max-w-xl"
      zIndex={1100}
      panelShape="block"
      panelClassName="!border-stone-200 !bg-white !ring-[#173150]/10"
    >
      <ModalHeader title="Email update" subtitle="Pick a recruiter and what this is about." onClose={onClose} variant="block" paper />
      <div className="space-y-4 p-4 sm:p-5">
        {sent ? (
          <p className="text-sm text-[#173150]">
            Sent to {to ? recruiterInboxLabel(to) : 'the recruiter'}. {drivers.length} driver{drivers.length === 1 ? '' : 's'}.
          </p>
        ) : (
          <>
            <div>
              <label className="mb-1 block text-xs font-medium text-ironside" htmlFor="recruiter-email">
                Recruiter
              </label>
              <select
                id="recruiter-email"
                value={to}
                onChange={(e) => {
                  const next = e.target.value
                  setTo(isRecruiterInbox(next) ? next : '')
                }}
                className={inputBase}
              >
                <option value="">Select a recruiter…</option>
                {RECRUITER_INBOXES.map((email) => (
                  <option key={email} value={email}>
                    {recruiterInboxLabel(email)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ironside" htmlFor="update-reason">
                What is this about?
              </label>
              <select
                id="update-reason"
                value={reasonId}
                onChange={(e) => {
                  const next = statusUpdateReason(e.target.value)
                  setReasonId(next ? next.id : '')
                }}
                className={inputBase}
              >
                <option value="">Select one…</option>
                {STATUS_UPDATE_REASONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            {reason && (
              <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                <p className="text-sm text-[#173150]">{reason.sentence}</p>
                <p className="mt-1 text-xs text-ironside">{countLine}</p>
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs font-medium text-ironside" htmlFor="recruiter-note">
                Add a note (optional)
              </label>
              <textarea
                id="recruiter-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Anything else they should know…"
                className={`${inputBase} resize-none`}
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            {sent ? 'Close' : 'Cancel'}
          </Button>
          {!sent && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => void handleSend()}
              disabled={sending || !to || !reason || drivers.length === 0}
              isLoading={sending}
            >
              Send
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
