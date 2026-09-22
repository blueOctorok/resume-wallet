'use client'

import { useEffect, useState } from 'react'
import {
  useEmploymentVerificationBlockStore,
  type EvShareRequestItem,
} from '@/stores/employment-verification-block-store'
import Modal, { ModalHeader } from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import EvConsentDocumentView from './EvConsentDocumentView'
import {
  EV_SHARE_ACKNOWLEDGMENT,
  resolveEvDocument,
  substituteTokens,
} from '@/lib/ev-consent-documents'
import { Building2, Loader2 } from 'lucide-react'

const STATUS_LABEL: Record<EvShareRequestItem['status'], string> = {
  pending: 'Awaiting your decision',
  authorized: 'Shared',
  declined: 'Declined',
  revoked: 'Access revoked',
  expired: 'Expired',
}

/**
 * Step 6 queue (docs/EV_CONSENT_STACK.md): employer share requests for this
 * driver. Each pending request opens the formal acknowledgment — named
 * employer, context, payload, unchecked accept box, Authorize Share / Decline.
 * Authorized requests show a Revoke control (forward-only, v0.1 rule).
 */
export default function EvShareRequestsPanel() {
  const shareRequests = useEmploymentVerificationBlockStore((s) => s.shareRequests)
  const fetchShareRequests = useEmploymentVerificationBlockStore((s) => s.fetchShareRequests)
  const [ackRequest, setAckRequest] = useState<EvShareRequestItem | null>(null)
  const [accepted, setAccepted] = useState(false)
  const [actingId, setActingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void fetchShareRequests()
  }, [fetchShareRequests])

  const respond = async (requestId: string, action: 'authorize' | 'decline') => {
    setActingId(requestId)
    setError(null)
    try {
      const res = await fetch(`/api/candidate/verification/share-requests/${requestId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          ...(action === 'authorize' ? { checkboxEventId: crypto.randomUUID() } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to save your decision')
        return
      }
      setAckRequest(null)
      setAccepted(false)
      void fetchShareRequests()
    } catch {
      setError('Failed to save your decision')
    } finally {
      setActingId(null)
    }
  }

  const revoke = async (grantId: string, requestId: string) => {
    setActingId(requestId)
    try {
      await fetch(`/api/candidate/verification/share-grants/${grantId}/revoke`, { method: 'POST' })
      void fetchShareRequests()
    } finally {
      setActingId(null)
    }
  }

  if (shareRequests.length === 0) return null

  const payloadDescription = 'Proof summary only (default)'

  return (
    <div className='mt-6 rounded-xl border border-ironside/25 bg-white/70 p-4'>
      <h3 className='mb-1 text-sm font-semibold text-[#173150]'>Employer share requests</h3>
      <p className='mb-3 text-xs text-[#173150]/65'>
        Employers asking to view your Employment Verification. Nothing is shared until you
        authorize each named employer — you can also decline.
      </p>
      <ul className='space-y-2'>
        {shareRequests.map((req) => (
          <li
            key={req.id}
            className='flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ironside/20 bg-white px-3 py-2'
          >
            <div className='min-w-0'>
              <p className='flex items-center gap-1.5 text-sm font-medium text-[#173150]'>
                <Building2 className='h-3.5 w-3.5 shrink-0 text-[#173150]/60' />
                {req.companyName}
              </p>
              <p className='text-xs text-[#173150]/60'>
                {req.applicationContext} · {STATUS_LABEL[req.status]}
              </p>
            </div>
            <div className='flex gap-2'>
              {req.status === 'pending' && (
                <Button
                  type='button'
                  variant='primary'
                  size='sm'
                  disabled={actingId !== null}
                  onClick={() => {
                    setAccepted(false)
                    setError(null)
                    setAckRequest(req)
                  }}
                >
                  Review request
                </Button>
              )}
              {req.status === 'authorized' && req.grantId && (
                <Button
                  type='button'
                  variant='secondary'
                  size='sm'
                  disabled={actingId === req.id}
                  onClick={() => revoke(req.grantId as string, req.id)}
                  className='inline-flex items-center gap-2'
                >
                  {actingId === req.id && <Loader2 className='h-4 w-4 animate-spin' />}
                  Revoke access
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {ackRequest && (
        <Modal
          onClose={() => setAckRequest(null)}
          maxWidth='max-w-2xl'
          panelShape='block'
          paper
          zIndex={1100}
        >
          <ModalHeader
            title={EV_SHARE_ACKNOWLEDGMENT.title}
            subtitle={`${ackRequest.companyName} · ${ackRequest.applicationContext} · ${payloadDescription}`}
            onClose={() => setAckRequest(null)}
            variant='block'
            paper
          />
          <div className='max-h-[55vh] overflow-y-auto p-4 sm:p-6'>
            <EvConsentDocumentView
              document={resolveEvDocument(EV_SHARE_ACKNOWLEDGMENT, {
                employerLegalName: ackRequest.companyName,
                payloadDescription,
              })}
            />
          </div>
          <div className='sticky bottom-0 space-y-3 border-t border-ironside/20 bg-[#fbf8f1]/95 p-4 backdrop-blur-sm sm:p-5'>
            <label className='flex items-start gap-2 text-sm text-[#173150]'>
              {/* Required accept control — never pre-checked, never a silent toggle. */}
              <input
                type='checkbox'
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className='mt-0.5 accent-[#173150]'
              />
              <span>
                {substituteTokens(EV_SHARE_ACKNOWLEDGMENT.checkboxLabel ?? '', {
                  employerLegalName: ackRequest.companyName,
                })}
              </span>
            </label>
            {error && <p className='text-sm text-red-600'>{error}</p>}
            <div className='flex flex-wrap justify-end gap-2'>
              <Button
                type='button'
                variant='secondary'
                size='sm'
                disabled={actingId !== null}
                onClick={() => respond(ackRequest.id, 'decline')}
              >
                Decline
              </Button>
              <Button
                type='button'
                variant='primary'
                size='sm'
                disabled={!accepted || actingId !== null}
                onClick={() => respond(ackRequest.id, 'authorize')}
                className='inline-flex items-center gap-2'
              >
                {actingId === ackRequest.id && <Loader2 className='h-4 w-4 animate-spin' />}
                {EV_SHARE_ACKNOWLEDGMENT.primaryCta}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
