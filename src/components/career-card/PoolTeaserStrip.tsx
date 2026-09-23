'use client'

import { useEffect, useState } from 'react'
import { Building2 } from 'lucide-react'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { useTheme } from '@/contexts/ThemeContext'
import { EV_EMPLOYER_TERMS } from '@/lib/ev-consent-documents'
import type { PoolStats } from '@/lib/pool-stats'

/**
 * Public-card sales strip. Counts only — copy stays neutral (no "verified
 * pool" / EV language). Counsel should review the sentence before production.
 */
export default function PoolTeaserStrip({
  shareToken,
  onDark = false,
  showAccessCta = true,
}: {
  shareToken: string
  /** Public card page is always a dark canvas, even if the saved theme is light. */
  onDark?: boolean
  /** Pending employers already have an account — don't offer signup again. */
  showAccessCta?: boolean
}) {
  const { theme } = useTheme()
  const dark = onDark || theme === 'dark'
  const [stats, setStats] = useState<PoolStats | null>(null)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/career-card/pool-stats?token=${encodeURIComponent(shareToken)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled && json?.stats) setStats(json.stats as PoolStats)
      })
      .catch(() => {
        /* teaser is optional — the card still stands without it */
      })
    return () => {
      cancelled = true
    }
  }, [shareToken])

  if (!stats || stats.driverCount < 2) return null

  return (
    <>
      <div
        className={`max-w-2xl mx-auto mb-6 rounded-xl border px-4 py-4 ${
          dark
            ? 'border-teal-500/30 bg-teal-500/10'
            : 'border-teal-200 bg-teal-50'
        }`}
      >
        <p className={`text-sm ${dark ? 'text-teal-50' : 'text-[#173150]'}`}>{teaserSentence(stats)}</p>
        {showAccessCta && (
          <div className="mt-3">
            <Button type="button" variant="primary" size="sm" onClick={() => setShowForm(true)}>
              <Building2 className="mr-1.5 inline h-4 w-4" />
              Get employer access
            </Button>
          </div>
        )}
      </div>
      {showAccessCta && showForm && (
        <EmployerAccessModal shareToken={shareToken} onClose={() => setShowForm(false)} />
      )}
    </>
  )
}

function teaserSentence(stats: PoolStats): string {
  const who = stats.cdlClass
    ? `${stats.driverCount} CDL-${stats.cdlClass} drivers`
    : `${stats.driverCount} drivers`
  const where = stats.scope === 'state' && stats.state ? ` in ${stats.state}` : ''
  const clean =
    stats.cleanDrivingRecordCount > 0
      ? ` — ${stats.cleanDrivingRecordCount} with clean driving records`
      : ''
  return `One of ${who}${where} on Provven${clean}.`
}

function EmployerAccessModal({
  shareToken,
  onClose,
}: {
  shareToken: string
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
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
          shareToken,
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
      <ModalHeader title="Get employer access" onClose={onClose} />
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
          <p className="text-xs text-slate-600">
            Work email gets you in right away, pending a quick Provven review. Personal
            email (Gmail, Yahoo, and similar) is reviewed before an account is created.
          </p>
          <input
            required
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-[#173150]"
          />
          <input
            required
            type="text"
            placeholder="Company name"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-[#173150]"
          />
          <input
            required
            type="email"
            placeholder="Work email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-[#173150]"
          />
          <label className="flex items-start gap-2 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              {EV_EMPLOYER_TERMS.checkboxLabel}{' '}
              <button
                type="button"
                className="underline"
                onClick={() => setShowTerms(true)}
              >
                Read the schedule
              </button>
            </span>
          </label>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <Button type="submit" variant="primary" isLoading={submitting} disabled={submitting}>
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
