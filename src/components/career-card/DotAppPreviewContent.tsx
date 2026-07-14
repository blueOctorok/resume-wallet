'use client'

import { CheckCircle, Clock, ShieldCheck, PenLine } from 'lucide-react'
import type { DotForm1Data, DotForm2Data, DotForm3Data } from '@/lib/dot-form-mapper'
import type {
  DotFieldPath,
  Form1WithProvenance,
  Form2WithProvenance,
} from '@/lib/dot-field-provenance'
import { computeDotVerifiedCoverage } from '@/lib/dot-verified-coverage'
import DotVerifiedMeter from '@/components/driver-application/DotVerifiedMeter'
import { cn } from '@/lib/utils'

export interface DotAppPreviewData {
  form1: DotForm1Data | null
  form2: DotForm2Data | null
  form3: DotForm3Data | null
  isComplete: boolean
  createdAt: string
}

type FieldTone = 'verified' | 'self' | null

// ── Primitive helpers ──────────────────────────────────────────────────────────

function fmt(d?: string) {
  return d
    ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : '—'
}

function DotField({
  label,
  value,
  isDark,
  tone = null,
}: {
  label: string
  value?: string | null
  isDark: boolean
  tone?: FieldTone
}) {
  if (!value) return null
  return (
    <div
      className={cn(
        'rounded-md px-2 py-1.5 -mx-2',
        tone === 'verified' &&
          (isDark ? 'bg-teal-500/10 ring-1 ring-teal-500/30' : 'bg-teal-50 ring-1 ring-teal-200'),
        tone === 'self' &&
          (isDark ? 'bg-amber-500/10 ring-1 ring-amber-500/25' : 'bg-amber-50 ring-1 ring-amber-200'),
      )}
    >
      <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{label}</p>
      <p className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{value}</p>
      {tone === 'verified' && (
        <p
          className={cn(
            'mt-0.5 flex items-center gap-1 text-[10px]',
            isDark ? 'text-teal-300' : 'text-teal-700',
          )}
        >
          <ShieldCheck className='h-3 w-3' aria-hidden />
          Verified — issuer
        </p>
      )}
      {tone === 'self' && (
        <p
          className={cn(
            'mt-0.5 flex items-center gap-1 text-[10px]',
            isDark ? 'text-amber-300' : 'text-amber-800',
          )}
        >
          <PenLine className='h-3 w-3' aria-hidden />
          Self-certified
        </p>
      )}
    </div>
  )
}

