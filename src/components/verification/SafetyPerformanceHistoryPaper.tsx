'use client'

import { DOT_PAPER_CARD } from '@/lib/dot-form-paper'
import type {
  CandidateEmploymentRow,
  EvApplicantIdentity,
} from '@/lib/candidate-employment-verification'
import { isDkimVerifiedRequest } from '@/lib/candidate-employment-verification'
import type { VerificationRequest } from '@/types/employment-verification'
import { Check, OfficialTable, PaperLine, paperDate } from './ev-paper-shared'

/**
 * Page 2 of the packet — mirrors the boss's form
 * (CDL_Driver_DOT_Employment_Verification_Workflow PDF, "SAFETY PERFORMANCE
 * HISTORY RECORDS REQUEST · Driver-retained employer response form").
 * Parts 2–5 are completed by the records holder; we prefill only what a real
 * reply gave us.
 */
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
  const answers = request?.answers
  const verifiedDatesFrom =
    answers?.datesCorrect === 'partial' && answers.correctedStartDate
      ? answers.correctedStartDate
      : request?.claimedStartDate ?? employment.startDate
  const verifiedDatesTo =
    answers?.datesCorrect === 'partial' && answers.correctedEndDate
      ? answers.correctedEndDate
      : request?.claimedEndDate ?? employment.endDate
  const noAccidents = hasReply && answers?.hadAccident === 'no'
  const separation =
    answers?.wasTerminated === 'yes'
      ? 'discharge'
      : answers?.terminationReason?.toLowerCase().includes('resign')
        ? 'resignation'
        : answers?.terminationReason?.toLowerCase().includes('layoff')
          ? 'layoff'
          : ''
  // Drug/alcohol and misc answers from the employer portal surface as
  // "other safety performance information" — the form has no dedicated
  // drug/alcohol question block.
  const hasSafetyFlags =
    answers?.failedClearinghouseTest === 'yes' || answers?.randomDrugTestOrRefused === 'yes'
  const otherSafetyInfo = hasReply
    ? [answers?.additionalNotes, answers?.clearinghouseNotes, answers?.drugTestDetails]
        .filter(Boolean)
        .join(' · ')
    : ''

  return (
    <div className={`${DOT_PAPER_CARD} border-t-4 border-ember p-5 sm:p-8`}>
      <header className='mb-6 border-b border-[#173150]/25 pb-4 text-center'>
        <h2 className='text-xl font-bold tracking-tight sm:text-2xl'>
          Safety Performance History Records Request
        </h2>
        <p className='mt-0.5 text-base text-[#173150]/70'>
          Driver-retained employer response form
        </p>
        <p className='mt-1 text-sm text-[#173150]/55'>
          Instructions to records holder: Complete Parts 2–5 and return this form, with any
          responsive records, directly to the driver using the delivery information on page 1.
        </p>
      </header>

      {dkimVerified && (
        <p className='mb-4 rounded-lg border border-teal-600/25 bg-teal-50 px-3 py-2 text-xs text-teal-800'>
          Verified by Provven — DKIM passed
          {request?.dkimDomain ? ` for ${request.dkimDomain}` : ''}.
        </p>
      )}
      {hasReply && !dkimVerified && (
        <p className='mb-4 rounded-lg border border-dark-amber/30 bg-white px-3 py-2 text-xs text-[#173150]/75'>
          Previous employer replied. DKIM is not confirmed — this stays on file, not verified.
        </p>
      )}

      <section>
        <h3 className='mb-4 text-lg font-semibold'>Part 1 — Driver / Request Identification</h3>
        <PaperLine label='Driver Name:' value={applicant.driverName} />
        <div className='mt-4'>
          <PaperLine
            label='Former Employer / Records Holder:'
            value={request?.previousEmployerName ?? employment.companyName}
          />
        </div>
        <div className='mt-4 flex flex-wrap items-end gap-4'>
          <span className='text-sm font-medium'>Employment Dates:</span>
          <PaperLine
            label='From'
            value={paperDate(request?.claimedStartDate ?? employment.startDate)}
            className='min-w-[7rem] flex-1'
          />
          <PaperLine
            label='To'
            value={paperDate(request?.claimedEndDate ?? employment.endDate) || 'Present'}
            className='min-w-[7rem] flex-1'
          />
        </div>
        <div className='mt-4'>
          <PaperLine
            label='Driver Contact Email / Phone:'
            value={[applicant.email, applicant.phone].filter(Boolean).join(' / ')}
          />
        </div>
        <p className='mt-3 text-sm italic text-[#173150]/70'>
          The signed authorization immediately preceding this request applies and should remain
          attached.
        </p>
      </section>

      <section className='mt-8 border-t border-[#173150]/25 pt-6'>
        <h3 className='mb-4 text-lg font-semibold'>
          Part 2 — Employment Verification — Completed by Records Holder
        </h3>

        <div className='flex flex-wrap items-center gap-4'>
          <span className='text-sm font-medium'>Was the driver employed / contracted?</span>
          <Check checked={hasReply} label='Yes' />
          <Check checked={false} label='No' />
          <Check checked={false} label='No Records Found' />
        </div>
        <div className='mt-4 flex flex-wrap items-end gap-4'>
          <span className='text-sm font-medium'>Verified Employment Dates:</span>
          <PaperLine
            label='From'
            value={hasReply ? paperDate(verifiedDatesFrom) : ''}
            className='min-w-[7rem] flex-1'
          />
          <PaperLine
            label='To'
            value={hasReply ? paperDate(verifiedDatesTo ?? null) || 'Present' : ''}
            className='min-w-[7rem] flex-1'
          />
        </div>
        <div className='mt-4'>
          <PaperLine
            label='Position(s) Held:'
            value={hasReply ? (request?.claimedPosition ?? employment.position) : ''}
          />
        </div>
        <div className='mt-4 flex flex-wrap items-center gap-4'>
          <span className='text-sm font-medium'>Operated a Commercial Motor Vehicle?</span>
          <Check checked={false} label='Yes' />
          <Check checked={false} label='No' />
          <Check checked={false} label='Unknown' />
        </div>
        <div className='mt-4 flex flex-wrap items-center gap-3'>
          <span className='text-sm font-medium'>Equipment Type (if known):</span>
          {['Straight Truck', 'Tractor-Semitrailer', 'Bus', 'Other'].map((t) => (
            <Check key={t} checked={false} label={t} />
          ))}
        </div>
        <div className='mt-4 flex flex-wrap items-center gap-3'>
          <span className='text-sm font-medium'>Reason for Separation (if maintained):</span>
          <Check checked={separation === 'resignation'} label='Resignation' />
          <Check checked={separation === 'discharge'} label='Discharge' />
          <Check checked={separation === 'layoff'} label='Layoff' />
          <Check
            checked={hasReply && !separation && Boolean(answers?.terminationReason)}
            label='Other'
          />
        </div>
        {hasReply && answers?.terminationReason && (
          <div className='mt-3'>
            <PaperLine label='Separation notes:' value={answers.terminationReason} />
          </div>
        )}
      </section>

      <section className='mt-8 border-t border-[#173150]/25 pt-6'>
        <h3 className='mb-4 text-lg font-semibold'>Part 3 — Accident History</h3>
        <p className='mb-3 text-sm text-[#173150]'>
          During the applicable period, was the driver involved in any accidents maintained under
          49 CFR § 390.15?
        </p>
        <div className='mb-4 flex flex-wrap gap-4'>
          <Check checked={noAccidents} label='No accidents found' />
          <Check checked={hasReply && answers?.hadAccident === 'yes'} label='Yes — list below' />
          <Check checked={false} label='Records unavailable' />
        </div>
        <OfficialTable headers={['Date', 'Location', 'Injuries', 'Fatalities', 'Hazmat Spill / Notes']}>
          {[0, 1, 2].map((i) => (
            <tr key={i}>
              <td className='h-9 border border-[#173150] px-2 py-2' />
              <td className='border border-[#173150] px-2 py-2' />
              <td className='border border-[#173150] px-2 py-2' />
              <td className='border border-[#173150] px-2 py-2' />
              <td className='border border-[#173150] px-2 py-2'>
                {i === 0 && hasReply && answers?.hadAccident === 'yes'
                  ? (answers.accidentDetails ?? '')
                  : ''}
              </td>
            </tr>
          ))}
        </OfficialTable>
      </section>

      <section className='mt-8 border-t border-[#173150]/25 pt-6'>
        <h3 className='mb-4 text-lg font-semibold'>Part 4 — Other Safety Performance Information</h3>
        <div className='flex flex-wrap gap-x-4 gap-y-2'>
          <Check
            checked={hasReply && !hasSafetyFlags && !otherSafetyInfo}
            label='No additional safety performance information found.'
          />
          <Check checked={hasReply && hasSafetyFlags} label='Additional information attached.' />
          <Check checked={false} label='Records unavailable.' />
          <Check checked={false} label='No Records Found.' />
        </div>
        <div className='mt-4'>
          <PaperLine
            label='Explanation / additional safety information:'
            value={otherSafetyInfo}
          />
        </div>
      </section>

      <section className='mt-8 border-t border-[#173150]/25 pt-6'>
        <h3 className='mb-4 text-lg font-semibold'>Part 5 — Records Holder Certification</h3>
        <p className='text-sm leading-relaxed text-[#173150]'>
          I certify that the information provided is true and correct to the best of my knowledge
          and is based on records maintained by the company or organization identified above.
        </p>
        <div className='mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2'>
          <PaperLine
            label='Completed By (Name):'
            value={hasReply ? (request?.verifiedByName ?? '') : ''}
          />
          <PaperLine label='Title:' value={hasReply ? (request?.verifiedByTitle ?? '') : ''} />
          <PaperLine
            label='Signature:'
            value={hasReply ? (request?.verifiedByName ?? '') : ''}
          />
          <PaperLine
            label='Date:'
            value={hasReply && request?.verifiedAt ? paperDate(request.verifiedAt) : ''}
          />
          <PaperLine
            label='Phone / Email:'
            value={
              hasReply
                ? [request?.previousEmployerPhone, request?.previousEmployerEmail]
                    .filter(Boolean)
                    .join(' / ')
                : ''
            }
            className='sm:col-span-2'
          />
        </div>
        <p className='mt-4 text-sm italic text-[#173150]/70'>
          Return the completed packet and attachments directly to the driver. The driver should
          retain the original response and upload an unaltered copy to the appropriate career-card
          employer entry.
        </p>
      </section>
    </div>
  )
}
