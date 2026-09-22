'use client'

import { useCallback, useEffect, useState } from 'react'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import EvConsentDocumentView from '@/components/verification/EvConsentDocumentView'
import {
  EV_EMPLOYER_SHARE_REQUEST,
  resolveEvDocument,
} from '@/lib/ev-consent-documents'
import type { EvProofSummaryItem, EvShareRequestStatus } from '@/lib/ev-share'
import { Loader2, ShieldCheck } from 'lucide-react'

interface ShareRequestSummary {
  id: string
  application_context: string
  payload_type: 'proof' | 'full'
  status: EvShareRequestStatus
  created_at: string
}

interface EvShareRequestSectionProps {
  candidateUserId: string
  candidateName: string
  /** Application / requisition context — required by the clickwrap certification. */
  applicationContext: string
  isDark: boolean
}

/**
 * Employer-side EV share flow (docs/EV_CONSENT_STACK.md).
 *
 * Renders ONLY in a candidate-initiated application context — never from
 * talent-search browse (clickwrap clause A.3 no-browse). States:
 *   no request  → "Request EV share" (opens the per-request clickwrap)
 *   pending     → waiting on driver; no content
 *   declined    → no content, no re-ask spam
 *   authorized  → proof summary fetched from the grant-gated view endpoint
 *   revoked     → access removed copy
 */
