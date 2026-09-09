'use client'

import { DOT_PAPER_CARD } from '@/lib/dot-form-paper'
import type {
  CandidateEmploymentRow,
  EvApplicantIdentity,
} from '@/lib/candidate-employment-verification'
import { isDkimVerifiedRequest } from '@/lib/candidate-employment-verification'
import type { VerificationRequest } from '@/types/employment-verification'
import {
  Check,
  OfficialFormFooter,
  OfficialTable,
  PaperLine,
  YesNoLine,
  formatDob,
  paperDate,
} from './ev-paper-shared'

function yn(value: string | null | undefined): 'yes' | 'no' | undefined {
  if (value === 'yes' || value === 'no') return value
  return undefined
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
  const noAccidents = hasReply && answers?.hadAccident === 'no'
  const leaving =
    answers?.wasTerminated === 'yes'
      ? 'discharged'
      : answers?.terminationReason?.toLowerCase().includes('resign')
        ? 'resignation'
        : answers?.terminationReason?.toLowerCase().includes('layoff')
          ? 'layoff'
          : ''

  return (
    <div className={`${DOT_PAPER_CARD} border-t-4 border-ember p-5 sm:p-8`}>
      <header className='mb-6 border-b border-[#173150]/25 pb-4 text-center'>
        <h2 className='text-xl font-bold tracking-tight sm:text-2xl'>
          Safety Performance History Records Request
        </h2>
        <p className='mt-0.5 text-base text-[#173150]/70'>(Employment Verification)</p>
        <p className='mt-1 text-sm text-[#173150]/55'>
          To be completed by the previous employer · 49 CFR § 391.23 and § 40.25 · Page 2 of 2
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

      {/* Part 1 identifies WHOSE records are requested and from WHOM — always
          prefilled from the driver's claim, so the records holder knows exactly
          which file to pull before they touch Part 2. */}
      <section>
        <h3 className='mb-4 text-lg font-semibold'>Part 1 — Driver and Former Employer</h3>

        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
          <PaperLine label='Driver Name:' value={applicant.driverName} />
          <PaperLine
            label='SSN:'
            value={applicant.ssnLastFour ? `XXX-XX-${applicant.ssnLastFour}` : ''}
          />
          <PaperLine label='Date of Birth:' value={formatDob(applicant.dateOfBirth)} />
          <PaperLine
            label='Former Employer:'
            value={request?.previousEmployerName ?? employment.companyName}
          />
        </div>
        <div className='mt-4 flex flex-wrap items-end gap-4'>
          <span className='text-sm font-medium'>Employment Dates (as claimed by driver):</span>
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
            label='Position Held:'
            value={request?.claimedPosition ?? employment.position}
          />
        </div>
      </section>

      <section className='mt-8 border-t border-[#173150]/25 pt-6'>
        <h3 className='mb-4 text-lg font-semibold'>Part 2 — Employment Verification</h3>
        <p className='mb-4 text-sm text-[#173150]/70'>
          To be completed by the previous employer (records holder).
        </p>

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

        <div className='mt-6 flex flex-wrap gap-4'>
          <span className='text-sm font-medium'>The applicant named above was employed by us.</span>
          <Check checked={hasReply} label='Yes' />
          <Check checked={false} label='No' />
        </div>
        <div className='mt-4'>
          <PaperLine
            label='Employed as:'
            value={hasReply ? (request?.claimedPosition ?? employment.position) : ''}
          />
        </div>
        <div className='mt-4 flex flex-wrap items-end gap-4'>
          <PaperLine
            label='From (m/y)'
            value={hasReply ? paperDate(verifiedDatesFrom) : ''}
            className='min-w-[7rem] flex-1'
          />
          <PaperLine
            label='To (m/y)'
            value={hasReply ? paperDate(verifiedDatesTo ?? null) || 'Present' : ''}
            className='min-w-[7rem] flex-1'
          />
        </div>

        <div className='mt-4'>
          <p className='text-sm font-medium'>Did he/she drive a motor vehicle for you?</p>
          <div className='mt-2 flex flex-wrap gap-3'>
            <Check checked={false} label='Yes' />
            <Check checked={false} label='No' />
          </div>
          <p className='mt-3 text-sm font-medium'>If yes, what type?</p>
          <div className='mt-2 flex flex-wrap gap-3'>
            {['Straight Truck', 'Tractor-Semitrailer', 'Bus', 'Cargo Tank', 'Doubles/Triples', 'Other'].map(
              (t) => (
                <Check key={t} checked={false} label={t} />
              ),
            )}
          </div>
        </div>

        <div className='mt-4'>
          <p className='text-sm font-medium'>Reason for leaving:</p>
          <div className='mt-2 flex flex-wrap gap-3'>
            <Check checked={leaving === 'discharged'} label='Discharged' />
            <Check checked={leaving === 'resignation'} label='Resignation' />
            <Check checked={leaving === 'layoff'} label='Lay Off' />
            <Check checked={false} label='Military Duty' />
            <Check
              checked={hasReply && !leaving && Boolean(answers?.terminationReason || answers?.returnNotes)}
              label='Other'
            />
          </div>
          <div className='mt-3'>
            <PaperLine
              label='Other / remarks:'
              value={
                hasReply
                  ? (answers?.terminationReason || answers?.returnNotes || request?.claimedReasonForLeaving || '')
                  : ''
              }
            />
          </div>
        </div>

        <div className='mt-4'>
          <Check checked={false} label='If there is no safety performance history to report, check here, sign below and return.' />
        </div>
        <div className='mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3'>
          <PaperLine label='Signature:' value={hasReply ? (request?.verifiedByName ?? '') : ''} />
          <PaperLine label='Title:' value={hasReply ? (request?.verifiedByTitle ?? '') : ''} />
          <PaperLine
            label='Date:'
            value={hasReply && request?.verifiedAt ? paperDate(request.verifiedAt) : ''}
          />
        </div>
      </section>

      <section className='mt-8 border-t border-[#173150]/25 pt-6'>
        <h3 className='mb-4 text-lg font-semibold'>Part 3 — Accident History</h3>
        <p className='mb-3 text-sm text-[#173150]'>
          Complete the following for any accidents included on your accident register (§ 390.15(b))
          that involved the applicant in the 3 years prior to the application date, or check here if
          there is no accident register data for this driver.
        </p>
        <div className='mb-3'>
          <Check checked={noAccidents} label='No accident register data for this driver.' />
        </div>
        <OfficialTable headers={['Date', 'Location', '# Injuries', '# Fatalities', 'Hazmat Spill']}>
          {[0, 1, 2].map((i) => (
            <tr key={i}>
              <td className='h-9 border border-[#173150] px-2 py-2'>
                {i === 0 && hasReply && answers?.hadAccident === 'yes' ? 'Yes' : ''}
              </td>
              <td className='border border-[#173150] px-2 py-2' />
              <td className='border border-[#173150] px-2 py-2' />
              <td className='border border-[#173150] px-2 py-2' />
              <td className='border border-[#173150] px-2 py-2'>
                {i === 0 && hasReply ? (answers?.accidentDetails ?? '') : ''}
              </td>
            </tr>
          ))}
        </OfficialTable>
        <div className='mt-4'>
          <PaperLine
            label='Other accidents reported to government agencies, insurers, or retained under company policy:'
            value={hasReply && answers?.hadAccident === 'yes' ? (answers.accidentDetails ?? '') : ''}
          />
        </div>
        <div className='mt-4'>
          <PaperLine label='Any other remarks:' value={hasReply ? (answers?.additionalNotes ?? '') : ''} />
        </div>
      </section>

      <section className='mt-8 border-t border-[#173150]/25 pt-6'>
        <h3 className='mb-4 text-lg font-semibold'>Part 4 — Drug and Alcohol History</h3>
        <p className='text-sm text-[#173150]'>
          If driver was not subject to Department of Transportation testing requirements while
          employed by this employer, please check here, fill in the dates of employment, complete the
          bottom of Part 4, sign, and return.
        </p>
        <div className='mt-3'>
          <Check
            checked={hasReply && answers?.failedClearinghouseTest === 'na' && answers?.randomDrugTestOrRefused === 'na'}
            label='Driver was not subject to DOT testing requirements.'
          />
        </div>
        <div className='mt-4 flex flex-wrap items-end gap-4'>
          <span className='text-sm font-medium'>Driver was subject to DOT testing requirements</span>
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

        <div className='mt-5 space-y-3'>
          <YesNoLine
            question='1. Has this person had an alcohol test with the result of 0.04 or higher alcohol concentration?'
          />
          <YesNoLine
            question='2. Has this person tested positive or adulterated or substituted a test specimen for controlled substances?'
            answer={yn(answers?.failedClearinghouseTest)}
          />
          <YesNoLine
            question='3. Has this person refused to submit to a post-accident, random, reasonable suspicion, or follow-up alcohol or controlled substance test?'
            answer={yn(answers?.randomDrugTestOrRefused)}
          />
          <YesNoLine question='4. Has this person committed other violations of Subpart B of Part 382, or Part 40?' />
          <YesNoLine question='5. If this person has violated a DOT drug and alcohol regulation, did this person complete a SAP-prescribed rehabilitation program in your employ, including return-to-duty and follow-up tests?' />
          <YesNoLine question='6. For a driver who successfully completed a SAP’s rehabilitation referral and remained in your employ, did this driver subsequently have an alcohol test result of 0.04 or greater, a verified positive drug test, or refuse to be tested?' />
        </div>
        <p className='mt-4 text-sm text-[#173150]'>
          In answering these questions, include any required DOT drug or alcohol testing information
          obtained from prior previous employers in the previous 3 years.
        </p>
        {(answers?.clearinghouseNotes || answers?.drugTestDetails) && (
          <div className='mt-3'>
            <PaperLine
              label='Notes:'
              value={[answers.clearinghouseNotes, answers.drugTestDetails].filter(Boolean).join(' ')}
            />
          </div>
        )}
        <div className='mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2'>
          <PaperLine label='Name:' value={hasReply ? (request?.verifiedByName ?? '') : ''} />
          <PaperLine
            label='Company:'
            value={hasReply ? (request?.previousEmployerName ?? employment.companyName) : ''}
          />
          <PaperLine
            label='Part 4 Completed by (Signature):'
            value={hasReply ? (request?.verifiedByName ?? '') : ''}
          />
          <PaperLine
            label='Date:'
            value={hasReply && request?.verifiedAt ? paperDate(request.verifiedAt) : ''}
          />
        </div>
      </section>

      <section className='mt-8 border-t border-[#173150]/25 pt-6'>
        <h3 className='mb-4 text-lg font-semibold'>Part 5 — Record of Attempts (for Employer Use)</h3>
        <p className='text-sm font-medium'>This form was:</p>
        <div className='mt-2 flex flex-wrap gap-3'>
          <Check checked={false} label='Faxed' />
          <Check checked={sent || hasReply} label='Emailed' />
          <Check checked={false} label='Mailed' />
          <Check checked={false} label='Other' />
        </div>
        <div className='mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2'>
          <PaperLine label='By:' value={sent || hasReply ? 'Provven' : ''} />
          <PaperLine
            label='Date:'
            value={request ? paperDate(request.lastAttemptAt ?? request.createdAt) : ''}
          />
          <PaperLine
            label='Information received from:'
            value={hasReply ? (request?.previousEmployerName ?? '') : ''}
          />
          <PaperLine label='Recorded by:' value={hasReply ? (request?.verifiedByName ?? '') : ''} />
          <PaperLine
            label='Method:'
            value={request ? (request.verificationMethod ?? (sent ? 'email' : '')) : ''}
          />
          <PaperLine
            label='Date received:'
            value={hasReply && request?.verifiedAt ? paperDate(request.verifiedAt) : ''}
          />
        </div>
        <div className='mt-4'>
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
        </div>
      </section>

      <OfficialFormFooter />
    </div>
  )
}
