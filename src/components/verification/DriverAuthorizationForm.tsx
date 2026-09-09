'use client'

import { useEffect, useState } from 'react'
import { DOT_PAPER_CARD, DOT_PAPER_INPUT } from '@/lib/dot-form-paper'
import Button from '@/components/ui/Button'
import { PhoneInput } from '@/components/ui/MaskedInputs'
import type { CandidateEmploymentRow, EvApplicantIdentity } from '@/lib/candidate-employment-verification'
import { isDriverSendDeclined, shouldHoldEvSend } from '@/lib/candidate-employment-verification'
import type { VerificationRequest } from '@/types/employment-verification'
import { Ban, Loader2, Send } from 'lucide-react'
import {
  OfficialFormFooter,
  OfficialFormHeader,
  PaperLine,
  formatDob,
  paperDate,
  todayIso,
} from './ev-paper-shared'

export default function DriverAuthorizationForm({
  applicant,
  employment,
  request,
  sending,
  declining = false,
  onSend,
  onDecline,
}: {
  applicant: EvApplicantIdentity
  employment: CandidateEmploymentRow
  request?: VerificationRequest
  sending: boolean
  declining?: boolean
  onSend: (contact: { email: string; phone: string; signature: string; date: string }) => void
  onDecline?: () => void
}) {
  const holdDefault = shouldHoldEvSend(employment)
  const [email, setEmail] = useState(employment.supervisorEmail ?? '')
  const [phone, setPhone] = useState(employment.supervisorPhone ?? '')
  const [address, setAddress] = useState(employment.location ?? '')
  const [signature, setSignature] = useState('')
  const [signatureDate, setSignatureDate] = useState(todayIso())
  const [agreeSend, setAgreeSend] = useState(false)
  const [agreeDecline, setAgreeDecline] = useState(false)
  const [doNotSend, setDoNotSend] = useState(holdDefault)

  useEffect(() => {
    setEmail(employment.supervisorEmail ?? '')
    setPhone(employment.supervisorPhone ?? '')
    setAddress(employment.location ?? '')
    setSignature('')
    setSignatureDate(todayIso())
    setAgreeSend(false)
    setAgreeDecline(false)
    setDoNotSend(shouldHoldEvSend(employment))
  }, [employment.verificationKey, employment.supervisorEmail, employment.supervisorPhone, employment.location])

  const hasReply = Boolean(
    request?.answers ||
      request?.status === 'VERIFIED' ||
      request?.status === 'PARTIALLY_VERIFIED' ||
      request?.status === 'VERIFICATION_DENIED',
  )
  const sent = Boolean(
    request &&
      (request.status === 'VERIFICATION_REQUESTED' ||
        request.status === 'VERIFICATION_IN_PROGRESS' ||
        hasReply),
  )
  const canSend = Boolean(
    !sent &&
      !doNotSend &&
      signature.trim() &&
      signatureDate &&
      agreeSend &&
      (email.trim() || phone.trim()),
  )

  return (
    <div className={`${DOT_PAPER_CARD} border-t-4 border-ember p-5 sm:p-8`}>
      <OfficialFormHeader page={1} />

      <section>
        <h3 className='mb-4 text-lg font-semibold'>Section 1 – Driver/Applicant Authorization</h3>

        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
          <PaperLine label='Driver Name:' value={applicant.driverName} />
          <PaperLine
            label='SSN (optional):'
            value={applicant.ssnLastFour ? `XXX-XX-${applicant.ssnLastFour}` : ''}
          />
          <PaperLine label='Date of Birth:' value={formatDob(applicant.dateOfBirth)} />
          <PaperLine label='Previous Employer:' value={employment.companyName} />
        </div>

        <div className='mt-4'>
          {sent ? (
            <PaperLine label='Employer Address:' value={address} />
          ) : (
            <div>
              <label className='text-sm font-medium text-[#173150]'>Employer Address:</label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={2}
                className={`mt-0.5 w-full ${DOT_PAPER_INPUT} px-3 py-2 text-sm`}
              />
            </div>
          )}
        </div>

        <div className='mt-4 flex flex-wrap items-end gap-4'>
          <span className='text-sm font-medium text-[#173150]'>Employment Dates:</span>
          <PaperLine
            label='From'
            value={paperDate(employment.startDate)}
            className='min-w-[7rem] flex-1'
          />
          <PaperLine
            label='To'
            value={paperDate(employment.endDate) || 'Present'}
            className='min-w-[7rem] flex-1'
          />
        </div>

        <div className='mt-4'>
          <PaperLine label='Position Held:' value={employment.position} />
        </div>

        <p className='mt-5 text-sm leading-relaxed text-[#173150]'>
          I hereby authorize you to release all information on my employment, accident, and safety
          performance history, including any alcohol and controlled substances testing information,
          in accordance with 49 CFR § 391.23. I understand that I have the right to review this
          information, request correction of errors, and have a copy furnished to me.
        </p>

        <div className='mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2'>
          <div>
            <label className='text-sm font-medium text-[#173150]'>Driver Signature:</label>
            <input
              type='text'
              value={sent ? applicant.driverName || 'Signed when sent' : signature}
              onChange={(e) => setSignature(e.target.value)}
              disabled={sent}
              placeholder='Type your full name'
              className='mt-0.5 w-full border-0 border-b border-[#173150] bg-transparent px-0 py-1.5 text-sm text-[#173150]'
            />
          </div>
          <div>
            <label className='text-sm font-medium text-[#173150]'>Date:</label>
            <input
              type='date'
              value={sent ? (request?.createdAt ?? signatureDate).slice(0, 10) : signatureDate}
              onChange={(e) => setSignatureDate(e.target.value)}
              disabled={sent}
              className='mt-0.5 w-full border-0 border-b border-[#173150] bg-transparent px-0 py-1.5 text-sm text-[#173150]'
            />
          </div>
        </div>
      </section>

      {!sent && (
        <div className='mt-8 space-y-3 border-t border-[#173150]/20 pt-5'>
          <p className='text-xs text-[#173150]/60'>
            Provven send — not part of the printed form. This page is for {employment.companyName}{' '}
            only.
          </p>
          <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
            <div>
              <label className='text-sm font-medium text-[#173150]'>Previous employer email</label>
              <input
                type='email'
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder='hr@previous-employer.com'
                className={`mt-0.5 w-full ${DOT_PAPER_INPUT} px-3 py-2 text-sm`}
              />
            </div>
            <div>
              <label className='text-sm font-medium text-[#173150]'>Phone (optional)</label>
              <PhoneInput
                value={phone}
                onChange={setPhone}
                className={`mt-0.5 w-full ${DOT_PAPER_INPUT} px-3 py-2 text-sm`}
              />
            </div>
          </div>

          {isDriverSendDeclined(request) && (
            <p className='rounded-lg border border-dark-amber/30 bg-white px-3 py-2 text-xs text-[#173150]/80'>
              You declined to send this to {employment.companyName} on{' '}
              {paperDate(request?.createdAt)}. That choice is on file. You can still send if you
              change your mind.
            </p>
          )}

          {holdDefault && (
            <label className='flex items-start gap-2 rounded-lg border border-dark-amber/30 bg-white px-3 py-2 text-sm'>
              <input
                type='checkbox'
                checked={doNotSend}
                onChange={(e) => {
                  setDoNotSend(e.target.checked)
                  if (e.target.checked) setAgreeSend(false)
                }}
                className='mt-0.5 accent-[#173150]'
              />
              <span>
                Do not send this to my current employer. Uncheck only if you want them contacted
                (for example, a layoff).
              </span>
            </label>
          )}

          <label className='flex items-start gap-2 text-sm'>
            <input
              type='checkbox'
              checked={agreeSend}
              onChange={(e) => {
                setAgreeSend(e.target.checked)
                if (e.target.checked) setAgreeDecline(false)
              }}
              disabled={doNotSend}
              className='mt-0.5 accent-[#173150]'
            />
            <span>
              I agree to send this authorization and Safety Performance History request through
              Provven, using my email on file ({applicant.email || 'add an email on your profile'})
              as the driver contact.
            </span>
          </label>

          <label className='flex items-start gap-2 text-sm'>
            <input
              type='checkbox'
              checked={agreeDecline}
              onChange={(e) => {
                setAgreeDecline(e.target.checked)
                if (e.target.checked) setAgreeSend(false)
              }}
              className='mt-0.5 accent-[#173150]'
            />
            <span>
              I decline to send this request to {employment.companyName}. This stays on file and
              does not complete the verification.
            </span>
          </label>

          <div className='flex flex-wrap gap-2'>
            <Button
              type='button'
              variant='primary'
              size='sm'
              disabled={!canSend || sending || declining}
              onClick={() => onSend({ email, phone, signature, date: signatureDate })}
              className='inline-flex items-center gap-2'
            >
              {sending ? <Loader2 className='h-4 w-4 animate-spin' /> : <Send className='h-4 w-4' />}
              {sending ? 'Sending…' : 'Send employment verification'}
            </Button>
            {onDecline && (
              <Button
                type='button'
                variant='secondary'
                size='sm'
                disabled={!agreeDecline || sending || declining}
                onClick={onDecline}
                className='inline-flex items-center gap-2'
              >
                {declining ? (
                  <Loader2 className='h-4 w-4 animate-spin' />
                ) : (
                  <Ban className='h-4 w-4' />
                )}
                {declining ? 'Saving…' : 'Decline to send'}
              </Button>
            )}
          </div>
        </div>
      )}

      <OfficialFormFooter />
    </div>
  )
}
