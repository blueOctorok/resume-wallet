'use client'

import { useState } from 'react'
import { CheckCircle2, Download, Loader2, MailWarning, Search } from 'lucide-react'
import Button from '@/components/ui/Button'
import { useEmploymentVerificationBlockStore } from '@/stores/employment-verification-block-store'
import type {
  AttemptDeliveryStatus,
  VerificationAttempt,
  VerificationRequest,
} from '@/types/employment-verification'

const MAX_ATTEMPTS = 3

const DELIVERY_PILL: Record<AttemptDeliveryStatus, { label: string; className: string }> = {
  sent: { label: 'Sent', className: 'bg-ironside/15 text-[#173150]' },
  delivered: { label: 'Delivered', className: 'bg-retro-teal/15 text-retro-teal' },
  opened: { label: 'Opened', className: 'bg-retro-teal/20 text-retro-teal' },
  clicked: { label: 'Link clicked', className: 'bg-teal-500/15 text-teal-600' },
  failed: { label: 'Bounced', className: 'bg-red-100 text-red-700' },
}

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

interface EvOutreachStatusProps {
  request: VerificationRequest
  attempts: VerificationAttempt[]
}

/**
 * Driver-facing outreach panel for one EV packet: what went out, what the
 * mail provider reported, what happens next, and — when there is no working
 * contact — the FMCSA / web-search proposals the driver confirms before send.
 */
