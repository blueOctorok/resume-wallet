'use client'

import { useState } from 'react'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { EV_EMPLOYER_TERMS } from '@/lib/ev-consent-documents'
import { isPublicEmailAddress } from '@/lib/employer-domain-match'
import { isTestCarrierInbox } from '@/lib/test-superuser'

const WORK_EMAIL_ERROR =
  'Use your company email address — personal addresses (Gmail, Yahoo, Outlook.com…) can’t open a carrier account.'

// Paper modal stays cream even when the app is in dark mode, so these fields
// do not use dark: variants (those follow html.dark and painted navy inputs).
const fieldClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-[#173150] placeholder:text-slate-400'

/**
 * Shared door for a carrier who isn't Pace. Open from a shared card (shareToken
 * set) or the homepage (no token). Work email only — checked here and again
 * on the server.
 */
export default function EmployerAccessModal({
  shareToken,
  onClose,
}: {
  shareToken?: string
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [email, setEmail] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const emailLooksPersonal =
    email.includes('@') && isPublicEmailAddress(email) && !isTestCarrierInbox(email)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (isPublicEmailAddress(email) && !isTestCarrierInbox(email)) {
      setError(WORK_EMAIL_ERROR)
      return
    }
    if (!accepted) {
      setError('Read and accept the employer terms to continue.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/employer/access-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          companyName: companyName.trim(),
          email: email.trim(),
          ...(shareToken ? { shareToken } : {}),
          termsAccepted: true,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Could not submit. Please try again.')
        return
      }
      setDone(json.message as string)
    } catch {
      setError('Could not submit. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal onClose={onClose} maxWidth="max-w-md" paper>
      <ModalHeader title="Get employer access" subtitle="Work email required" onClose={onClose} />
      {done ? (
        <div className="p-6">
          <p className="text-sm text-[#173150]">{done}</p>
          <div className="mt-4">
            <Button type="button" variant="primary" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3 p-6">
          <p className="text-xs text-[#173150]/80">
            Use your company email. Personal addresses can’t open an account — drivers must not
            be able to browse other drivers.
          </p>
          <input
            required
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={fieldClass}
          />
          <input
            required
            type="text"
            placeholder="Company name"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className={fieldClass}
          />
          <div>
            <input
              required
              type="email"
              placeholder="Work email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={fieldClass}
            />
            <p className="mt-1 text-[11px] text-[#173150]/70">
              Work email — not Gmail, Yahoo, or Outlook.com.
            </p>
            {emailLooksPersonal && <p className="mt-1 text-xs text-red-600">{WORK_EMAIL_ERROR}</p>}
          </div>
          <label className="flex items-start gap-2 text-xs leading-snug text-[#173150]">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              {EV_EMPLOYER_TERMS.checkboxLabel}{' '}
              <button type="button" className="underline" onClick={() => setShowTerms(true)}>
                Read the schedule
              </button>
            </span>
          </label>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <Button
            type="submit"
            variant="primary"
            isLoading={submitting}
            disabled={submitting || emailLooksPersonal}
          >
            Request access
          </Button>
        </form>
      )}
      {showTerms && (
        <Modal onClose={() => setShowTerms(false)} maxWidth="max-w-lg" zIndex={1100} paper>
          <ModalHeader
            title={EV_EMPLOYER_TERMS.title}
            subtitle={`Version ${EV_EMPLOYER_TERMS.version}`}
            onClose={() => setShowTerms(false)}
          />
          <div className="max-h-[60vh] space-y-4 overflow-y-auto p-6 text-sm text-[#173150]">
            {EV_EMPLOYER_TERMS.sections.map((section, i) => (
              <section key={i}>
                {section.heading && <h3 className="mb-1 font-semibold">{section.heading}</h3>}
                {section.paragraphs?.map((p) => (
                  <p key={p} className="mb-2">
                    {p}
                  </p>
                ))}
              </section>
            ))}
          </div>
        </Modal>
      )}
    </Modal>
  )
}
