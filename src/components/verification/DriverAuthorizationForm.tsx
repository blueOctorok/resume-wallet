'use client'

import { useEffect, useState } from 'react'
import { DOT_PAPER_CARD, DOT_PAPER_INPUT } from '@/lib/dot-form-paper'
import Button from '@/components/ui/Button'
import { PhoneInput } from '@/components/ui/MaskedInputs'
import type { CandidateEmploymentRow, EvApplicantIdentity } from '@/lib/candidate-employment-verification'
import { isDriverSendDeclined, shouldHoldEvSend } from '@/lib/candidate-employment-verification'
import type { VerificationRequest } from '@/types/employment-verification'
import { Ban, Loader2, Send } from 'lucide-react'
import { OfficialFormFooter, PaperLine, formatDob, paperDate, todayIso } from './ev-paper-shared'

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
  const [authorizeSph, setAuthorizeSph] = useState(false)
  const [authorizeDa, setAuthorizeDa] = useState(false)
  const [agreeSend, setAgreeSend] = useState(false)
  const [agreeDecline, setAgreeDecline] = useState(false)
  const [doNotSend, setDoNotSend] = useState(holdDefault)

  useEffect(() => {
    setEmail(employment.supervisorEmail ?? '')
    setPhone(employment.supervisorPhone ?? '')
    setAddress(employment.location ?? '')
    setSignature('')
    setSignatureDate(todayIso())
    setAuthorizeSph(false)
    setAuthorizeDa(false)
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
      authorizeSph &&
      authorizeDa &&
      agreeSend &&
      (email.trim() || phone.trim()),
  )

  return (
    <div className={`${DOT_PAPER_CARD} border-t-4 border-ember p-5 sm:p-8`}>
      <header className='mb-6 border-b border-[#173150]/25 pb-4 text-center'>
        <h2 className='text-xl font-bold tracking-tight sm:text-2xl'>
          Driver Authorization to Release DOT Information
        </h2>
        <p className='mt-1 text-sm text-[#173150]/55'>49 CFR § 391.23 and § 40.25 · Page 1 of 2</p>
      </header>

      <section>
        <h3 className='mb-4 text-lg font-semibold'>Part 1 — Applicant Identification</h3>
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
          <PaperLine label='Driver Name:' value={applicant.driverName} />
          <PaperLine
            label='SSN (optional):'
            value={applicant.ssnLastFour ? `XXX-XX-${applicant.ssnLastFour}` : ''}
          />
          <PaperLine label='Date of Birth:' value={formatDob(applicant.dateOfBirth)} />
        </div>
      </section>

      <section className='mt-8 border-t border-[#173150]/25 pt-6'>
        <h3 className='mb-4 text-lg font-semibold'>Part 2 — Previous Employer to Contact</h3>
        <PaperLine label='Previous Employer:' value={employment.companyName} />
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
        {sent && (
          <div className='mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <PaperLine label='Email:' value={email} />
            <PaperLine label='Telephone:' value={phone} />
          </div>
        )}
        {!sent && (
          <div className='mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2'>
            <div>
              <label className='text-sm font-medium text-[#173150]'>Email:</label>
              <input
                type='email'
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder='hr@previous-employer.com'
                className={`mt-0.5 w-full ${DOT_PAPER_INPUT} px-3 py-2 text-sm`}
              />
            </div>
            <div>
              <label className='text-sm font-medium text-[#173150]'>Telephone:</label>
              <PhoneInput
                value={phone}
                onChange={setPhone}
                className={`mt-0.5 w-full ${DOT_PAPER_INPUT} px-3 py-2 text-sm`}
              />
            </div>
          </div>
        )}
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
      </section>

      <section className='mt-8 border-t border-[#173150]/25 pt-6'>
        <h3 className='mb-4 text-lg font-semibold'>
          Part 3 — Release of Safety Performance History (49 CFR § 391.23)
        </h3>
        <p className='text-sm leading-relaxed text-[#173150]'>
          I hereby authorize the previous employer named above to release all information on my
          employment, accident, and safety performance history, in accordance with 49 CFR § 391.23. I
          understand that I have the right to:
        </p>
        <ul className='mt-2 list-disc space-y-1 pl-5 text-sm text-[#173150]'>
          <li>Review information provided by current/previous employers;</li>
          <li>
            Have errors in the information corrected by previous employers, and for those previous
            employers to resend the corrected information to the prospective employer; and
          </li>
          <li>
            Have a rebuttal statement attached to the alleged erroneous information, if the previous
            employer(s) and I cannot agree on the accuracy of the information.
          </li>
        </ul>
        <label className='mt-4 flex items-start gap-2 text-sm'>
          <input
            type='checkbox'
            checked={sent || authorizeSph}
            onChange={(e) => setAuthorizeSph(e.target.checked)}
            disabled={sent}
            className='mt-0.5 accent-[#173150]'
          />
          <span>I authorize release of my safety performance history (49 CFR § 391.23).</span>
        </label>
      </section>

      <section className='mt-8 border-t border-[#173150]/25 pt-6'>
        <h3 className='mb-4 text-lg font-semibold'>
          Part 4 — Release of Alcohol and Controlled Substances Records (49 CFR § 40.25)
        </h3>
        <p className='text-sm leading-relaxed text-[#173150]'>
          I hereby authorize the previous employer named above to release and forward my Alcohol and
          Controlled Substances Testing records within the previous 3 years, as requested in Part 4 of
          the Safety Performance History Records Request, in accordance with 49 CFR § 40.25 and §
          391.23(e).
        </p>
        <p className='mt-3 text-sm leading-relaxed text-[#173150]'>
          In compliance with § 40.25(g) and § 391.23(h), release of this information must be made in a
          written form that ensures confidentiality, such as fax, email, or letter.
        </p>
        <label className='mt-4 flex items-start gap-2 text-sm'>
          <input
            type='checkbox'
            checked={sent || authorizeDa}
            onChange={(e) => setAuthorizeDa(e.target.checked)}
            disabled={sent}
            className='mt-0.5 accent-[#173150]'
          />
          <span>
            I authorize release of my DOT alcohol and controlled substances testing records (49 CFR §
            40.25).
          </span>
        </label>
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
            Provven send — not part of the printed form. This authorization is for{' '}
            {employment.companyName} only.
          </p>

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
              I agree to send this authorization through Provven, using my email on file (
              {applicant.email || 'add an email on your profile'}) as the driver contact.
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
