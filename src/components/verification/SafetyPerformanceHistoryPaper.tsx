'use client'

import { useEffect, useState } from 'react'
import { DOT_PAPER_INPUT } from '@/lib/dot-form-paper'
import Button from '@/components/ui/Button'
import { PhoneInput } from '@/components/ui/MaskedInputs'
import type { CandidateEmploymentRow, EvApplicantIdentity } from '@/lib/candidate-employment-verification'
import {
  isDkimVerifiedRequest,
  shouldHoldEvSend,
} from '@/lib/candidate-employment-verification'
import type { VerificationRequest } from '@/types/employment-verification'
import { Loader2, Send } from 'lucide-react'

function paperDate(value: string | null | undefined): string {
  if (!value) return 'Present'
  const ym = value.match(/^(\d{4})-(\d{2})/)
  if (ym) return `${ym[2]}/${ym[1]}`
  return value
}

function formatDob(value: string): string {
  if (!value) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-')
    return `${m}/${d}/${y}`
  }
  return value
}

function PaperLine({
  label,
  value,
  className = '',
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div className={className}>
      <span className='text-[11px] font-semibold uppercase tracking-wide text-[#173150]/65'>
        {label}
      </span>
      <p className='mt-0.5 min-h-7 border-b border-[#173150]/35 pb-0.5 text-sm font-medium text-[#173150]'>
        {value || '\u00a0'}
      </p>
    </div>
  )
}