export default function EvShareRequestSection({
  candidateUserId,
  candidateName,
  applicationContext,
  isDark,
}: EvShareRequestSectionProps) {
  const [loading, setLoading] = useState(true)
  const [canRequest, setCanRequest] = useState(false)
  const [companyName, setCompanyName] = useState('')
  const [latest, setLatest] = useState<ShareRequestSummary | null>(null)
  const [showClickwrap, setShowClickwrap] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [proof, setProof] = useState<EvProofSummaryItem[] | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/employer/ev/share-requests?driverUserId=${encodeURIComponent(candidateUserId)}`,
      )
      if (!res.ok) return
      const data = await res.json()
      setCanRequest(Boolean(data.canRequestEvShare))
      setCompanyName(data.companyName ?? '')
      setLatest((data.shareRequests as ShareRequestSummary[])[0] ?? null)
    } finally {
      setLoading(false)
    }
  }, [candidateUserId])

  useEffect(() => {
    void load()
  }, [load])

  // Authorized → fetch the proof summary through the grant-gated endpoint.
  useEffect(() => {
    if (latest?.status !== 'authorized') {
      setProof(null)
      return
    }
    let cancelled = false
    fetch(`/api/employer/ev/view/${latest.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.proofSummary) setProof(data.proofSummary)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [latest?.id, latest?.status])

  const submitRequest = async () => {
    if (!accepted) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/employer/ev/share-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverUserId: candidateUserId,
          applicationContext,
          checkboxEventId: crypto.randomUUID(),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to submit share request')
        return
      }
      setShowClickwrap(false)
      setAccepted(false)
      void load()
    } catch {
      setError('Failed to submit share request')
    } finally {
      setSubmitting(false)
    }
  }

  // Company hasn't installed the employer EV block — no affordance at all.
  if (!loading && !canRequest) return null

  const mutedText = isDark ? 'text-gray-400' : 'text-gray-600'

  return (
    <div
      className={`rounded-xl border p-3 ${
        isDark ? 'border-gray-700 bg-gray-800/60' : 'border-gray-200 bg-gray-50'
      }`}
    >
      <div className='mb-1 flex items-center gap-2'>
        <ShieldCheck className='h-4 w-4 text-teal-600 dark:text-teal-400' />
        <span className={`text-sm font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
          Employment verification
        </span>
      </div>

      {loading ? (
        <div className='flex items-center gap-2 py-1'>
          <Loader2 className={`h-4 w-4 animate-spin ${mutedText}`} />
        </div>
      ) : latest?.status === 'pending' ? (
        <p className={`text-xs ${mutedText}`}>
          Waiting for the driver to authorize sharing. You cannot view EV material yet.
        </p>
      ) : latest?.status === 'declined' ? (
        <p className={`text-xs ${mutedText}`}>
          The driver declined to share. No EV material is available.
        </p>
      ) : latest?.status === 'revoked' ? (
        <p className={`text-xs ${mutedText}`}>
          The driver revoked in-platform access. You may no longer view this material in Provven.
          Copies you already downloaded may still be subject to your retention and confidentiality
          obligations.
        </p>
      ) : latest?.status === 'authorized' ? (
        proof ? (
          <ul className='space-y-2'>
            {proof.map((item) => (
              <li
                key={item.evRequestId}
                className={`rounded-lg border px-3 py-2 text-xs ${
                  isDark ? 'border-gray-700 bg-gray-900/60 text-gray-200' : 'border-gray-200 bg-white text-gray-800'
                }`}
              >
                <span className='font-semibold'>{item.previousEmployerName}</span>
                {item.claimedPosition ? ` — ${item.claimedPosition}` : ''}
                <span className={`block ${mutedText}`}>
                  Confirmed {item.confirmedStartDate ?? '?'} to {item.confirmedEndDate ?? 'present'}
                  {item.dkimVerified ? ` · DKIM verified${item.dkimDomain ? ` (${item.dkimDomain})` : ''}` : ''}
                  {item.respondedAt ? ` · responded ${item.respondedAt.slice(0, 10)}` : ''}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className='flex items-center gap-2 py-1'>
            <Loader2 className={`h-4 w-4 animate-spin ${mutedText}`} />
            <span className={`text-xs ${mutedText}`}>Loading shared summary…</span>
          </div>
        )
      ) : (
        <>
          <p className={`mb-2 text-xs ${mutedText}`}>
            Employment verification available on request. The driver must authorize before you can
            view anything.
          </p>
          <Button type='button' variant='secondary' size='sm' onClick={() => setShowClickwrap(true)}>
            Request EV share
          </Button>
        </>
      )}

      {showClickwrap && (
        <Modal
          onClose={() => setShowClickwrap(false)}
          maxWidth='max-w-2xl'
          panelShape='block'
          paper
          zIndex={1100}
        >
          <ModalHeader
            title={EV_EMPLOYER_SHARE_REQUEST.title}
            subtitle={`${candidateName} · ${applicationContext} · Proof summary (default)`}
            onClose={() => setShowClickwrap(false)}
            variant='block'
            paper
          />
          <div className='max-h-[55vh] overflow-y-auto p-4 sm:p-6'>
            <EvConsentDocumentView
              document={resolveEvDocument(EV_EMPLOYER_SHARE_REQUEST, {
                driverName: candidateName,
                employerLegalName: companyName,
                applicationContext,
              })}
            />
            <p className='mt-3 text-xs text-[#173150]/60'>
              Status: driver must separately authorize before you can view anything.
            </p>
          </div>
          <div className='sticky bottom-0 space-y-3 border-t border-ironside/20 bg-[#fbf8f1]/95 p-4 backdrop-blur-sm sm:p-5'>
            <label className='flex items-start gap-2 text-sm text-[#173150]'>
              {/* Required accept control — never pre-checked (Track B draft). */}
              <input
                type='checkbox'
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className='mt-0.5 accent-[#173150]'
              />
              <span>
                I certify the permissible purpose and no-browse rules above and request that this
                driver authorize sharing EV material with my organization for this hiring context.
              </span>
            </label>
            {error && <p className='text-sm text-red-600'>{error}</p>}
            <div className='flex justify-end gap-2'>
              <Button
                type='button'
                variant='secondary'
                size='sm'
                onClick={() => setShowClickwrap(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type='button'
                variant='primary'
                size='sm'
                disabled={!accepted || submitting}
                onClick={submitRequest}
                className='inline-flex items-center gap-2'
              >
                {submitting && <Loader2 className='h-4 w-4 animate-spin' />}
                {submitting ? 'Submitting…' : 'Request Share'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
