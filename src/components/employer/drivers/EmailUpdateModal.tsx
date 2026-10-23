'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { isEmailAddress, isRecruiterInbox, RECRUITER_INBOXES, recruiterInboxLabel, type RecruiterInbox } from '@/lib/recruiter-inboxes'
import type { DqItemId } from '@/lib/dq-file-registry'
import type { DqItemStatus } from '@/lib/dq-file-status'

const inputBase =
  'w-full px-3 py-2 rounded-lg text-sm border border-stone-200 bg-white text-[#173150] placeholder-ironside outline-none transition-colors focus:ring-2 focus:ring-teal-500/40'

interface EmailDriver {
  userId: string
  name: string
  headline: string | null
  items: Array<{ id: DqItemId; status: DqItemStatus; line: string }>
}

/**
 * She picks a recruiter and one driver. The message is written from that
 * driver's file: what is done, and what they are stuck on. She can edit it.
 */
export default function EmailUpdateModal({
  rows,
  storageKey,
  initialDriver = null,
  onClose,
}: {
  rows: readonly EmailDriver[]
  storageKey: string
  /** Set when she opened this from a driver's file, so the name is already chosen. */
  initialDriver?: EmailDriver | null
  onClose: () => void
}) {
  const [to, setTo] = useState<RecruiterInbox | 'other' | ''>('')
  const [otherAddress, setOtherAddress] = useState('')
  const [query, setQuery] = useState('')
  const [driver, setDriver] = useState<EmailDriver | null>(initialDriver)
  const [message, setMessage] = useState('')
  const [writing, setWriting] = useState(Boolean(initialDriver))
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (!saved) return
      if (isRecruiterInbox(saved)) setTo(saved)
      else if (isEmailAddress(saved)) {
        setTo('other')
        setOtherAddress(saved)
      }
    } catch {
      /* This browser is blocking storage. She can still pick from the list. */
    }
  }, [storageKey])

  const q = query.trim().toLowerCase()
  const matches =
    driver || q.length < 2
      ? []
      : rows
          .filter((row) => row.name.toLowerCase().includes(q) || (row.headline ?? '').toLowerCase().includes(q))
          .slice(0, 6)

  const writeNote = async (next: EmailDriver) => {
    setWriting(true)
    setError(null)
    setMessage('')
    try {
      const res = await fetch('/api/employer/dq-monitor/status-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: next.name,
          items: next.items.map((item) => ({ id: item.id, status: item.status, line: item.line })),
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string }
      if (!res.ok || !data.message) throw new Error(data.error || 'Could not write the update')
      setMessage(data.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not write the update')
    } finally {
      setWriting(false)
    }
  }

  useEffect(() => {
    if (!initialDriver) return
    void writeNote(initialDriver)
    // Mounts once per open. A later run would replace a message she already edited.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const recipient = (to === 'other' ? otherAddress : to).trim().toLowerCase()

  const handleSend = async () => {
    if (!driver || !isEmailAddress(recipient)) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/employer/dq-monitor/email-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: recipient,
          driverName: driver.name,
          driverUserId: driver.userId,
          message: message.trim(),
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error || 'Could not send')
      try {
        localStorage.setItem(storageKey, recipient)
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
      <ModalHeader title="Email update" subtitle="Pick a recruiter and one driver." onClose={onClose} variant="block" paper />
      <div className="space-y-4 p-4 sm:p-5">
        {sent ? (
          <p className="text-sm text-[#173150]">
            Sent to {to === 'other' ? otherAddress.trim() : to ? recruiterInboxLabel(to) : 'the recruiter'} about {driver?.name}.
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
                  if (next === 'other') setTo('other')
                  else setTo(isRecruiterInbox(next) ? next : '')
                }}
                className={inputBase}
              >
                <option value="">Select a recruiter…</option>
                {RECRUITER_INBOXES.map((email) => (
                  <option key={email} value={email}>
                    {recruiterInboxLabel(email)}
                  </option>
                ))}
                <option value="other">Other</option>
              </select>
              {to === 'other' && (
                <input
                  id="recruiter-other"
                  type="email"
                  value={otherAddress}
                  onChange={(e) => setOtherAddress(e.target.value)}
                  placeholder="name@company.com"
                  aria-label="Email address"
                  className={`${inputBase} mt-2`}
                  autoComplete="email"
                />
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ironside" htmlFor="driver-search">
                Driver
              </label>
              {driver ? (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                  <p className="truncate text-sm font-medium text-[#173150]">{driver.name}</p>
                  <button
                    type="button"
                    className="shrink-0 text-xs font-medium text-[#173150] underline"
                    onClick={() => {
                      setDriver(null)
                      setMessage('')
                      setQuery('')
                      setError(null)
                    }}
                  >
                    Change
                  </button>
                </div>
              ) : (
                <>
                  <input
                    id="driver-search"
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Type a name…"
                    className={inputBase}
                    autoComplete="off"
                  />
                  {matches.length > 0 && (
                    <ul className="mt-1 overflow-hidden rounded-lg border border-stone-200">
                      {matches.map((row) => (
                        <li key={row.userId}>
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm text-[#173150] hover:bg-stone-50"
                            onClick={() => {
                              setDriver(row)
                              setQuery('')
                              void writeNote(row)
                            }}
                          >
                            {row.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {q.length >= 2 && matches.length === 0 && <p className="mt-1 text-xs text-ironside">No driver with that name.</p>}
                </>
              )}
            </div>
            {driver && (
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-medium text-ironside" htmlFor="status-message">
                    Message
                  </label>
                  <button
                    type="button"
                    className="text-xs font-medium text-[#173150] underline disabled:opacity-40"
                    disabled={writing}
                    onClick={() => void writeNote(driver)}
                  >
                    Write it again
                  </button>
                </div>
                {writing ? (
                  <div
                    className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-8 text-sm text-[#173150]"
                    role="status"
                  >
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#f15a2b]" />
                    Writing the update…
                  </div>
                ) : (
                  <textarea
                    id="status-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={5}
                    placeholder="The update will appear here."
                    className={`${inputBase} resize-none`}
                  />
                )}
              </div>
            )}
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
              disabled={sending || writing || !isEmailAddress(recipient) || !driver || !message.trim()}
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
