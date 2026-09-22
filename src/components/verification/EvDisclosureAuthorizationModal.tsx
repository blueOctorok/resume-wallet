'use client'

import { useEffect, useRef, useState } from 'react'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import EvConsentDocumentView from './EvConsentDocumentView'
import {
  EV_DRIVER_AUTHORIZATION,
  EV_DRIVER_DISCLOSURE,
} from '@/lib/ev-consent-documents'
import { Loader2 } from 'lucide-react'

interface EvDisclosureAuthorizationModalProps {
  /** Prior employer(s) this authorization targets — snapshotted on the artifact. */
  employerTargets: { companyName: string; email?: string; phone?: string }[]
  /** Typed signature carried over from the driver authorization paper. */
  signedName: string
  onAuthorized: (evAuthorizationId: string) => void
  onClose: () => void
}

/**
 * PDF-1 flow (PROVVEN-EV-DISC-AUTH-B-0.1): standalone Disclosure screen
 * (Continue enabled only after full scroll), then a separate Authorization
 * screen with an unchecked accept box. Authorizing creates the ev_authorizations
 * artifact — the hard gate initiate-self requires before routing anything.
 */
export default function EvDisclosureAuthorizationModal({
  employerTargets,
  signedName,
  onAuthorized,
  onClose,
}: EvDisclosureAuthorizationModalProps) {
  const [screen, setScreen] = useState<'disclosure' | 'authorization'>('disclosure')
  const [disclosureRead, setDisclosureRead] = useState(false)
  const [disclosureViewedAt, setDisclosureViewedAt] = useState<string | null>(null)
  const [accepted, setAccepted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Continue unlocks only after the disclosure is fully viewed. If the text
  // fits without scrolling, it counts as viewed immediately.
  useEffect(() => {
    const el = scrollRef.current
    if (screen !== 'disclosure' || !el) return
    const check = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 16) {
        setDisclosureRead(true)
        setDisclosureViewedAt((prev) => prev ?? new Date().toISOString())
      }
    }
    check()
    el.addEventListener('scroll', check)
    return () => el.removeEventListener('scroll', check)
  }, [screen])

  const authorize = async () => {
    if (!accepted || !disclosureViewedAt) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/candidate/verification/ev-authorization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signedName,
          disclosureViewedAt,
          employerTargets,
          checkboxEventId: crypto.randomUUID(),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to record authorization')
        return
      }
      onAuthorized(data.evAuthorizationId)
    } catch {
      setError('Failed to record authorization')
    } finally {
      setSubmitting(false)
    }
  }

  const doc = screen === 'disclosure' ? EV_DRIVER_DISCLOSURE : EV_DRIVER_AUTHORIZATION

  return (
    <Modal onClose={onClose} maxWidth='max-w-2xl' panelShape='block' paper zIndex={1100}>
      <ModalHeader
        title={doc.title}
        subtitle={
          screen === 'disclosure'
            ? 'Please read this disclosure carefully before continuing.'
            : `Authorize Provven to route this request to ${employerTargets
                .map((t) => t.companyName)
                .join(', ')}.`
        }
        onClose={onClose}
        variant='block'
        paper
      />

      <div ref={scrollRef} className='max-h-[55vh] overflow-y-auto p-4 sm:p-6'>
        <EvConsentDocumentView document={doc} />
      </div>

      <div className='sticky bottom-0 space-y-3 border-t border-ironside/20 bg-[#fbf8f1]/95 p-4 backdrop-blur-sm sm:p-5'>
        {screen === 'authorization' && (
          <label className='flex items-start gap-2 text-sm text-[#173150]'>
            {/* Required accept control — never pre-checked (Track B draft). */}
            <input
              type='checkbox'
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className='mt-0.5 accent-[#173150]'
            />
            <span>{EV_DRIVER_AUTHORIZATION.checkboxLabel}</span>
          </label>
        )}
        {error && <p className='text-sm text-red-600'>{error}</p>}
        <div className='flex flex-wrap justify-end gap-2'>
          <Button type='button' variant='secondary' size='sm' onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          {screen === 'disclosure' ? (
            <Button
              type='button'
              variant='primary'
              size='sm'
              disabled={!disclosureRead}
              onClick={() => setScreen('authorization')}
            >
              {disclosureRead ? 'Continue' : 'Scroll to read the full disclosure'}
            </Button>
          ) : (
            <Button
              type='button'
              variant='primary'
              size='sm'
              disabled={!accepted || submitting}
              onClick={authorize}
              className='inline-flex items-center gap-2'
            >
              {submitting && <Loader2 className='h-4 w-4 animate-spin' />}
              {submitting ? 'Recording…' : EV_DRIVER_AUTHORIZATION.primaryCta}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
