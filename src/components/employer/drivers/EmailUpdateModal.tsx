'use client'

import { useEffect, useState } from 'react'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { isRecruiterInbox, RECRUITER_INBOXES, recruiterInboxLabel, type RecruiterInbox } from '@/lib/recruiter-inboxes'

const inputBase =
  'w-full px-3 py-2 rounded-lg text-sm border border-stone-200 bg-white text-[#173150] placeholder-ironside outline-none transition-colors focus:ring-2 focus:ring-teal-500/40'

export interface StatusUpdateDriver {
  name: string
  line: string
}

/**
 * HR sends the drivers currently on the board to a recruiter who does not log in.
 * She picks from the fixed inbox list. The last pick stays in this browser.
 */
export default function EmailUpdateModal({
  drivers,
  focusLabel,
  storageKey,
  onClose,
}: {
  drivers: StatusUpdateDriver[]
  focusLabel: string | null
  storageKey: string
  onClose: () => void
}) {
  const [to, setTo] = useState<RecruiterInbox | ''>('')
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

  const preview = drivers.slice(0, 8)
  const rest = drivers.length - preview.length

  const handleSend = async () => {
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/employer/dq-monitor/email-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: to.trim(), note: note.trim(), drivers }),
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

  return (
    <Modal
      onClose={onClose}
      maxWidth="max-w-xl"
      zIndex={1100}
      panelShape="block"
      panelClassName="!border-stone-200 !bg-white !ring-[#173150]/10"
    >
      <ModalHeader
        title="Email update"
        subtitle={
          focusLabel
            ? `${drivers.length} driver${drivers.length === 1 ? '' : 's'} · ${focusLabel}`
            : `${drivers.length} driver${drivers.length === 1 ? '' : 's'} on the board right now`
        }
        onClose={onClose}
        variant="block"
        paper
      />
      <div className="space-y-4 p-4 sm:p-5">
        {sent ? (
          <p className="text-sm text-[#173150]">Sent to {to ? recruiterInboxLabel(to) : 'the recruiter'}.</p>
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
              <label className="mb-1 block text-xs font-medium text-ironside" htmlFor="recruiter-note">
                Note (optional)
              </label>
              <textarea
                id="recruiter-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="A short note for the recruiter…"
                className={`${inputBase} resize-none`}
              />
            </div>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
              {drivers.length === 0 ? (
                <p className="text-xs text-ironside">No drivers on the board to send.</p>
              ) : (
                <ul className="space-y-2">
                  {preview.map((driver, index) => (
                    <li key={`${driver.name}-${index}`}>
                      <p className="text-xs font-medium text-[#173150]">{driver.name}</p>
                      <p className="text-xs text-ironside">{driver.line}</p>
                    </li>
                  ))}
                  {rest > 0 && <li className="text-xs text-ironside">and {rest} more</li>}
                </ul>
              )}
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            {sent ? 'Close' : 'Cancel'}
          </Button>
          {!sent && (
            <Button type="button" variant="primary" size="sm" onClick={() => void handleSend()} disabled={sending || drivers.length === 0 || !to.trim()} isLoading={sending}>
              Send
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
