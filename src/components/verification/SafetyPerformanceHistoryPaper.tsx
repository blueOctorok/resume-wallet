'use client'

import type { CandidateEmploymentRow, EvApplicantIdentity } from '@/lib/candidate-employment-verification'
import { isDkimVerifiedRequest } from '@/lib/candidate-employment-verification'
import type { VerificationRequest } from '@/types/employment-verification'

function paperDate(value: string | null | undefined): string {
  if (!value) return 'Present'
  const ym = value.match(/^(\d{4})-(\d{2})/)
  if (ym) return `${ym[2]}/${ym[1]}`
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

export default function SafetyPerformanceHistoryPaper({
  applicant,
  employment,
  request,
}: {
  applicant: EvApplicantIdentity
  employment: CandidateEmploymentRow
  request?: VerificationRequest
}) {
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
  const driverContact = [applicant.email, applicant.phone].filter(Boolean).join(' · ')

  return (
    <div className='space-y-6 text-[#173150] [color-scheme:light]'>
      <header className='border-b border-[#173150]/20 pb-4 text-center'>
        <h2 className='text-lg font-semibold tracking-tight sm:text-xl'>
          Safety Performance History Records Request
        </h2>
        <p className='mt-0.5 text-sm text-[#173150]/70'>Driver-retained employer response form</p>
        <p className='mt-1 text-xs text-[#173150]/55'>Required by 49 CFR § 391.23</p>
      </header>

      <p className='text-xs text-[#173150]/65'>
        Records holder: complete Parts 2–5 and return this form to the driver through Provven. The
        signed authorization above applies and stays attached.
      </p>

      <section>
        <h3 className='mb-3 border-b border-[#173150]/25 pb-1 text-sm font-semibold uppercase tracking-wide'>
          Part 1 – Driver / Request Identification
        </h3>
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
          <PaperLine label='Driver Name' value={applicant.driverName} />
          <PaperLine label='Former Employer / Records Holder' value={employment.companyName} />
          <PaperLine
            label='Employment Dates'
            value={`${paperDate(employment.startDate)} – ${paperDate(employment.endDate)}`}
          />
          <PaperLine label='Driver Contact' value={driverContact} />
        </div>
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
            Locked until the previous employer responds. You cannot fill this from the DOT
            application.
          </p>
        )}

        <div className={!hasReply ? 'pointer-events-none opacity-55' : ''}>
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <PaperLine
              label='Company Name'
              value={hasReply ? (request?.previousEmployerName ?? employment.companyName) : ''}
            />
            <PaperLine
              label='Phone'
              value={hasReply ? (request?.previousEmployerPhone ?? '') : ''}
            />
            <PaperLine
              label='Address'
              value={hasReply ? (request?.previousEmployerAddress ?? '') : ''}
              className='sm:col-span-2'
            />
            <PaperLine label='Person Completing Form' value={hasReply ? (request?.verifiedByName ?? '') : ''} />
            <PaperLine
              label='Title / Date'
              value={
                hasReply
                  ? [request?.verifiedByTitle, request?.verifiedAt ? paperDate(request.verifiedAt) : '']
                      .filter(Boolean)
                      .join(' · ')
                  : ''
              }
            />
          </div>

          <p className='mt-5 text-xs font-semibold uppercase tracking-wide text-[#173150]/65'>
            Employment Verification
          </p>
          <div className='mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <PaperLine
              label='Employment Dates From'
              value={hasReply ? paperDate(verifiedDatesFrom) : ''}
            />
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

          <p className='mt-5 text-xs leading-relaxed text-[#173150]/70'>
            Certification by Previous Employer — This information is provided in accordance with 49
            CFR § 391.23(d) and § 40.25(h).
          </p>
          <div className='mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <PaperLine label='Signature' value={hasReply ? (request?.verifiedByName ?? '') : ''} />
            <PaperLine label='Printed Name' value={hasReply ? (request?.verifiedByName ?? '') : ''} />
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
