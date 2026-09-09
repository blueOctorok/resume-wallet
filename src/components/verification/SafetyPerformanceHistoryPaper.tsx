'use client'

import { DOT_PAPER_CARD } from '@/lib/dot-form-paper'
import type { CandidateEmploymentRow } from '@/lib/candidate-employment-verification'
import { isDkimVerifiedRequest } from '@/lib/candidate-employment-verification'
import type { VerificationRequest } from '@/types/employment-verification'
import {
  Check,
  OfficialFormFooter,
  OfficialFormHeader,
  OfficialTable,
  PaperLine,
  paperDate,
} from './ev-paper-shared'

export default function SafetyPerformanceHistoryPaper({
  employment,
  request,
}: {
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

  return (
    <div className={`${DOT_PAPER_CARD} border-t-4 border-ember p-5 sm:p-8`}>
      <OfficialFormHeader page={2} />

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
        <h3 className='mb-4 text-lg font-semibold'>Section 2 – To Be Completed by Previous Employer</h3>

        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
          <PaperLine
            label='Company Name:'
            value={hasReply ? (request?.previousEmployerName ?? employment.companyName) : ''}
          />
          <PaperLine label='Phone:' value={hasReply ? (request?.previousEmployerPhone ?? '') : ''} />
        </div>
        <div className='mt-4'>
          <PaperLine
            label='Address:'
            value={hasReply ? (request?.previousEmployerAddress ?? '') : ''}
          />
        </div>
        <div className='mt-4'>
          <PaperLine
            label='Person Completing Form:'
            value={hasReply ? (request?.verifiedByName ?? '') : ''}
          />
        </div>
        <div className='mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2'>
          <PaperLine label='Title:' value={hasReply ? (request?.verifiedByTitle ?? '') : ''} />
          <PaperLine
            label='Date:'
            value={hasReply && request?.verifiedAt ? paperDate(request.verifiedAt) : ''}
          />
        </div>

        <h4 className='mt-6 mb-3 text-base font-semibold'>Employment Verification:</h4>
        <div className='flex flex-wrap items-end gap-4'>
          <span className='text-sm font-medium text-[#173150]'>Employment Dates:</span>
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
        <div className='mt-4 flex flex-wrap gap-4'>
          <span className='text-sm font-medium'>Eligible for Rehire?</span>
          <Check checked={hasReply && answers?.eligibleToReturn === 'yes'} label='Yes' />
          <Check checked={hasReply && answers?.eligibleToReturn === 'no'} label='No' />
          <Check checked={hasReply && answers?.eligibleToReturn === 'discuss'} label='Would Discuss' />
        </div>
        <div className='mt-4'>
          <PaperLine
            label='Reason for Leaving:'
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

        <h4 className='mt-6 mb-3 text-base font-semibold'>Accident History (Past 3 Years):</h4>
        <OfficialTable headers={['Date', 'Location', 'Injuries', 'Fatalities', 'Hazmat Spill', 'Comments']}>
          <tr>
            <td className='h-9 border border-[#173150] px-2 py-2'>
              {hasReply && answers?.hadAccident === 'yes' ? 'Yes' : ''}
            </td>
            <td className='border border-[#173150] px-2 py-2' />
            <td className='border border-[#173150] px-2 py-2' />
            <td className='border border-[#173150] px-2 py-2' />
            <td className='border border-[#173150] px-2 py-2' />
            <td className='border border-[#173150] px-2 py-2'>
              {hasReply ? (answers?.accidentDetails ?? '') : ''}
            </td>
          </tr>
        </OfficialTable>
        <div className='mt-3'>
          <Check
            checked={hasReply && answers?.hadAccident === 'no'}
            label='No DOT-recordable accidents reported.'
          />
        </div>

        <h4 className='mt-6 mb-3 text-base font-semibold'>Certification by Previous Employer:</h4>
        <p className='text-sm text-[#173150]'>
          This information is provided in accordance with 49 CFR § 391.23(d) and § 40.25(h).
        </p>
        <div className='mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2'>
          <PaperLine label='Signature:' value={hasReply ? (request?.verifiedByName ?? '') : ''} />
          <PaperLine label='Printed Name:' value={hasReply ? (request?.verifiedByName ?? '') : ''} />
          <PaperLine label='Title:' value={hasReply ? (request?.verifiedByTitle ?? '') : ''} />
          <PaperLine
            label='Date:'
            value={hasReply && request?.verifiedAt ? paperDate(request.verifiedAt) : ''}
          />
        </div>

        {hasReply && (
          <div className='mt-6 space-y-2 text-sm'>
            <p className='text-sm font-medium text-[#173150]'>
              Alcohol and controlled substances testing (49 CFR § 40.25)
            </p>
            <div className='flex flex-wrap gap-4'>
              <span>Failed a Clearinghouse / post-accident test?</span>
              <Check checked={answers?.failedClearinghouseTest === 'yes'} label='Yes' />
              <Check checked={answers?.failedClearinghouseTest === 'no'} label='No' />
              <Check checked={answers?.failedClearinghouseTest === 'na'} label='N/A' />
            </div>
            {answers?.clearinghouseNotes ? (
              <PaperLine label='Notes:' value={answers.clearinghouseNotes} />
            ) : null}
            <div className='flex flex-wrap gap-4'>
              <span>Random drug test or refused a test?</span>
              <Check checked={answers?.randomDrugTestOrRefused === 'yes'} label='Yes' />
              <Check checked={answers?.randomDrugTestOrRefused === 'no'} label='No' />
              <Check checked={answers?.randomDrugTestOrRefused === 'na'} label='N/A' />
            </div>
            {answers?.drugTestDetails ? (
              <PaperLine label='Details:' value={answers.drugTestDetails} />
            ) : null}
          </div>
        )}
      </section>

      <section className='mt-8'>
        <h3 className='mb-4 text-lg font-semibold'>Section 3 – Record of Attempts (for Employer Use)</h3>
        <OfficialTable headers={['Date', 'Method', 'Contact Person', 'Result']}>
          <tr>
            <td className='h-9 border border-[#173150] px-2 py-2'>
              {request ? paperDate(request.lastAttemptAt ?? request.createdAt) : ''}
            </td>
            <td className='border border-[#173150] px-2 py-2'>
              {request ? (request.verificationMethod ?? (sent ? 'email' : '')) : ''}
            </td>
            <td className='border border-[#173150] px-2 py-2'>
              {request ? request.verifiedByName || request.previousEmployerEmail || '' : ''}
            </td>
            <td className='border border-[#173150] px-2 py-2'>
              {dkimVerified
                ? 'DKIM-verified reply'
                : hasReply
                  ? 'Reply on file'
                  : sent
                    ? 'Awaiting reply'
                    : ''}
            </td>
          </tr>
        </OfficialTable>
      </section>

      <OfficialFormFooter />
    </div>
  )
}
