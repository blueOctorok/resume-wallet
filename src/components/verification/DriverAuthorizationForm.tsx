'use client'

import { useEffect, useState } from 'react'
import { DOT_PAPER_CARD, DOT_PAPER_INPUT } from '@/lib/dot-form-paper'
import Button from '@/components/ui/Button'
import { PhoneInput } from '@/components/ui/MaskedInputs'
import type { CandidateEmploymentRow, EvApplicantIdentity } from '@/lib/candidate-employment-verification'
import {
  isDkimVerifiedRequest,
  isDriverSendDeclined,
  shouldHoldEvSend,
} from '@/lib/candidate-employment-verification'
import type { VerificationRequest } from '@/types/employment-verification'
import { Ban, Loader2, Send } from 'lucide-react'
import { evrDeliveryAddress } from '@/lib/evr-delivery'
import { PaperLine, formatDob, paperDate, todayIso } from './ev-paper-shared'

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
  onSend: (contact: {
    email: string
    phone: string
    signature: string
    date: string
    needsResearch: boolean
    companyName: string
    address: string
    startDate: string
    endDate: string
  }) => void
  onDecline?: () => void
}) {
  const holdDefault = shouldHoldEvSend(employment)
  // Driver-claimed employer facts stay editable until a DKIM-valid reply.
  // Sending the packet is not a lock — the driver still owns this data.
  const dkimLocked = isDkimVerifiedRequest(request)
  const [companyName, setCompanyName] = useState(employment.companyName)
  const [startDate, setStartDate] = useState(employment.startDate)
  const [endDate, setEndDate] = useState(employment.endDate ?? '')
  const [email, setEmail] = useState(employment.supervisorEmail ?? '')
  const [phone, setPhone] = useState(employment.supervisorPhone ?? '')
  const [address, setAddress] = useState(employment.location ?? '')
  // Drivers often don't know their old employer's HR contact. Instead of blocking
  // the send, they can flag Part 2 for employer-side research and submit anyway.
  const [needsResearch, setNeedsResearch] = useState(false)
  const [signature, setSignature] = useState('')
  const [signatureDate, setSignatureDate] = useState(todayIso())
  const [sendBy, setSendBy] = useState({
    secureEmail: true,
    electronicPdf: false,
    usMail: false,
    other: false,
  })
  const [sendByOther, setSendByOther] = useState('')
  const [agreeSend, setAgreeSend] = useState(false)
  const [agreeDecline, setAgreeDecline] = useState(false)
  const [doNotSend, setDoNotSend] = useState(holdDefault)

  useEffect(() => {
    setCompanyName(request?.previousEmployerName || employment.companyName)
    setStartDate(request?.claimedStartDate || employment.startDate)
    setEndDate(request?.claimedEndDate || employment.endDate || '')
    setEmail(request?.previousEmployerEmail || employment.supervisorEmail || '')
    setPhone(request?.previousEmployerPhone || employment.supervisorPhone || '')
    setAddress(request?.previousEmployerAddress || employment.location || '')
    setNeedsResearch(false)
    setSignature('')
    setSignatureDate(todayIso())
    setSendBy({ secureEmail: true, electronicPdf: false, usMail: false, other: false })
    setSendByOther('')
    setAgreeSend(false)
    setAgreeDecline(false)
    setDoNotSend(shouldHoldEvSend(employment))
  }, [
    employment.verificationKey,
    employment.companyName,
    employment.startDate,
    employment.endDate,
    employment.supervisorEmail,
    employment.supervisorPhone,
    employment.location,
    request?.id,
    request?.previousEmployerName,
    request?.previousEmployerEmail,
    request?.previousEmployerPhone,
    request?.previousEmployerAddress,
    request?.claimedStartDate,
    request?.claimedEndDate,
  ])

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
      (email.trim() || phone.trim() || needsResearch),
  )

  return (
    <div className={`${DOT_PAPER_CARD} border-t-4 border-ember p-5 sm:p-8`}>
      <header className='mb-6 border-b border-[#173150]/25 pb-4 text-center'>
        <h2 className='text-xl font-bold tracking-tight sm:text-2xl'>
          Driver Authorization to Release DOT Records
        </h2>
        <p className='mt-0.5 text-base text-[#173150]/70'>
          To be completed and signed by the driver
        </p>
        <p className='mt-1 text-sm text-[#173150]/55'>
          Purpose: Use one packet for each former employer, contractor, or trucking school. The
          records holder should return the completed Safety Performance History Request and any
          attachments directly to the driver.
        </p>
      </header>

      <section>
        <h3 className='mb-4 text-lg font-semibold'>Part 1 — Driver Information</h3>
        <div className='flex flex-wrap items-end gap-4'>
          <span className='text-sm font-medium text-[#173150]'>Printed Name:</span>
          <PaperLine label='First' value={applicant.firstName} className='min-w-[8rem] flex-1' />
          <PaperLine label='M.I.' value={applicant.middleName.slice(0, 1)} className='w-16' />
          <PaperLine label='Last' value={applicant.lastName} className='min-w-[8rem] flex-1' />
        </div>
        <div className='mt-4'>
          <PaperLine label='Other Name(s) Used:' value='' />
        </div>
        <div className='mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2'>
          <PaperLine label='Date of Birth (optional):' value={formatDob(applicant.dateOfBirth)} />
          <PaperLine
            label='Last 4 of SSN or Driver License No. / State:'
            value={
              applicant.ssnLastFour
                ? `XXX-XX-${applicant.ssnLastFour}`
                : [applicant.licenseNumber, applicant.licenseState].filter(Boolean).join(' / ')
            }
          />
          <PaperLine
            label='CDL Number / State:'
            value={[applicant.cdlNumber, applicant.cdlState].filter(Boolean).join(' / ')}
          />
          <PaperLine label='Phone Number:' value={applicant.phone} />
          <PaperLine label='Email Address:' value={applicant.email} />
          <PaperLine label='Mailing Address:' value={applicant.mailingAddress} />
        </div>
      </section>

      <section className='mt-8 border-t border-[#173150]/25 pt-6'>
        <h3 className='mb-4 text-lg font-semibold'>Part 2 — Former Employer / Contractor / School</h3>
        {dkimLocked ? (
          <PaperLine label='Company / School Name:' value={companyName} />
        ) : (
          <div>
            <label className='text-sm font-medium text-[#173150]'>Company / School Name:</label>
            <input
              type='text'
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className={`mt-0.5 w-full ${DOT_PAPER_INPUT} px-3 py-2 text-sm`}
            />
          </div>
        )}
        <div className='mt-4'>
          <PaperLine label='Attention / Department:' value='' />
        </div>
        <div className='mt-4'>
          {dkimLocked ? (
            <PaperLine label='Address:' value={address} />
          ) : (
            <div>
              <label className='text-sm font-medium text-[#173150]'>Address:</label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={2}
                className={`mt-0.5 w-full ${DOT_PAPER_INPUT} px-3 py-2 text-sm`}
              />
            </div>
          )}
        </div>
        {dkimLocked ? (
          <div className='mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <PaperLine label='Email:' value={email} />
            <PaperLine label='Telephone:' value={phone} />
          </div>
        ) : (
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
        {!dkimLocked && !email.trim() && !phone.trim() && (
          <label className='mt-4 flex items-start gap-2 rounded-lg border border-dark-amber/30 bg-white px-3 py-2 text-sm'>
            <input
              type='checkbox'
              checked={needsResearch}
              onChange={(e) => setNeedsResearch(e.target.checked)}
              className='mt-0.5 accent-[#173150]'
            />
            <span>
              I don&apos;t have this employer&apos;s contact information. Submit my signed
              authorization anyway — the employer side will research and complete this part before
              the packet is sent.
            </span>
          </label>
        )}
        {sent && !email.trim() && !phone.trim() && (
          <p className='mt-4 rounded-lg border border-dark-amber/30 bg-white px-3 py-2 text-xs text-[#173150]/75'>
            Submitted without contact information — employer-side research will complete this part.
          </p>
        )}
        <div className='mt-4 flex flex-wrap items-end gap-4'>
          <span className='text-sm font-medium text-[#173150]'>Employment / Attendance Dates:</span>
          {dkimLocked ? (
            <>
              <PaperLine
                label='From'
                value={paperDate(startDate)}
                className='min-w-[7rem] flex-1'
              />
              <PaperLine
                label='To'
                value={paperDate(endDate) || 'Present'}
                className='min-w-[7rem] flex-1'
              />
            </>
          ) : (
            <>
              <div className='min-w-[7rem] flex-1'>
                <label className='text-sm font-medium text-[#173150]'>From</label>
                <input
                  type='month'
                  value={startDate.slice(0, 7)}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={`mt-0.5 w-full ${DOT_PAPER_INPUT} px-3 py-2 text-sm`}
                />
              </div>
              <div className='min-w-[7rem] flex-1'>
                <label className='text-sm font-medium text-[#173150]'>To</label>
                <input
                  type='month'
                  value={endDate.toLowerCase() === 'present' ? '' : endDate.slice(0, 7)}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={`mt-0.5 w-full ${DOT_PAPER_INPUT} px-3 py-2 text-sm`}
                />
              </div>
            </>
          )}
        </div>
      </section>

      <section className='mt-8 border-t border-[#173150]/25 pt-6'>
        <h3 className='mb-4 text-lg font-semibold'>Part 3 — Authorization and Delivery Instructions</h3>
        <p className='text-sm leading-relaxed text-[#173150]'>
          I authorize my previous employers, contractors (if owner-operator), and trucking schools, as
          applicable, to release my Safety Performance History and DOT drug and alcohol information, as
          permitted by 49 CFR § 391.23 and other applicable regulations, directly to me at the address
          or email listed below. I also authorize release of employment verification information
          reasonably related to my DOT-regulated work history. A fax, image, or copy of this
          authorization may be treated as valid as the original.
        </p>
        <p className='mt-4 text-sm font-semibold text-[#173150]'>
          Please provide the requested records directly to the driver. If there are no responsive
          records, indicate “No Records Found.”
        </p>
        <div className='mt-4'>
          <p className='text-sm font-medium text-[#173150]'>Send Records By:</p>
          <div className='mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm'>
            <label className='inline-flex items-center gap-1.5'>
              <input
                type='checkbox'
                checked={sendBy.secureEmail}
                onChange={(e) => setSendBy((s) => ({ ...s, secureEmail: e.target.checked }))}
                disabled={sent}
                className='accent-[#173150]'
              />
              Secure Email
            </label>
            <label className='inline-flex items-center gap-1.5'>
              <input
                type='checkbox'
                checked={sendBy.electronicPdf}
                onChange={(e) => setSendBy((s) => ({ ...s, electronicPdf: e.target.checked }))}
                disabled={sent}
                className='accent-[#173150]'
              />
              Electronic PDF
            </label>
            <label className='inline-flex items-center gap-1.5'>
              <input
                type='checkbox'
                checked={sendBy.usMail}
                onChange={(e) => setSendBy((s) => ({ ...s, usMail: e.target.checked }))}
                disabled={sent}
                className='accent-[#173150]'
              />
              U.S. Mail
            </label>
            <label className='inline-flex items-center gap-1.5'>
              <input
                type='checkbox'
                checked={sendBy.other}
                onChange={(e) => setSendBy((s) => ({ ...s, other: e.target.checked }))}
                disabled={sent}
                className='accent-[#173150]'
              />
              Other:
            </label>
            <input
              type='text'
              value={sendByOther}
              onChange={(e) => setSendByOther(e.target.value)}
              disabled={sent || !sendBy.other}
              className='min-w-[8rem] flex-1 border-0 border-b border-[#173150] bg-transparent px-0 py-1 text-sm text-[#173150]'
            />
          </div>
        </div>
        <div className='mt-4'>
          <p className='text-sm font-medium text-[#173150]'>Delivery Destination:</p>
          {/* Boss requirement: responses must always land in Provven. The packet's
              delivery address is a Pingram-caught inbound alias, so even a fresh
              (non-reply) email from the employer auto-files to this request. */}
          {request?.id ? (
            <p className='mt-1 text-sm text-[#173150]'>
              Send records to the driver&apos;s secure delivery address:{' '}
              <strong>{evrDeliveryAddress(request.id)}</strong>, or the mailing address listed in
              Part 1.
            </p>
          ) : (
            <p className='mt-1 text-sm text-[#173150]'>
              Use the driver email or mailing address listed in Part 1. A secure delivery address
              is assigned to this packet when it is sent.
            </p>
          )}
        </div>
      </section>

      <section className='mt-8 border-t border-[#173150]/25 pt-6'>
        <h3 className='mb-4 text-lg font-semibold'>Part 4 — Driver Signature</h3>
        <div className='mb-4'>
          <PaperLine label='Printed Name:' value={applicant.driverName} />
        </div>
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
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
              I decline to send this request to {companyName || employment.companyName}. This stays on file and
              does not complete the verification.
            </span>
          </label>

          <div className='flex flex-wrap gap-2'>
            <Button
              type='button'
              variant='primary'
              size='sm'
              disabled={!canSend || sending || declining}
              onClick={() =>
                onSend({
                  email,
                  phone,
                  signature,
                  date: signatureDate,
                  needsResearch: needsResearch && !email.trim() && !phone.trim(),
                  companyName,
                  address,
                  startDate,
                  endDate,
                })
              }
              className='inline-flex items-center gap-2'
            >
              {sending ? <Loader2 className='h-4 w-4 animate-spin' /> : <Send className='h-4 w-4' />}
              {sending
                ? 'Sending…'
                : needsResearch && !email.trim() && !phone.trim()
                  ? 'Submit for contact research'
                  : 'Send employment verification'}
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
    </div>
  )
}
