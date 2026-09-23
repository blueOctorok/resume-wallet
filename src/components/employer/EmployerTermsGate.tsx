'use client'

import { useEffect, useState } from 'react'
import { Scale } from 'lucide-react'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import LoadingScreen from '@/components/LoadingScreen'
import type { EvDocumentSection } from '@/lib/ev-consent-documents'

/**
 * One-time acceptance of the Employment Verification employer-terms schedule.
 * Owner/admin must accept before any employer page. Other roles wait.
 * Self-serve signups already have a row, so this gate is a no-op for them.
 */
export default function EmployerTermsGate({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<'loading' | 'ok' | 'accept' | 'wait'>('loading')
  const [title, setTitle] = useState('Employer terms')
  const [version, setVersion] = useState('')
  const [sections, setSections] = useState<EvDocumentSection[]>([])
  const [checkboxLabel, setCheckboxLabel] = useState('I agree to these terms for my organization.')
  const [checked, setChecked] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/employer/terms')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled || !json) return
        if (!json.required || json.accepted) {
          setPhase('ok')
          return
        }
        setTitle(json.title ?? 'Employer terms')
        setVersion(json.version ?? '')
        setSections(json.sections ?? [])
        setCheckboxLabel(json.checkboxLabel || 'I agree to these terms for my organization.')
        setPhase(json.canAccept ? 'accept' : 'wait')
      })
      .catch(() => {
        if (!cancelled) setPhase('ok')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const accept = async () => {
    if (!checked) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/employer/terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accepted: true }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Could not save acceptance')
        return
      }
      setPhase('ok')
    } catch {
      setError('Could not save acceptance')
    } finally {
      setSaving(false)
    }
  }

  if (phase === 'loading') {
    return <LoadingScreen message="Loading…" fullScreen={false} />
  }
  if (phase === 'ok') return <>{children}</>
  if (phase === 'wait') {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <Scale className="mx-auto mb-3 h-8 w-8 text-teal-600" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Waiting on your admin
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          An owner or admin needs to accept Provven&apos;s employer terms before this company can continue.
        </p>
      </div>
    )
  }

  return (
    <Modal onClose={() => {}} disableBackdropClose disableEscapeClose maxWidth="max-w-lg" paper>
      <ModalHeader title={title} subtitle={version ? `Version ${version}` : undefined} onClose={() => {}} paper />
      <div className="max-h-[50vh] space-y-3 overflow-y-auto px-6 pt-4 text-sm text-[#173150]">
        {sections.map((section, i) => (
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
      <div className="space-y-3 p-6">
        <label className="flex items-start gap-2 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5"
          />
          <span>{checkboxLabel}</span>
        </label>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <Button type="button" variant="primary" disabled={!checked || saving} isLoading={saving} onClick={accept}>
          Accept for my company
        </Button>
      </div>
    </Modal>
  )
}
