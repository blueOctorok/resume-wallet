'use client'

import { useState } from 'react'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { EV_EMPLOYER_TERMS } from '@/lib/ev-consent-documents'
import { isPublicEmailAddress } from '@/lib/employer-domain-match'
import { isTestCarrierInbox } from '@/lib/test-superuser'
import { createClient } from '@/utils/supabase/client'
import { verifyEmailOtp } from '@/lib/verify-email-otp'

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
  const [codeEmail, setCodeEmail] = useState<string | null>(null)
  const [companyLabel, setCompanyLabel] = useState('')
  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)

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
      setCompanyLabel(typeof json.companyName === 'string' ? json.companyName : companyName.trim())
      setCodeEmail(typeof json.email === 'string' ? json.email : email.trim())
    } catch {
      setError('Could not submit. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal onClose={onClose} maxWidth="max-w-md" paper>
      <ModalHeader
        title={codeEmail ? 'Enter your code' : 'Get employer access'}
        subtitle={codeEmail ? 'Employer account' : 'Work email required'}
        onClose={onClose}
      />
      {codeEmail ? (
        <form
          className="space-y-3 p-6"
          onSubmit={async (e) => {
            e.preventDefault()
            setError(null)
            if (code.trim().length < 6) {
              setError('Enter the 6-digit code from your email.')
              return
            }
            setVerifying(true)
            const { error: verifyError } = await verifyEmailOtp(createClient(), codeEmail, code)
            if (verifyError) {
              setError(verifyError.message)
              setVerifying(false)
              return
            }
            window.location.assign('/')
          }}
        >
          <p className="text-sm text-[#173150]">
            This opens the employer account for {companyLabel}. We sent a code to {codeEmail}.
            Type it here — this is not the driver login, and there is no link to click.
          </p>
          <p className="text-xs text-[#173150]/70">
            Find Drivers stays closed until Provven approves the company. You can still sign in
            and see the employer view.
          </p>
          <input
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={fieldClass}
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <Button type="submit" variant="primary" isLoading={verifying} disabled={verifying}>
            Open employer account
          </Button>
          <button
            type="button"
            className="text-xs text-[#173150]/70 underline"
            onClick={async () => {
              setError(null)
              setSubmitting(true)
              try {
                const res = await fetch('/api/auth/email-code', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ email: codeEmail }),
                })
                const json = await res.json()
                if (!res.ok) setError(json.error || 'Could not resend the code.')
              } catch {
                setError('Could not resend the code.')
              } finally {
                setSubmitting(false)
              }
            }}
          >
            {submitting ? 'Sending…' : 'Resend code'}
          </button>
        </form>
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