function Check({ checked, label }: { checked: boolean; label: string }) {
  return (
    <span className='inline-flex items-center gap-1.5 text-sm text-[#173150]'>
      <span
        className={`inline-flex h-3.5 w-3.5 items-center justify-center border border-[#173150] text-[9px] ${
          checked ? 'bg-[#173150] text-[#fbf8f1]' : 'bg-white'
        }`}
      >
        {checked ? '✓' : ''}
      </span>
      {label}
    </span>
  )
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function SafetyPerformanceHistoryPaper({
  applicant,
  employment,
  request,
  sending,
  onSend,
}: {
  applicant: EvApplicantIdentity
  employment: CandidateEmploymentRow
  request?: VerificationRequest
  sending: boolean
  onSend: (contact: { email: string; phone: string; signature: string; date: string }) => void
}) {
  const holdDefault = shouldHoldEvSend(employment)
  const [email, setEmail] = useState(employment.supervisorEmail ?? '')
  const [phone, setPhone] = useState(employment.supervisorPhone ?? '')
  const [address, setAddress] = useState(employment.location ?? '')
  const [signature, setSignature] = useState('')
  const [signatureDate, setSignatureDate] = useState(todayIso())
  const [agreeSend, setAgreeSend] = useState(false)
  const [doNotSend, setDoNotSend] = useState(holdDefault)

  useEffect(() => {
    setEmail(employment.supervisorEmail ?? '')
    setPhone(employment.supervisorPhone ?? '')
    setAddress(employment.location ?? '')
    setSignature('')
    setSignatureDate(todayIso())
    setAgreeSend(false)
    setDoNotSend(shouldHoldEvSend(employment))
  }, [employment.verificationKey, employment.supervisorEmail, employment.supervisorPhone, employment.location])

  const dkimVerified = isDkimVerifiedRequest(request)
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
  const answers = request?.answers
  const verifiedDatesFrom =
    answers?.datesCorrect === 'partial' && answers.correctedStartDate
      ? answers.correctedStartDate
      : request?.claimedStartDate ?? employment.startDate
  const verifiedDatesTo =
    answers?.datesCorrect === 'partial' && answers.correctedEndDate
      ? answers.correctedEndDate
      : request?.claimedEndDate ?? employment.endDate

  const canSend = Boolean(
    !sent &&
      !doNotSend &&
      signature.trim() &&
      signatureDate &&
      agreeSend &&
      (email.trim() || phone.trim()),
  )

  return (
    <div className='space-y-6 text-[#173150] [color-scheme:light]'>
      <header className='border-b border-[#173150]/20 pb-4 text-center'>
        <h2 className='text-lg font-semibold tracking-tight sm:text-xl'>
          Safety Performance History Records Request
        </h2>
        <p className='mt-0.5 text-sm text-[#173150]/70'>(Employment Verification)</p>
        <p className='mt-1 text-xs text-[#173150]/55'>Required by 49 CFR § 391.23</p>
      </header>

      <p className='rounded-lg border border-[#173150]/15 bg-white/70 px-3 py-2 text-xs text-[#173150]/75'>
        Section 1 is from your DOT application and profile — self-reported, not verified. Section 2
        is for the previous employer. A reply is verified only when DKIM on that email passes.
      </p>

      <section>
        <h3 className='mb-3 border-b border-[#173150]/25 pb-1 text-sm font-semibold uppercase tracking-wide'>
          Section 1 – Driver/Applicant Authorization
        </h3>
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
          <PaperLine label='Driver Name' value={applicant.driverName} />
          <PaperLine
            label='SSN (optional)'
            value={applicant.ssnLastFour ? `XXX-XX-${applicant.ssnLastFour}` : ''}
          />
          <PaperLine label='Date of Birth' value={formatDob(applicant.dateOfBirth)} />
          <PaperLine label='Previous Employer' value={employment.companyName} />
        </div>
        <div className='mt-4'>
          {sent ? (
            <PaperLine label='Employer Address' value={address} />
          ) : (
            <div>
              <label className='text-[11px] font-semibold uppercase tracking-wide text-[#173150]/65'>
                Employer Address
              </label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={2}
                className={`mt-0.5 w-full ${DOT_PAPER_INPUT} px-3 py-2 text-sm`}
              />
            </div>
          )}
        </div>
        <div className='mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3'>
          <PaperLine label='Employment Dates From' value={paperDate(employment.startDate)} />
          <PaperLine label='Employment Dates To' value={paperDate(employment.endDate)} />
          <PaperLine label='Position Held' value={employment.position} />
        </div>

        <p className='mt-4 text-sm leading-relaxed text-[#173150]/90'>
          I hereby authorize you to release all information on my employment, accident, and safety
          performance history, including any alcohol and controlled substances testing information,
          in accordance with 49 CFR § 391.23. I understand that I have the right to review this
          information, request correction of errors, and have a copy furnished to me.
        </p>

        <div className='mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2'>
          <div>
            <label className='text-[11px] font-semibold uppercase tracking-wide text-[#173150]/65'>
              Driver Signature
            </label>
            <input
              type='text'
              value={sent ? applicant.driverName || 'Signed when sent' : signature}
              onChange={(e) => setSignature(e.target.value)}
              disabled={sent}
              placeholder='Type your full name'
              className='mt-0.5 w-full border-0 border-b border-[#173150]/35 bg-transparent px-0 py-1.5 text-sm text-[#173150]'
            />
          </div>
          <div>
            <label className='text-[11px] font-semibold uppercase tracking-wide text-[#173150]/65'>
              Date
            </label>
            <input
              type='date'
              value={sent ? (request?.createdAt ?? signatureDate).slice(0, 10) : signatureDate}
              onChange={(e) => setSignatureDate(e.target.value)}
              disabled={sent}
              className='mt-0.5 w-full border-0 border-b border-[#173150]/35 bg-transparent px-0 py-1.5 text-sm text-[#173150]'
            />
          </div>
        </div>

        {!sent && (
          <div className='mt-4 space-y-3'>
            <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
              <div>
                <label className='text-[11px] font-semibold uppercase tracking-wide text-[#173150]/65'>
                  Previous employer email
                </label>
                <input
                  type='email'
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder='hr@previous-employer.com'
                  className={`mt-0.5 w-full ${DOT_PAPER_INPUT} px-3 py-2 text-sm`}
                />
              </div>
              <div>
                <label className='text-[11px] font-semibold uppercase tracking-wide text-[#173150]/65'>
                  Phone (optional)
                </label>
                <PhoneInput
                  value={phone}
                  onChange={setPhone}
                  className={`mt-0.5 w-full ${DOT_PAPER_INPUT} px-3 py-2 text-sm`}
                />
              </div>
            </div>

            {holdDefault && (
              <label className='flex items-start gap-2 rounded-lg border border-dark-amber/30 bg-white px-3 py-2 text-sm'>
                <input
                  type='checkbox'
                  checked={doNotSend}
                  onChange={(e) => setDoNotSend(e.target.checked)}
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
                onChange={(e) => setAgreeSend(e.target.checked)}
                disabled={doNotSend}
                className='mt-0.5 accent-[#173150]'
              />
              <span>
                I agree to send this authorization and Safety Performance History request through
                Provven, using my email on file ({applicant.email || 'add an email on your profile'})
                as the driver contact.
              </span>
            </label>

            <Button
              type='button'
              variant='primary'
              size='sm'
              disabled={!canSend || sending}
              onClick={() => onSend({ email, phone, signature, date: signatureDate })}
              className='inline-flex items-center gap-2'
            >
              {sending ? <Loader2 className='h-4 w-4 animate-spin' /> : <Send className='h-4 w-4' />}
              {sending ? 'Sending…' : 'Send employment verification'}
            </Button>
          </div>
        )}
      </section>

      <section>
        <h3 className='mb-3 border-b border-[#173150]/25 pb-1 text-sm font-semibold uppercase tracking-wide'>
          Section 2 – To Be Completed by Previous Employer
        </h3>

        {dkimVerified && (
          <p className='mb-3 rounded-lg border border-teal-600/25 bg-teal-50 px-3 py-2 text-xs text-teal-800'>
            Verified by Provven — DKIM passed
            {request?.dkimDomain ? ` for ${request.dkimDomain}` : ''}.
          </p>
        )}
        {hasReply && !dkimVerified && (
          <p className='mb-3 rounded-lg border border-dark-amber/30 bg-white px-3 py-2 text-xs text-[#173150]/75'>
            Previous employer replied. DKIM is not confirmed — this stays on file, not verified.
          </p>
        )}
        {!hasReply && (
          <p className='mb-3 text-xs text-[#173150]/55'>
            The previous employer fills this section. It stays blank until they reply.
          </p>
        )}

        <div className={!hasReply ? 'pointer-events-none opacity-55' : ''}>
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <PaperLine
              label='Company Name'
              value={hasReply ? (request?.previousEmployerName ?? employment.companyName) : ''}
            />
            <PaperLine label='Phone' value={hasReply ? (request?.previousEmployerPhone ?? '') : ''} />
            <PaperLine
              label='Address'
              value={hasReply ? (request?.previousEmployerAddress ?? '') : ''}
              className='sm:col-span-2'
            />
            <PaperLine label='Person Completing Form' value={hasReply ? (request?.verifiedByName ?? '') : ''} />
            <PaperLine label='Title' value={hasReply ? (request?.verifiedByTitle ?? '') : ''} />
            <PaperLine
              label='Date'
              value={hasReply && request?.verifiedAt ? paperDate(request.verifiedAt) : ''}
            />
          </div>

          <p className='mt-5 text-xs font-semibold uppercase tracking-wide text-[#173150]/65'>
            Employment Verification
          </p>
          <div className='mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <PaperLine label='Employment Dates From' value={hasReply ? paperDate(verifiedDatesFrom) : ''} />
            <PaperLine
              label='Employment Dates To'
              value={hasReply ? paperDate(verifiedDatesTo ?? null) : ''}
            />
            <PaperLine
              label='Position(s) Held'
              value={hasReply ? (request?.claimedPosition ?? employment.position) : ''}
              className='sm:col-span-2'
            />
          </div>
          <div className='mt-3 flex flex-wrap gap-4'>
            <span className='text-sm font-medium'>Eligible for Rehire?</span>
            <Check checked={hasReply && answers?.eligibleToReturn === 'yes'} label='Yes' />
            <Check checked={hasReply && answers?.eligibleToReturn === 'no'} label='No' />
            <Check
              checked={hasReply && answers?.eligibleToReturn === 'discuss'}
              label='Would Discuss'
            />
          </div>
          <div className='mt-3'>
            <PaperLine
              label='Reason for Leaving'
              value={
                hasReply
                  ? (answers?.terminationReason ||
                      answers?.returnNotes ||
                      request?.claimedReasonForLeaving ||
                      '')
                  : ''
              }
            />
          </div>

          <p className='mt-5 text-xs font-semibold uppercase tracking-wide text-[#173150]/65'>
            Accident History (Past 3 Years)
          </p>
          <div className='mt-2 overflow-x-auto'>
            <table className='w-full min-w-[32rem] border-collapse text-left text-xs'>
              <thead>
                <tr className='border-b border-[#173150]/25'>
                  {['Date', 'Location', 'Injuries', 'Fatalities', 'Hazmat Spill', 'Comments'].map(
                    (h) => (
                      <th key={h} className='px-2 py-1.5 font-semibold'>
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                <tr className='border-b border-[#173150]/15'>
                  <td className='px-2 py-2'>{hasReply && answers?.hadAccident === 'yes' ? 'Yes' : ''}</td>
                  <td className='px-2 py-2' />
                  <td className='px-2 py-2' />
                  <td className='px-2 py-2' />
                  <td className='px-2 py-2' />
                  <td className='px-2 py-2'>{hasReply ? (answers?.accidentDetails ?? '') : ''}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className='mt-2'>
            <Check
              checked={hasReply && answers?.hadAccident === 'no'}
              label='No DOT-recordable accidents reported.'
            />
          </div>

          <p className='mt-5 text-xs font-semibold uppercase tracking-wide text-[#173150]/65'>
            Drug and Alcohol (49 CFR § 40.25)
          </p>
          <div className='mt-2 space-y-2 text-sm'>
            <div className='flex flex-wrap gap-4'>
              <span className='font-medium'>Failed a Clearinghouse / post-accident test?</span>
              <Check checked={hasReply && answers?.failedClearinghouseTest === 'yes'} label='Yes' />
              <Check checked={hasReply && answers?.failedClearinghouseTest === 'no'} label='No' />
              <Check checked={hasReply && answers?.failedClearinghouseTest === 'na'} label='N/A' />
            </div>
            <PaperLine label='Notes' value={hasReply ? (answers?.clearinghouseNotes ?? '') : ''} />
            <div className='flex flex-wrap gap-4'>
              <span className='font-medium'>Random drug test or refused a test?</span>
              <Check checked={hasReply && answers?.randomDrugTestOrRefused === 'yes'} label='Yes' />
              <Check checked={hasReply && answers?.randomDrugTestOrRefused === 'no'} label='No' />
              <Check checked={hasReply && answers?.randomDrugTestOrRefused === 'na'} label='N/A' />
            </div>
            <PaperLine label='Details' value={hasReply ? (answers?.drugTestDetails ?? '') : ''} />
          </div>

          <p className='mt-5 text-xs leading-relaxed text-[#173150]/70'>
            Certification by Previous Employer — This information is provided in accordance with 49
            CFR § 391.23(d) and § 40.25(h).
          </p>
          <div className='mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <PaperLine label='Signature' value={hasReply ? (request?.verifiedByName ?? '') : ''} />
            <PaperLine label='Printed Name' value={hasReply ? (request?.verifiedByName ?? '') : ''} />
            <PaperLine label='Title' value={hasReply ? (request?.verifiedByTitle ?? '') : ''} />
            <PaperLine
              label='Date'
              value={hasReply && request?.verifiedAt ? paperDate(request.verifiedAt) : ''}
            />
          </div>
        </div>
      </section>

      <section>
        <h3 className='mb-3 border-b border-[#173150]/25 pb-1 text-sm font-semibold uppercase tracking-wide'>
          Section 3 – Record of Attempts
        </h3>
        <div className='overflow-x-auto'>
          <table className='w-full min-w-[24rem] border-collapse text-left text-xs'>
            <thead>
              <tr className='border-b border-[#173150]/25'>
                {['Date', 'Method', 'Contact Person', 'Result'].map((h) => (
                  <th key={h} className='px-2 py-1.5 font-semibold'>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {request ? (
                <tr className='border-b border-[#173150]/15'>
                  <td className='px-2 py-2'>{paperDate(request.lastAttemptAt ?? request.createdAt)}</td>
                  <td className='px-2 py-2'>{request.verificationMethod ?? 'email'}</td>
                  <td className='px-2 py-2'>
                    {request.verifiedByName || request.previousEmployerEmail || '—'}
                  </td>
                  <td className='px-2 py-2'>
                    {dkimVerified
                      ? 'DKIM-verified reply'
                      : hasReply
                        ? 'Reply on file'
                        : sent
                          ? 'Awaiting reply'
                          : '—'}
                  </td>
                </tr>
              ) : (
                <tr>
                  <td colSpan={4} className='px-2 py-3 text-[#173150]/45'>
                    No attempts yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className='mt-3 text-[11px] text-[#173150]/45'>
          Form complies with 49 CFR § 391.23 — Revised 2025 Edition.
        </p>
      </section>
    </div>
  )
}