export default function EvOutreachStatus({ request, attempts }: EvOutreachStatusProps) {
  const actingOnRequestId = useEmploymentVerificationBlockStore((s) => s.actingOnRequestId)
  const resend = useEmploymentVerificationBlockStore((s) => s.resend)
  const researchContact = useEmploymentVerificationBlockStore((s) => s.researchContact)
  const setContact = useEmploymentVerificationBlockStore((s) => s.setContact)

  const [manualEmail, setManualEmail] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)

  const busy = actingOnRequestId === request.id
  const exhausted = request.status === 'ATTEMPTS_EXHAUSTED'
  const lastBounced = attempts.at(-1)?.deliveryStatus === 'failed'
  const needsContact =
    !exhausted && (request.contactResearchStatus === 'pending' || !request.previousEmployerEmail)
  const research = request.contactResearch
  const canSendNow = !exhausted && !needsContact && request.attemptCount < MAX_ATTEMPTS

  const run = async (action: () => Promise<{ ok: boolean; message?: string; error?: string }>) => {
    setFeedback(null)
    const result = await action()
    setFeedback(result.ok ? (result.message ?? null) : (result.error ?? 'Something went wrong'))
  }

  return (
    <div className='mb-4 space-y-3 rounded-lg border border-[#173150]/15 bg-white/80 p-3 text-xs text-[#173150]'>
      {/* Attempt timeline */}
      {attempts.length > 0 ? (
        <ol className='space-y-1.5'>
          {attempts.map((a) => {
            const pill = DELIVERY_PILL[a.deliveryStatus]
            return (
              <li key={a.id} className='flex flex-wrap items-center gap-2'>
                <span className='font-medium'>
                  #{a.attemptNumber} · {shortDate(a.sentAt)}
                </span>
                <span className='truncate text-[#173150]/60'>{a.contactEmail ?? a.contactPhone ?? '—'}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${pill.className}`}>
                  {pill.label}
                </span>
                {a.triggeredBy === 'cron' && <span className='text-[10px] text-ironside'>auto follow-up</span>}
              </li>
            )
          })}
        </ol>
      ) : (
        <p className='text-[#173150]/70'>Nothing has been sent yet.</p>
      )}

      {/* Next step */}
      {exhausted ? (
        <div className='flex flex-wrap items-center justify-between gap-2 border-t border-[#173150]/10 pt-3'>
          <span className='text-[#173150]/75'>
            No reply after {attempts.length} attempts. Your attempt record documents the good-faith
            effort for a future carrier.
          </span>
          <a
            href={`/api/candidate/verification/${request.id}/attempt-record`}
            className='inline-flex items-center gap-1.5 rounded-lg border border-[#173150]/30 px-3 py-1.5 font-medium hover:bg-[#173150] hover:text-[#fbf8f1]'
          >
            <Download className='h-3.5 w-3.5' /> Attempt record (PDF)
          </a>
        </div>
      ) : needsContact ? (
        <div className='space-y-3 border-t border-[#173150]/10 pt-3'>
          <p className='flex items-start gap-2'>
            <MailWarning className='mt-0.5 h-4 w-4 shrink-0 text-dark-amber' />
            <span>
              {lastBounced
                ? `The last email to ${attempts.at(-1)?.contactEmail} bounced. Follow-ups are paused until you confirm a working contact.`
                : 'We need a working contact before this packet can go out. Confirm one below — nothing is sent to a looked-up address until you approve it.'}
            </span>
          </p>

          {research?.fmcsa.length ? (
            <div className='space-y-1'>
              <p className='font-medium'>FMCSA registry match</p>
              {research.fmcsa.map((c) => (
                <p key={c.dotNumber} className='text-[#173150]/75'>
                  {c.legalName}
                  {c.dbaName ? ` (dba ${c.dbaName})` : ''} · USDOT {c.dotNumber}
                  {c.phone ? ` · ${c.phone}` : ''}
                  {c.address ? ` · ${c.address}` : ''}
                </p>
              ))}
            </div>
          ) : null}

          {research?.emailCandidates.length ? (
            <div className='space-y-1.5'>
              <p className='font-medium'>Email addresses found online</p>
              {research.emailCandidates.map((c) => (
                <div key={c.email} className='flex flex-wrap items-center gap-2'>
                  <span>{c.email}</span>
                  <span className='rounded-full bg-ironside/15 px-2 py-0.5 text-[10px]'>{c.confidence} confidence</span>
                  {c.sourceUrl && (
                    <a href={c.sourceUrl} target='_blank' rel='noreferrer' className='text-[10px] underline'>
                      source
                    </a>
                  )}
                  <Button
                    type='button'
                    size='sm'
                    variant='secondary'
                    disabled={busy}
                    onClick={() => run(() => setContact(request.id, { email: c.email }))}
                  >
                    Use & send
                  </Button>
                </div>
              ))}
            </div>
          ) : null}

          {request.contactResearchStatus === 'not_found' && (
            <p className='text-[#173150]/60'>No public contact found for this carrier. Enter one you know below.</p>
          )}

          <div className='flex flex-wrap items-center gap-2'>
            <input
              type='email'
              value={manualEmail}
              onChange={(e) => setManualEmail(e.target.value)}
              placeholder='safety@carrier.com'
              className='min-w-[14rem] flex-1 rounded-lg border border-ironside/40 bg-white px-3 py-1.5 text-xs'
            />
            <Button
              type='button'
              size='sm'
              disabled={busy || !manualEmail.trim()}
              onClick={() => run(() => setContact(request.id, { email: manualEmail.trim() }))}
            >
              Save & send
            </Button>
            <Button
              type='button'
              size='sm'
              variant='ghost'
              disabled={busy}
              onClick={() => run(() => researchContact(request.id))}
              className='inline-flex items-center gap-1.5'
            >
              {busy ? <Loader2 className='h-3.5 w-3.5 animate-spin' /> : <Search className='h-3.5 w-3.5' />}
              {research ? 'Look up again' : 'Look up carrier'}
            </Button>
          </div>
        </div>
      ) : (
        <div className='flex flex-wrap items-center justify-between gap-2 border-t border-[#173150]/10 pt-3'>
          <span className='flex items-center gap-1.5 text-[#173150]/75'>
            <CheckCircle2 className='h-3.5 w-3.5 text-retro-teal' />
            {request.attemptCount >= MAX_ATTEMPTS
              ? 'Final attempt sent. We wait a week for a reply before closing this out.'
              : request.nextAttemptAt
                ? `Follow-up ${request.attemptCount + 1} of ${MAX_ATTEMPTS} scheduled for ${shortDate(request.nextAttemptAt)}.`
                : 'Waiting on a reply.'}
          </span>
          {canSendNow && (
            <Button
              type='button'
              variant='secondary'
              size='sm'
              disabled={busy}
              onClick={() => run(() => resend(request.id))}
            >
              Send now ({MAX_ATTEMPTS - request.attemptCount} left)
            </Button>
          )}
        </div>
      )}

      {feedback && <p className='text-[#173150]/70'>{feedback}</p>}
    </div>
  )
}