function DotSection({
  title,
  children,
  isDark,
}: {
  title: string
  children: React.ReactNode
  isDark: boolean
}) {
  return (
    <div className={`border-b px-6 py-5 ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
      <p
        className={`text-xs font-semibold uppercase tracking-wide mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
      >
        {title}
      </p>
      {children}
    </div>
  )
}

function YesNo({ value }: { value?: string | boolean | null }) {
  if (value == null) return <span className='text-gray-400'>—</span>
  const yes = value === true || value === 'yes' || value === 'true'
  return (
    <span className={yes ? 'text-yellow-500 font-medium' : 'text-gray-400'}>
      {yes ? 'Yes' : 'No'}
    </span>
  )
}

function form1Tone(
  form1: Form1WithProvenance | null | undefined,
  path: DotFieldPath,
): FieldTone {
  if (!form1) return null
  const entry = form1._fieldProvenance?.fields?.[path]
  if (entry?.source === 'mvr') return 'verified'
  // Only two-tone risk-bearing lock paths; other fields stay neutral
  return null
}

function rowTone(source?: 'mvr' | 'psp' | 'self'): FieldTone {
  if (source === 'mvr' || source === 'psp') return 'verified'
  if (source === 'self') return 'self'
  return 'self' // legacy untagged rows = self-certified
}

function rowShell(isDark: boolean, tone: FieldTone) {
  return cn(
    'p-3 rounded-lg',
    tone === 'verified'
      ? isDark
        ? 'bg-teal-500/10 ring-1 ring-teal-500/30'
        : 'bg-teal-50 ring-1 ring-teal-200'
      : tone === 'self'
        ? isDark
          ? 'bg-amber-500/10 ring-1 ring-amber-500/25'
          : 'bg-amber-50 ring-1 ring-amber-200'
        : isDark
          ? 'bg-gray-800'
          : 'bg-gray-50',
  )
}

// ── Main export ────────────────────────────────────────────────────────────────

export default function DotAppPreviewContent({
  data,
  isDark,
}: {
  data: DotAppPreviewData
  isDark: boolean
}) {
  const f1 = data.form1
  const f2 = data.form2
  const f3 = data.form3
  const form1Prov = f1 as Form1WithProvenance | null
  const form2Prov = f2 as Form2WithProvenance | null
  const coverage = computeDotVerifiedCoverage(form1Prov, form2Prov, f3 as Record<string, unknown> | null)

  return (
    <div>
      {/* Status + verified-% meter */}
      <div
        className={`px-6 py-4 border-b space-y-3 ${isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-100 bg-gray-50'}`}
      >
        <div className='flex items-center gap-3'>
          {data.isComplete ? (
            <CheckCircle className='w-4 h-4 text-green-500' />
          ) : (
            <Clock className='w-4 h-4 text-yellow-500' />
          )}
          <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            {data.isComplete ? 'Complete' : 'In Progress'} · Submitted {fmt(data.createdAt)}
          </span>
        </div>
        <DotVerifiedMeter coverage={coverage} isDark={isDark} />
        <div
          className={cn(
            'flex flex-wrap gap-3 text-[10px]',
            isDark ? 'text-gray-400' : 'text-gray-500',
          )}
        >
          <span className='inline-flex items-center gap-1'>
            <span
              className={cn(
                'h-2 w-2 rounded-full',
                isDark ? 'bg-teal-400' : 'bg-teal-600',
              )}
            />
            Teal = issuer-backed (MVR / PSP)
          </span>
          <span className='inline-flex items-center gap-1'>
            <span
              className={cn(
                'h-2 w-2 rounded-full',
                isDark ? 'bg-amber-400' : 'bg-amber-500',
              )}
            />
            Amber = self-certified by driver
          </span>
        </div>
      </div>

      {/* ── Form 1: Personal / License / Medical ── */}
      {f1 && (
        <>
          <DotSection title='Personal Information' isDark={isDark}>
            <div className='grid grid-cols-2 sm:grid-cols-3 gap-4'>
              <DotField
                label='First name'
                value={f1.firstName}
                isDark={isDark}
                tone={form1Tone(form1Prov, 'firstName')}
              />
              <DotField
                label='Middle name'
                value={f1.middleName}
                isDark={isDark}
                tone={form1Tone(form1Prov, 'middleName')}
              />
              <DotField
                label='Last name'
                value={f1.lastName}
                isDark={isDark}
                tone={form1Tone(form1Prov, 'lastName')}
              />
              <DotField
                label='Date of Birth'
                value={fmt(f1.dateOfBirth)}
                isDark={isDark}
                tone={form1Tone(form1Prov, 'dateOfBirth')}
              />
              <DotField label='Phone' value={f1.phone} isDark={isDark} />
              <DotField label='Email' value={f1.email} isDark={isDark} />
              <DotField label='Position Applied For' value={f1.positionAppliedFor} isDark={isDark} />
              <DotField label='Date Available' value={fmt(f1.dateAvailableForWork)} isDark={isDark} />
            </div>
            {f1.currentMailing && (
              <div className='mt-3'>
                <DotField
                  label='Current Address'
                  value={[
                    f1.currentMailing.street,
                    f1.currentMailing.city,
                    f1.currentMailing.state,
                    f1.currentMailing.zipCode,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                  isDark={isDark}
                />
              </div>
            )}
          </DotSection>

          {f1.currentLicenses && f1.currentLicenses.length > 0 && (
            <DotSection title="Driver's Licenses" isDark={isDark}>
              <div className='space-y-3'>
                {f1.currentLicenses.map((lic, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-lg grid grid-cols-2 sm:grid-cols-4 gap-3 ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}
                  >
                    <DotField
                      label='State'
                      value={lic.state}
                      isDark={isDark}
                      tone={i === 0 ? form1Tone(form1Prov, 'currentLicenses.0.state') : null}
                    />
                    <DotField
                      label='License #'
                      value={lic.licenseNumber}
                      isDark={isDark}
                      tone={
                        i === 0 ? form1Tone(form1Prov, 'currentLicenses.0.licenseNumber') : null
                      }
                    />
                    <DotField
                      label='Class'
                      value={lic.typeClass}
                      isDark={isDark}
                      tone={i === 0 ? form1Tone(form1Prov, 'currentLicenses.0.typeClass') : null}
                    />
                    <DotField
                      label='Endorsements'
                      value={lic.endorsements}
                      isDark={isDark}
                      tone={
                        i === 0 ? form1Tone(form1Prov, 'currentLicenses.0.endorsements') : null
                      }
                    />
                    <DotField
                      label='Expires'
                      value={fmt(lic.expirationDate)}
                      isDark={isDark}
                      tone={
                        i === 0 ? form1Tone(form1Prov, 'currentLicenses.0.expirationDate') : null
                      }
                    />
                  </div>
                ))}
              </div>
            </DotSection>
          )}

          {f1.disqualificationHistory && (
            <DotSection title='License Disqualification History' isDark={isDark}>
              <div className='space-y-2 text-sm'>
                {[
                  {
                    q: 'License suspended/revoked?',
                    v: f1.disqualificationHistory.hasLicenseSuspension,
                    detail: f1.disqualificationHistory.licenseSuspensionDetails,
                  },
                  {
                    q: 'Disqualifying offense?',
                    v: f1.disqualificationHistory.hasDisqualifyingOffense,
                    detail: f1.disqualificationHistory.disqualifyingOffenseDetails,
                  },
                  {
                    q: 'Out-of-service violation?',
                    v: f1.disqualificationHistory.hasOutOfServiceViolation,
                    detail: f1.disqualificationHistory.outOfServiceViolationDetails,
                  },
                  {
                    q: 'Mobile device violation?',
                    v: f1.disqualificationHistory.hasMobileDeviceViolation,
                    detail: f1.disqualificationHistory.mobileDeviceViolationDetails,
                  },
                ].map(({ q, v, detail }) => (
                  <div key={q} className='flex gap-3'>
                    <span className={`flex-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{q}</span>
                    <span>
                      <YesNo value={v} />
                    </span>
                    {detail && (
                      <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        {detail}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </DotSection>
          )}

          {f1.medicalQualification && (
            <DotSection title='Medical Qualification' isDark={isDark}>
              <div className='grid grid-cols-2 sm:grid-cols-3 gap-4'>
                <DotField
                  label='Valid Medical Certificate?'
                  value={f1.medicalQualification.hasValidMedicalCertificate}
                  isDark={isDark}
                />
                <DotField
                  label='Certificate Expiration'
                  value={fmt(f1.medicalQualification.medicalCertificateExpiration)}
                  isDark={isDark}
                />
                <DotField
                  label='Exam Date'
                  value={fmt(f1.medicalQualification.medicalExamDate)}
                  isDark={isDark}
                />
                <DotField
                  label='Examiner Name'
                  value={f1.medicalQualification.medicalExaminerName}
                  isDark={isDark}
                />
                <DotField
                  label='Examiner Phone'
                  value={f1.medicalQualification.medicalExaminerPhone}
                  isDark={isDark}
                />
              </div>
            </DotSection>
          )}
        </>
      )}

      {/* ── Form 2: Driving Experience / Accidents / Convictions ── */}
      {f2 && (
        <>
          {f2.drivingExperience && f2.drivingExperience.length > 0 && (
            <DotSection title='Driving Experience' isDark={isDark}>
              <div className='space-y-2'>
                {f2.drivingExperience.map((exp, i) => (
                  <div key={i} className='flex justify-between text-sm'>
                    <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                      {exp.equipmentType}
                    </span>
                    <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                      {exp.yearsOfExperience} yrs
                    </span>
                  </div>
                ))}
              </div>
            </DotSection>
          )}

          <DotSection title='Accident History (Past 5 Years)' isDark={isDark}>
            {f2.hasNoAccidents || !f2.accidents?.length ? (
              <p
                className={cn(
                  'text-sm rounded-md px-2 py-1.5 inline-flex items-center gap-1',
                  form2Prov?._rowProvenance && f2.hasNoAccidents
                    ? isDark
                      ? 'bg-teal-500/10 text-teal-200'
                      : 'bg-teal-50 text-teal-800'
                    : isDark
                      ? 'text-gray-400'
                      : 'text-gray-500',
                )}
              >
                {form2Prov?._rowProvenance && f2.hasNoAccidents ? (
                  <>
                    <ShieldCheck className='h-3.5 w-3.5' /> No accidents (MVR)
                  </>
                ) : (
                  'No accidents reported'
                )}
              </p>
            ) : (
              <div className='space-y-3'>
                {f2.accidents.map((acc, i) => {
                  const tone = rowTone(
                    (acc as { _source?: 'mvr' | 'psp' | 'self' })._source,
                  )
                  return (
                    <div key={i} className={rowShell(isDark, tone)}>
                      <div className='grid grid-cols-2 sm:grid-cols-3 gap-3'>
                        <DotField label='Date' value={fmt(acc.date)} isDark={isDark} tone={tone} />
                        <DotField label='Nature' value={acc.nature} isDark={isDark} tone={tone} />
                        <DotField
                          label='Fatalities'
                          value={acc.fatalities}
                          isDark={isDark}
                          tone={tone}
                        />
                        <DotField label='Injuries' value={acc.injuries} isDark={isDark} tone={tone} />
                        <DotField label='At Fault' value={acc.atFault} isDark={isDark} tone={tone} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </DotSection>

          {f2.drugTestPositive && (
            <DotSection
              title='Drug & Alcohol Pre-Employment — 49 CFR 40.25 (Past 2 Years)'
              isDark={isDark}
            >
              <span
                className={`text-sm font-medium px-3 py-1 rounded-full ${
                  f2.drugTestPositive === 'yes'
                    ? 'bg-red-500/20 text-red-500'
                    : isDark
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-green-100 text-green-700'
                }`}
              >
                {f2.drugTestPositive === 'yes' ? 'YES — Positive / Refused' : 'NO'}
              </span>
              {f2.drugTestPositiveExplain && (
                <p className={`mt-2 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {f2.drugTestPositiveExplain}
                </p>
              )}
            </DotSection>
          )}

          {f2.cfr391ConvictedYesNo && (
            <DotSection
              title='Disqualifying Convictions — 49 CFR 391.15 (Past 3 Years)'
              isDark={isDark}
            >
              <span
                className={`text-sm font-medium px-3 py-1 rounded-full ${
                  f2.cfr391ConvictedYesNo === 'yes'
                    ? 'bg-red-500/20 text-red-500'
                    : isDark
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-green-100 text-green-700'
                }`}
              >
                {f2.cfr391ConvictedYesNo === 'yes' ? 'YES — Convicted' : 'NO'}
              </span>
              {f2.cfr391ConvictedYesNo === 'yes' && f2.cfr391ConvictedOffenses?.length && (
                <ul
                  className={`mt-2 text-sm space-y-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}
                >
                  {f2.cfr391ConvictedOffenses.map((key, i) => (
                    <li key={i} className='flex items-start gap-2'>
                      <span className='text-red-500 mt-0.5'>•</span>
                      <span>{key}</span>
                    </li>
                  ))}
                </ul>
              )}
              {f2.cfr391ConvictedExplain && (
                <p className={`mt-2 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {f2.cfr391ConvictedExplain}
                </p>
              )}
            </DotSection>
          )}

          <DotSection title='Traffic Convictions (Past 3 Years)' isDark={isDark}>
            {f2.hasNoConvictions || !f2.convictions?.length ? (
              <p
                className={cn(
                  'text-sm rounded-md px-2 py-1.5 inline-flex items-center gap-1',
                  form2Prov?._rowProvenance?.mvrResultId && f2.hasNoConvictions
                    ? isDark
                      ? 'bg-teal-500/10 text-teal-200'
                      : 'bg-teal-50 text-teal-800'
                    : isDark
                      ? 'text-gray-400'
                      : 'text-gray-500',
                )}
              >
                {form2Prov?._rowProvenance?.mvrResultId && f2.hasNoConvictions ? (
                  <>
                    <ShieldCheck className='h-3.5 w-3.5' /> No convictions (MVR)
                  </>
                ) : (
                  'No convictions reported'
                )}
              </p>
            ) : (
              <div className='space-y-3'>
                {f2.convictions.map((c, i) => {
                  const tone = rowTone((c as { _source?: 'mvr' | 'psp' | 'self' })._source)
                  return (
                    <div key={i} className={rowShell(isDark, tone)}>
                      <div className='grid grid-cols-2 sm:grid-cols-3 gap-3'>
                        <DotField
                          label='Date'
                          value={fmt(c.dateConvicted)}
                          isDark={isDark}
                          tone={tone}
                        />
                        <DotField
                          label='Violation'
                          value={c.violation}
                          isDark={isDark}
                          tone={tone}
                        />
                        <DotField
                          label='State'
                          value={c.stateOfViolation}
                          isDark={isDark}
                          tone={tone}
                        />
                        <DotField label='Penalty' value={c.penalty} isDark={isDark} tone={tone} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </DotSection>

          {((form2Prov as { inspections?: unknown[] } | null)?.inspections?.length ||
            form2Prov?._rowProvenance?.pspResultId) && (
            <DotSection title='FMCSA Inspection History (PSP)' isDark={isDark}>
              {form2Prov?.hasNoInspections ||
              !(form2Prov as { inspections?: unknown[] }).inspections?.length ? (
                <p
                  className={cn(
                    'text-sm rounded-md px-2 py-1.5 inline-flex items-center gap-1',
                    isDark ? 'bg-teal-500/10 text-teal-200' : 'bg-teal-50 text-teal-800',
                  )}
                >
                  <ShieldCheck className='h-3.5 w-3.5' /> No FMCSA inspections (PSP)
                </p>
              ) : (
                <div className='space-y-3'>
                  {(
                    form2Prov as {
                      inspections: Array<{
                        date?: string
                        reportNumber?: string
                        level?: string
                        state?: string
                        result?: string
                        outOfService?: string
                        violationSummary?: string
                        _source?: 'psp' | 'self'
                      }>
                    }
                  ).inspections.map((insp, i) => {
                    const tone = rowTone(insp._source)
                    return (
                      <div key={i} className={rowShell(isDark, tone)}>
                        <div className='grid grid-cols-2 sm:grid-cols-3 gap-3'>
                          <DotField label='Date' value={fmt(insp.date)} isDark={isDark} tone={tone} />
                          <DotField
                            label='Report #'
                            value={insp.reportNumber}
                            isDark={isDark}
                            tone={tone}
                          />
                          <DotField label='Level' value={insp.level} isDark={isDark} tone={tone} />
                          <DotField label='State' value={insp.state} isDark={isDark} tone={tone} />
                          <DotField label='Result' value={insp.result} isDark={isDark} tone={tone} />
                          <DotField
                            label='OOS'
                            value={insp.outOfService}
                            isDark={isDark}
                            tone={tone}
                          />
                        </div>
                        {insp.violationSummary && (
                          <p
                            className={`mt-2 text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}
                          >
                            {insp.violationSummary}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </DotSection>
          )}
        </>
      )}

      {/* ── Form 3: Employment / Education / Signature ── */}
      {f3 && (
        <>
          {f3.employers && f3.employers.length > 0 && (
            <DotSection title='Employment History (10 Years)' isDark={isDark}>
              <div className='space-y-4'>
                {f3.employers
                  .filter((e) => !e.isUnemployment)
                  .map((emp, i) => {
                    const source = (emp as { _source?: 'verified' | 'self' })._source
                    const tone: FieldTone =
                      source === 'verified' ? 'verified' : source === 'self' ? 'self' : 'self'
                    return (
                    <div
                      key={(emp as { id?: string }).id || i}
                      className={rowShell(isDark, tone)}
                    >
                      <div className='flex items-start justify-between mb-2'>
                        <div>
                          <p
                            className={`font-medium text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}
                          >
                            {emp.positionHeld}
                          </p>
                          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {emp.name}
                          </p>
                          {tone === 'verified' && (
                            <p
                              className={`mt-1 text-[10px] flex items-center gap-1 ${isDark ? 'text-teal-300' : 'text-teal-700'}`}
                            >
                              <ShieldCheck className='h-3 w-3' /> Prior employer confirmed
                            </p>
                          )}
                          {tone === 'self' && (
                            <p
                              className={`mt-1 text-[10px] flex items-center gap-1 ${isDark ? 'text-amber-300' : 'text-amber-800'}`}
                            >
                              <PenLine className='h-3 w-3' /> Self-certified
                            </p>
                          )}
                        </div>
                        <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                          {emp.fromDate} – {emp.toDate || 'Present'}
                        </span>
                      </div>
                      <div className='grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2'>
                        <DotField label='Address' value={emp.address} isDark={isDark} tone={tone} />
                        <DotField label='Phone' value={emp.phone} isDark={isDark} tone={tone} />
                        <DotField
                          label='Reason for Leaving'
                          value={emp.reasonForLeaving}
                          isDark={isDark}
                          tone={tone}
                        />
                        <DotField label='Subject to FMCSR' value={emp.subjectToFMCSR} isDark={isDark} tone={tone} />
                        <DotField
                          label='Safety-Sensitive'
                          value={emp.safetySensitiveFunction}
                          isDark={isDark}
                          tone={tone}
                        />
                      </div>
                    </div>
                    )
                  })}
              </div>
            </DotSection>
          )}

          {f3.education && f3.education.length > 0 && (
            <DotSection title='Education & Training' isDark={isDark}>
              <div className='space-y-3'>
                {f3.education.map((edu, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}
                  >
                    <div className='grid grid-cols-2 gap-3'>
                      <DotField label='Type' value={edu.schoolType} isDark={isDark} />
                      <DotField
                        label='School / Location'
                        value={edu.nameAndLocation}
                        isDark={isDark}
                      />
                      <DotField label='Course of Study' value={edu.courseOfStudy} isDark={isDark} />
                      <DotField
                        label='Years Completed'
                        value={edu.yearsCompleted}
                        isDark={isDark}
                      />
                      <DotField label='Graduated' value={edu.graduated} isDark={isDark} />
                    </div>
                  </div>
                ))}
              </div>
            </DotSection>
          )}

          {(f3.applicantSignature || f3.applicantNamePrinted) && (
            <DotSection title='Electronic Signature' isDark={isDark}>
              <div className='grid grid-cols-2 sm:grid-cols-3 gap-4'>
                <DotField label='Signed As' value={f3.applicantSignature} isDark={isDark} />
                <DotField label='Printed Name' value={f3.applicantNamePrinted} isDark={isDark} />
                <DotField label='Signature Date' value={fmt(f3.signatureDate)} isDark={isDark} />
                {f3.signedAt && (
                  <DotField
                    label='Signed Date/Time'
                    value={new Date(f3.signedAt).toLocaleString('en-US', {
                      month: '2-digit',
                      day: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    isDark={isDark}
                  />
                )}
                {f3.ipAddress && <DotField label='IP Address' value={f3.ipAddress} isDark={isDark} />}
                {f3.fcraAcknowledgement && (
                  <div
                    className={`flex items-center gap-1 text-xs ${isDark ? 'text-green-400' : 'text-green-700'}`}
                  >
                    <CheckCircle className='w-3 h-3' /> FCRA Rights Acknowledged
                  </div>
                )}
              </div>
            </DotSection>
          )}
        </>
      )}
    </div>
  )
}
