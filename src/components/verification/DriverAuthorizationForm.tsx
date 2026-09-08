'use client'

import { useEffect, useState } from 'react'
import { DOT_PAPER_INPUT } from '@/lib/dot-form-paper'
import Button from '@/components/ui/Button'
import { PhoneInput } from '@/components/ui/MaskedInputs'
import type { CandidateEmploymentRow, EvApplicantIdentity } from '@/lib/candidate-employment-verification'
import { Loader2, Send } from 'lucide-react'

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

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function DriverAuthorizationForm({
  applicant,
  employment,
  sent,
  sending,
  onSend,
}: {
  applicant: EvApplicantIdentity
  employment: CandidateEmploymentRow
  sent: boolean
  sending: boolean
  onSend: (contact: { email: string; phone: string; signature: string; date: string }) => void
}) {
  const [email, setEmail] = useState(employment.supervisorEmail ?? '')
  const [phone, setPhone] = useState(employment.supervisorPhone ?? '')
  const [attention, setAttention] = useState(employment.supervisorName ?? '')
  const [address, setAddress] = useState(employment.location ?? '')
  const [signature, setSignature] = useState('')
  const [signatureDate, setSignatureDate] = useState(todayIso())
  const [agreeSend, setAgreeSend] = useState(false)

  useEffect(() => {
    setEmail(employment.supervisorEmail ?? '')
    setPhone(employment.supervisorPhone ?? '')
    setAttention(employment.supervisorName ?? '')
    setAddress(employment.location ?? '')
    setSignature('')
    setSignatureDate(todayIso())
    setAgreeSend(false)
  }, [
    employment.verificationKey,
    employment.supervisorEmail,
    employment.supervisorPhone,
    employment.supervisorName,
    employment.location,
  ])

  const canSend = Boolean(
    !sent &&
      signature.trim() &&
      signatureDate &&
      agreeSend &&
      (email.trim() || phone.trim()),
  )

  const licenseLine = [applicant.cdlNumber, applicant.cdlState].filter(Boolean).join(' / ')
  const dlLine = [applicant.licenseNumber, applicant.licenseState].filter(Boolean).join(' / ')

  return (
    <section className='space-y-4 text-[#173150] [color-scheme:light]'>
      <header className='border-b border-[#173150]/20 pb-3'>
        <h2 className='text-base font-semibold sm:text-lg'>
          Driver Authorization to Release DOT Records
        </h2>
        <p className='mt-1 text-xs text-[#173150]/65'>
          One packet per former employer. Part 1 is from your DOT application and profile
          (self-reported). Part 2 is from Form 3 — edit if something is missing.
        </p>
      </header>

      <div>
        <h3 className='mb-3 border-b border-[#173150]/25 pb-1 text-sm font-semibold uppercase tracking-wide'>
          Part 1 – Driver Information
        </h3>
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-3'>
          <PaperLine label='First' value={applicant.firstName} />
          <PaperLine label='M.I.' value={applicant.middleName} />
          <PaperLine label='Last' value={applicant.lastName} />
        </div>
        <div className='mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2'>
          <PaperLine label='Date of Birth (optional)' value={formatDob(applicant.dateOfBirth)} />
          <PaperLine
            label='Last 4 of SSN'
            value={applicant.ssnLastFour ? `XXX-XX-${applicant.ssnLastFour}` : ''}
          />
          <PaperLine label='CDL Number / State' value={licenseLine} />
          <PaperLine label='Driver License / State' value={dlLine} />
          <PaperLine label='Email' value={applicant.email} />
          <PaperLine label='Phone' value={applicant.phone} />
        </div>
        <div className='mt-4'>
          <PaperLine label='Mailing Address' value={applicant.mailingAddress} />
        </div>
      </div>

      <div>
        <h3 className='mb-3 border-b border-[#173150]/25 pb-1 text-sm font-semibold uppercase tracking-wide'>
          Part 2 – Former Employer / Contractor / School
        </h3>
        <PaperLine label='Company / School Name' value={employment.companyName} />
        {sent ? (
          <>
            <div className='mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2'>
              <PaperLine label='Attention / Department' value={attention} />
              <PaperLine
                label='Employment Dates'
                value={`${paperDate(employment.startDate)} – ${paperDate(employment.endDate)}`}
              />
            </div>
            <div className='mt-4'>
              <PaperLine label='Address' value={address} />
            </div>
            <div className='mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2'>
              <PaperLine label='Email' value={email} />
              <PaperLine label='Phone' value={phone} />
            </div>
          </>
        ) : (
          <div className='mt-4 space-y-3'>
            <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
              <div>
                <label className='text-[11px] font-semibold uppercase tracking-wide text-[#173150]/65'>
                  Attention / Department
                </label>
                <input
                  type='text'
                  value={attention}
                  onChange={(e) => setAttention(e.target.value)}
                  placeholder='HR or hiring manager'
                  className={`mt-0.5 w-full ${DOT_PAPER_INPUT} px-3 py-2 text-sm`}
                />
              </div>
              <PaperLine
                label='Employment / Attendance Dates'
                value={`${paperDate(employment.startDate)} – ${paperDate(employment.endDate)}`}
              />
            </div>
            <div>
              <label className='text-[11px] font-semibold uppercase tracking-wide text-[#173150]/65'>
                Address
              </label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={2}
                className={`mt-0.5 w-full ${DOT_PAPER_INPUT} px-3 py-2 text-sm`}
              />
            </div>
            <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
              <div>
                <label className='text-[11px] font-semibold uppercase tracking-wide text-[#173150]/65'>
                  Email
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
                  Phone
                </label>
                <PhoneInput
                  value={phone}
                  onChange={setPhone}
                  className={`mt-0.5 w-full ${DOT_PAPER_INPUT} px-3 py-2 text-sm`}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <p className='text-sm leading-relaxed text-[#173150]/90'>
        I authorize the records holder named above to release my employment, accident, and safety
        performance history, including alcohol and controlled substances testing information, in
        accordance with 49 CFR § 391.23. I understand I may review this information, request
        correction of errors, and have a copy furnished to me. The records holder should return the
        completed request to me through Provven.
      </p>

      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
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
            className={`mt-0.5 w-full border-0 border-b border-[#173150]/35 bg-transparent px-0 py-1.5 text-sm text-[#173150]`}
          />
        </div>
        <div>
          <label className='text-[11px] font-semibold uppercase tracking-wide text-[#173150]/65'>
            Date
          </label>
          <input
            type='date'
            value={signatureDate}
            onChange={(e) => setSignatureDate(e.target.value)}
            disabled={sent}
            className={`mt-0.5 w-full border-0 border-b border-[#173150]/35 bg-transparent px-0 py-1.5 text-sm text-[#173150]`}
          />
        </div>
      </div>

      {!sent && (
        <>
          <label className='flex items-start gap-2 text-sm'>
            <input
              type='checkbox'
              checked={agreeSend}
              onChange={(e) => setAgreeSend(e.target.checked)}
              className='mt-0.5 accent-[#173150]'
            />
            <span>
              I agree to send this authorization and Safety Performance History request to the past
              employer through Provven, using my email on file (
              {applicant.email || 'add an email on your profile'}) as the driver contact.
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
            {sending ? 'Sending…' : 'Send packet'}
          </Button>
        </>
      )}
    </section>
  )
}
