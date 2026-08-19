'use client'

import { CheckCircle, Clock, ShieldCheck, PenLine, EyeOff } from 'lucide-react'
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
  /** Field paths the API withheld. Empty for the driver's own view. */
  redactedFields?: readonly string[]
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
}: {
  label: string
  value?: string | null
}) {
  if (!value) return null
  return (
    <div className='min-w-0'>
      <p className='text-[11px] font-medium uppercase tracking-wide text-[#5c6166]'>{label}</p>
      <p className='mt-0.5 break-words text-sm leading-snug text-[#173150]'>{value}</p>
    </div>
  )
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className='grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2'>{children}</div>
}

function CardStack({ children }: { children: React.ReactNode }) {
  return <div className='flex flex-col gap-4'>{children}</div>
}

function DotSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className='border-b border-ironside/15 px-4 py-6 sm:px-7'>
      <h3 className='mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-[#173150]'>
        {title}
      </h3>
      {children}
    </section>
  )
}

function YesNo({ value }: { value?: string | boolean | null }) {
  if (value == null) return <span className='text-[#5c6166]'>—</span>
  const yes = value === true || value === 'yes' || value === 'true'
  return (
    <span className={yes ? 'font-medium text-amber-800' : 'text-[#5c6166]'}>
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

function RowToneBadge({ tone, className }: { tone: FieldTone; className?: string }) {
  if (tone === 'verified') {
    return (
      <p className={cn('mb-3 flex items-center gap-1 text-[11px] text-emerald-800', className)}>
        <ShieldCheck className='h-3 w-3 shrink-0' aria-hidden />
        Verified — issuer
      </p>
    )
  }
  if (tone === 'self') {
    return (
      <p className={cn('mb-3 flex items-center gap-1 text-[11px] text-amber-800', className)}>
        <PenLine className='h-3 w-3 shrink-0' aria-hidden />
        Self-certified
      </p>
    )
  }
  return null
}

function rowShell(tone: FieldTone) {
  return cn(
    'rounded-xl border bg-white p-4 sm:p-5',
    tone === 'verified'
      ? 'border-emerald-200'
      : tone === 'self'
        ? 'border-amber-200'
        : 'border-ironside/20',
  )
}

// ── Main export ────────────────────────────────────────────────────────────────

export default function DotAppPreviewContent({
  data,
}: {
  data: DotAppPreviewData
  /** Ignored — DOT preview is always cream paper (same as the form). */
  isDark?: boolean
}) {
  // Legal packet: midnight ink on cream. Never invert with the app theme.
  const isDark = false
  const f1 = data.form1
  const f2 = data.form2
  const f3 = data.form3
  const form1Prov = f1 as Form1WithProvenance | null
  const form2Prov = f2 as Form2WithProvenance | null
  const coverage = computeDotVerifiedCoverage(form1Prov, form2Prov, f3 as Record<string, unknown> | null)

  return (
    <div className='bg-[#fbf8f1] text-[#173150]'>
      {/* Status + verified-% meter */}
      <div className='space-y-4 border-b border-ironside/15 px-4 py-5 sm:px-7'>
        <div className='flex items-center gap-3'>
          {data.isComplete ? (
            <CheckCircle className='h-4 w-4 shrink-0 text-emerald-600' />
          ) : (
            <Clock className='h-4 w-4 shrink-0 text-amber-600' />
          )}
          <span className='text-sm text-[#173150]'>
            {data.isComplete ? 'Complete' : 'In Progress'} · Submitted {fmt(data.createdAt)}
          </span>
        </div>
        <DotVerifiedMeter coverage={coverage} isDark={isDark} />
        <div
          className={cn(
            'flex flex-wrap gap-3 text-[10px]',
            'text-[#5c6166]',
          )}
        >
          <span className='inline-flex items-center gap-1'>
            <span className='h-2 w-2 rounded-full bg-emerald-600' />
            Green = issuer-backed (MVR / PSP)
          </span>
          <span className='inline-flex items-center gap-1'>
            <span className='h-2 w-2 rounded-full bg-amber-500' />
            Amber = self-certified by driver
          </span>
        </div>
        {data.redactedFields && data.redactedFields.length > 0 && (
          // Say the fields are withheld rather than letting them render as blanks,
          // which reads like an incomplete application instead of a policy.
          <p
            className={cn(
              'flex items-start gap-1.5 text-[11px]',
              'text-[#5c6166]',
            )}
          >
            <EyeOff className='mt-0.5 h-3 w-3 shrink-0' aria-hidden />
            <span>
              SSN, date of birth, and street address are withheld. Provven decrypts them only
              to place a screening the driver has authorized.
            </span>
          </p>
        )}
      </div>

      {/* ── Form 1: Personal / License / Medical ── */}
      {f1 && (
        <>
          <DotSection title='Personal Information'>
            <FieldGrid>
              <DotField label='First name' value={f1.firstName} />
              <DotField label='Middle name' value={f1.middleName} />
              <DotField label='Last name' value={f1.lastName} />
              <DotField label='Date of Birth' value={fmt(f1.dateOfBirth)} />
              <DotField label='Phone' value={f1.phone} />
              <DotField label='Email' value={f1.email} />
              <DotField label='Position Applied For' value={f1.positionAppliedFor} />
              <DotField label='Date Available' value={fmt(f1.dateAvailableForWork)} />
            </FieldGrid>
            {f1.currentMailing && (
              <div className='mt-4'>
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
                />
              </div>
            )}
          </DotSection>

          {f1.currentLicenses && f1.currentLicenses.length > 0 && (
            <DotSection title="Driver's Licenses">
              <CardStack>
                {f1.currentLicenses.map((lic, i) => (
                  <div
                    key={i}
                    className={rowShell(
                      i === 0 ? form1Tone(form1Prov, 'currentLicenses.0.state') : null,
                    )}
                  >
                    <FieldGrid>
                      <DotField label='State' value={lic.state} />
                      <DotField label='License #' value={lic.licenseNumber} />
                      <DotField label='Class' value={lic.typeClass} />
                      <DotField label='Endorsements' value={lic.endorsements} />
                      <DotField label='Expires' value={fmt(lic.expirationDate)} />
                    </FieldGrid>
                  </div>
                ))}
              </CardStack>
            </DotSection>
          )}

          {f1.disqualificationHistory && (
            <DotSection title='License Disqualification History'>
              <div className='flex flex-col gap-3'>
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
                  <div
                    key={q}
                    className='flex flex-col gap-1 rounded-xl border border-ironside/20 bg-white px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4'
                  >
                    <span className='text-sm text-[#173150]'>{q}</span>
                    <div className='flex flex-wrap items-baseline gap-x-3 gap-y-1'>
                      <YesNo value={v} />
                      {detail ? (
                        <span className='text-xs text-[#5c6166]'>{detail}</span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </DotSection>
          )}

          {f1.medicalQualification && (
            <DotSection title='Medical Qualification'>
              <FieldGrid>
                <DotField
                  label='Valid Medical Certificate?'
                  value={f1.medicalQualification.hasValidMedicalCertificate}
                />
                <DotField
                  label='Certificate Expiration'
                  value={fmt(f1.medicalQualification.medicalCertificateExpiration)}
                />
                <DotField
                  label='Exam Date'
                  value={fmt(f1.medicalQualification.medicalExamDate)}
                />
                <DotField
                  label='Examiner Name'
                  value={f1.medicalQualification.medicalExaminerName}
                />
                <DotField
                  label='Examiner Phone'
                  value={f1.medicalQualification.medicalExaminerPhone}
                />
              </FieldGrid>
            </DotSection>
          )}
        </>
      )}

      {/* ── Form 2: Driving Experience / Accidents / Convictions ── */}
      {f2 && (
        <>
          {f2.drivingExperience && f2.drivingExperience.length > 0 && (
            <DotSection title='Driving Experience'>
              <CardStack>
                {f2.drivingExperience.map((exp, i) => (
                  <div
                    key={i}
                    className='flex items-baseline justify-between gap-4 rounded-xl border border-ironside/20 bg-white px-4 py-3.5 text-sm'
                  >
                    <span className='min-w-0 break-words text-[#173150]'>{exp.equipmentType}</span>
                    <span className='shrink-0 text-[#5c6166]'>{exp.yearsOfExperience} yrs</span>
                  </div>
                ))}
              </CardStack>
            </DotSection>
          )}

          <DotSection title='Accident History (Past 5 Years)'>
            {f2.hasNoAccidents || !f2.accidents?.length ? (
              <p
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-xl border px-4 py-3 text-sm',
                  form2Prov?._rowProvenance && f2.hasNoAccidents
                    ? 'border-emerald-200 bg-white text-emerald-900'
                    : 'border-ironside/20 bg-white text-[#5c6166]',
                )}
              >
                {form2Prov?._rowProvenance && f2.hasNoAccidents ? (
                  <>
                    <ShieldCheck className='h-3.5 w-3.5 shrink-0' /> No accidents (MVR)
                  </>
                ) : (
                  'No accidents reported'
                )}
              </p>
            ) : (
              <CardStack>
                {f2.accidents.map((acc, i) => {
                  const tone = rowTone(
                    (acc as { _source?: 'mvr' | 'psp' | 'self' })._source,
                  )
                  return (
                    <div key={i} className={rowShell(tone)}>
                      <RowToneBadge tone={tone} />
                      <FieldGrid>
                        <DotField label='Date' value={fmt(acc.date)} />
                        <DotField label='Nature' value={acc.nature} />
                        <DotField label='Fatalities' value={acc.fatalities} />
                        <DotField label='Injuries' value={acc.injuries} />
                        <DotField label='At Fault' value={acc.atFault} />
                      </FieldGrid>
                    </div>
                  )
                })}
              </CardStack>
            )}
          </DotSection>

          {f2.drugTestPositive && (
            <DotSection title='Drug & Alcohol Pre-Employment — 49 CFR 40.25 (Past 2 Years)'>
              <span
                className={cn(
                  'inline-flex rounded-full px-3 py-1 text-sm font-medium',
                  f2.drugTestPositive === 'yes'
                    ? 'bg-red-50 text-red-800'
                    : 'bg-emerald-50 text-emerald-900',
                )}
              >
                {f2.drugTestPositive === 'yes' ? 'YES — Positive / Refused' : 'NO'}
              </span>
              {f2.drugTestPositiveExplain && (
                <p className='mt-3 text-sm leading-relaxed text-[#173150]'>
                  {f2.drugTestPositiveExplain}
                </p>
              )}
            </DotSection>
          )}

          {f2.cfr391ConvictedYesNo && (
            <DotSection title='Disqualifying Convictions — 49 CFR 391.15 (Past 3 Years)'>
              <span
                className={cn(
                  'inline-flex rounded-full px-3 py-1 text-sm font-medium',
                  f2.cfr391ConvictedYesNo === 'yes'
                    ? 'bg-red-50 text-red-800'
                    : 'bg-emerald-50 text-emerald-900',
                )}
              >
                {f2.cfr391ConvictedYesNo === 'yes' ? 'YES — Convicted' : 'NO'}
              </span>
              {f2.cfr391ConvictedYesNo === 'yes' && f2.cfr391ConvictedOffenses?.length ? (
                <ul className='mt-3 space-y-2 text-sm text-[#173150]'>
                  {f2.cfr391ConvictedOffenses.map((key, i) => (
                    <li key={i} className='flex items-start gap-2'>
                      <span className='mt-0.5 text-red-700'>•</span>
                      <span className='min-w-0 break-words'>{key}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {f2.cfr391ConvictedExplain && (
                <p className='mt-3 text-sm leading-relaxed text-[#173150]'>
                  {f2.cfr391ConvictedExplain}
                </p>
              )}
            </DotSection>
          )}

          <DotSection title='Traffic Convictions (Past 3 Years)'>
            {f2.hasNoConvictions || !f2.convictions?.length ? (
              <p
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-xl border px-4 py-3 text-sm',
                  form2Prov?._rowProvenance?.mvrResultId && f2.hasNoConvictions
                    ? 'border-emerald-200 bg-white text-emerald-900'
                    : 'border-ironside/20 bg-white text-[#5c6166]',
                )}
              >
                {form2Prov?._rowProvenance?.mvrResultId && f2.hasNoConvictions ? (
                  <>
                    <ShieldCheck className='h-3.5 w-3.5 shrink-0' /> No convictions (MVR)
                  </>
                ) : (
                  'No convictions reported'
                )}
              </p>
            ) : (
              <CardStack>
                {f2.convictions.map((c, i) => {
                  const tone = rowTone((c as { _source?: 'mvr' | 'psp' | 'self' })._source)
                  return (
                    <div key={i} className={rowShell(tone)}>
                      <RowToneBadge tone={tone} />
                      <FieldGrid>
                        <DotField label='Date' value={fmt(c.dateConvicted)} />
                        <DotField label='Violation' value={c.violation} />
                        <DotField label='State' value={c.stateOfViolation} />
                        <DotField label='Penalty' value={c.penalty} />
                      </FieldGrid>
                    </div>
                  )
                })}
              </CardStack>
            )}
          </DotSection>

          {((form2Prov as { inspections?: unknown[] } | null)?.inspections?.length ||
            form2Prov?._rowProvenance?.pspResultId) && (
            <DotSection title='FMCSA Inspection History (PSP)'>
              {form2Prov?.hasNoInspections ||
              !(form2Prov as { inspections?: unknown[] }).inspections?.length ? (
                <p className='inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm text-emerald-900'>
                  <ShieldCheck className='h-3.5 w-3.5 shrink-0' /> No FMCSA inspections (PSP)
                </p>
              ) : (
                <CardStack>
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
                      <div key={i} className={rowShell(tone)}>
                        <RowToneBadge tone={tone} />
                        <FieldGrid>
                          <DotField label='Date' value={fmt(insp.date)} />
                          <DotField label='Report #' value={insp.reportNumber} />
                          <DotField label='Level' value={insp.level} />
                          <DotField label='State' value={insp.state} />
                          <DotField label='Result' value={insp.result} />
                          <DotField label='OOS' value={insp.outOfService} />
                        </FieldGrid>
                        {insp.violationSummary ? (
                          <p className='mt-3 text-xs leading-relaxed text-[#5c6166]'>
                            {insp.violationSummary}
                          </p>
                        ) : null}
                      </div>
                    )
                  })}
                </CardStack>
              )}
            </DotSection>
          )}
        </>
      )}

      {/* ── Form 3: Employment / Education / Signature ── */}
      {f3 && (
        <>
          {f3.employers && f3.employers.length > 0 && (
            <DotSection title='Employment History (10 Years)'>
              <CardStack>
                {f3.employers
                  .filter((e) => !e.isUnemployment)
                  .map((emp, i) => {
                    const source = (emp as { _source?: 'verified' | 'self' })._source
                    const tone: FieldTone =
                      source === 'verified' ? 'verified' : source === 'self' ? 'self' : 'self'
                    return (
                    <div
                      key={(emp as { id?: string }).id || i}
                      className={rowShell(tone)}
                    >
                      <div className='mb-4 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4'>
                        <div className='min-w-0'>
                          <p className='text-sm font-semibold text-[#173150]'>
                            {emp.positionHeld}
                          </p>
                          <p className='text-sm text-[#5c6166]'>{emp.name}</p>
                          <RowToneBadge tone={tone} className='mt-1.5 mb-0' />
                        </div>
                        <span className='shrink-0 text-xs text-[#5c6166]'>
                          {emp.fromDate} – {emp.toDate || 'Present'}
                        </span>
                      </div>
                      <FieldGrid>
                        <DotField label='Address' value={emp.address} />
                        <DotField label='Phone' value={emp.phone} />
                        <DotField label='Reason for Leaving' value={emp.reasonForLeaving} />
                        <DotField label='Subject to FMCSR' value={emp.subjectToFMCSR} />
                        <DotField
                          label='Safety-Sensitive'
                          value={emp.safetySensitiveFunction}
                        />
                      </FieldGrid>
                    </div>
                    )
                  })}
              </CardStack>
            </DotSection>
          )}

          {f3.education && f3.education.length > 0 && (
            <DotSection title='Education & Training'>
              <CardStack>
                {f3.education.map((edu, i) => (
                  <div key={i} className={rowShell(null)}>
                    <FieldGrid>
                      <DotField label='Type' value={edu.schoolType} />
                      <DotField label='School / Location' value={edu.nameAndLocation} />
                      <DotField label='Course of Study' value={edu.courseOfStudy} />
                      <DotField label='Years Completed' value={edu.yearsCompleted} />
                      <DotField label='Graduated' value={edu.graduated} />
                    </FieldGrid>
                  </div>
                ))}
              </CardStack>
            </DotSection>
          )}

          {(f3.applicantSignature || f3.applicantNamePrinted) && (
            <DotSection title='Electronic Signature'>
              <FieldGrid>
                <DotField label='Signed As' value={f3.applicantSignature} />
                <DotField label='Printed Name' value={f3.applicantNamePrinted} />
                <DotField label='Signature Date' value={fmt(f3.signatureDate)} />
                {f3.signedAt ? (
                  <DotField
                    label='Signed Date/Time'
                    value={new Date(f3.signedAt).toLocaleString('en-US', {
                      month: '2-digit',
                      day: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  />
                ) : null}
                {f3.ipAddress ? <DotField label='IP Address' value={f3.ipAddress} /> : null}
                {f3.fcraAcknowledgement ? (
                  <div className='flex items-center gap-1.5 text-xs text-emerald-800'>
                    <CheckCircle className='h-3.5 w-3.5 shrink-0' /> FCRA Rights Acknowledged
                  </div>
                ) : null}
              </FieldGrid>
            </DotSection>
          )}
        </>
      )}
    </div>
  )
}
