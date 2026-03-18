'use client'

import { CheckCircle, Clock } from 'lucide-react'
import type { DotForm1Data, DotForm2Data, DotForm3Data } from '@/lib/dot-form-mapper'

export interface DotAppPreviewData {
  form1: DotForm1Data | null
  form2: DotForm2Data | null
  form3: DotForm3Data | null
  isComplete: boolean
  createdAt: string
}

// ── Primitive helpers ──────────────────────────────────────────────────────────

function fmt(d?: string) {
  return d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'
}

function DotField({ label, value, isDark }: { label: string; value?: string | null; isDark: boolean }) {
  if (!value) return null
  return (
    <div>
      <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{label}</p>
      <p className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{value}</p>
    </div>
  )
}

function DotSection({ title, children, isDark }: { title: string; children: React.ReactNode; isDark: boolean }) {
  return (
    <div className={`border-b px-6 py-5 ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
      <p className={`text-xs font-semibold uppercase tracking-wide mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
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

// ── Main export ────────────────────────────────────────────────────────────────

export default function DotAppPreviewContent({ data, isDark }: { data: DotAppPreviewData; isDark: boolean }) {
  const f1 = data.form1
  const f2 = data.form2
  const f3 = data.form3

  return (
    <div>
      {/* Status banner */}
      <div className={`px-6 py-4 flex items-center gap-3 border-b ${isDark ? 'border-gray-700 bg-gray-800/50' : 'border-gray-100 bg-gray-50'}`}>
        {data.isComplete
          ? <CheckCircle className='w-4 h-4 text-green-500' />
          : <Clock className='w-4 h-4 text-yellow-500' />
        }
        <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
          {data.isComplete ? 'Complete' : 'In Progress'} · Submitted {fmt(data.createdAt)}
        </span>
      </div>

      {/* ── Form 1: Personal / License / Medical ── */}
      {f1 && (
        <>
          <DotSection title='Personal Information' isDark={isDark}>
            <div className='grid grid-cols-2 sm:grid-cols-3 gap-4'>
              <DotField label='Name' value={[f1.firstName, f1.middleName, f1.lastName].filter(Boolean).join(' ')} isDark={isDark} />
              <DotField label='Date of Birth' value={fmt(f1.dateOfBirth)} isDark={isDark} />
              <DotField label='Phone' value={f1.phone} isDark={isDark} />
              <DotField label='Email' value={f1.email} isDark={isDark} />
              <DotField label='Position Applied For' value={f1.positionAppliedFor} isDark={isDark} />
              <DotField label='Date Available' value={fmt(f1.dateAvailableForWork)} isDark={isDark} />
            </div>
            {f1.currentMailing && (
              <div className='mt-3'>
                <DotField
                  label='Current Address'
                  value={[f1.currentMailing.street, f1.currentMailing.city, f1.currentMailing.state, f1.currentMailing.zipCode].filter(Boolean).join(', ')}
                  isDark={isDark}
                />
              </div>
            )}
          </DotSection>

          {f1.currentLicenses && f1.currentLicenses.length > 0 && (
            <DotSection title="Driver's Licenses" isDark={isDark}>
              <div className='space-y-3'>
                {f1.currentLicenses.map((lic, i) => (
                  <div key={i} className={`p-3 rounded-lg grid grid-cols-2 sm:grid-cols-4 gap-3 ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
                    <DotField label='State' value={lic.state} isDark={isDark} />
                    <DotField label='License #' value={lic.licenseNumber} isDark={isDark} />
                    <DotField label='Class' value={lic.typeClass} isDark={isDark} />
                    <DotField label='Endorsements' value={lic.endorsements} isDark={isDark} />
                    <DotField label='Expires' value={fmt(lic.expirationDate)} isDark={isDark} />
                  </div>
                ))}
              </div>
            </DotSection>
          )}

          {f1.disqualificationHistory && (
            <DotSection title='License Disqualification History' isDark={isDark}>
              <div className='space-y-2 text-sm'>
                {[
                  { q: 'License suspended/revoked?',  v: f1.disqualificationHistory.hasLicenseSuspension,       detail: f1.disqualificationHistory.licenseSuspensionDetails },
                  { q: 'Disqualifying offense?',      v: f1.disqualificationHistory.hasDisqualifyingOffense,     detail: f1.disqualificationHistory.disqualifyingOffenseDetails },
                  { q: 'Out-of-service violation?',   v: f1.disqualificationHistory.hasOutOfServiceViolation,    detail: f1.disqualificationHistory.outOfServiceViolationDetails },
                  { q: 'Mobile device violation?',    v: f1.disqualificationHistory.hasMobileDeviceViolation,    detail: f1.disqualificationHistory.mobileDeviceViolationDetails },
                ].map(({ q, v, detail }) => (
                  <div key={q} className='flex gap-3'>
                    <span className={`flex-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{q}</span>
                    <span><YesNo value={v} /></span>
                    {detail && <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{detail}</span>}
                  </div>
                ))}
              </div>
            </DotSection>
          )}

          {f1.medicalQualification && (
            <DotSection title='Medical Qualification' isDark={isDark}>
              <div className='grid grid-cols-2 sm:grid-cols-3 gap-4'>
                <DotField label='Valid Medical Certificate?' value={f1.medicalQualification.hasValidMedicalCertificate} isDark={isDark} />
                <DotField label='Certificate Expiration' value={fmt(f1.medicalQualification.medicalCertificateExpiration)} isDark={isDark} />
                <DotField label='Exam Date' value={fmt(f1.medicalQualification.medicalExamDate)} isDark={isDark} />
                <DotField label='Examiner Name' value={f1.medicalQualification.medicalExaminerName} isDark={isDark} />
                <DotField label='Examiner Phone' value={f1.medicalQualification.medicalExaminerPhone} isDark={isDark} />
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
                    <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>{exp.equipmentType}</span>
                    <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>{exp.yearsOfExperience} yrs</span>
                  </div>
                ))}
              </div>
            </DotSection>
          )}

          <DotSection title='Accident History (Past 5 Years)' isDark={isDark}>
            {f2.hasNoAccidents || !f2.accidents?.length ? (
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>No accidents reported</p>
            ) : (
              <div className='space-y-3'>
                {f2.accidents.map((acc, i) => (
                  <div key={i} className={`p-3 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
                    <div className='grid grid-cols-2 sm:grid-cols-3 gap-3'>
                      <DotField label='Date' value={fmt(acc.date)} isDark={isDark} />
                      <DotField label='Nature' value={acc.nature} isDark={isDark} />
                      <DotField label='Fatalities' value={acc.fatalities} isDark={isDark} />
                      <DotField label='Injuries' value={acc.injuries} isDark={isDark} />
                      <DotField label='At Fault' value={acc.atFault} isDark={isDark} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DotSection>

          {f2.drugTestPositive && (
            <DotSection title='Drug & Alcohol Pre-Employment — 49 CFR 40.25 (Past 2 Years)' isDark={isDark}>
              <span className={`text-sm font-medium px-3 py-1 rounded-full ${
                f2.drugTestPositive === 'yes'
                  ? 'bg-red-500/20 text-red-500'
                  : isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'
              }`}>
                {f2.drugTestPositive === 'yes' ? 'YES — Positive / Refused' : 'NO'}
              </span>
              {f2.drugTestPositiveExplain && (
                <p className={`mt-2 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{f2.drugTestPositiveExplain}</p>
              )}
            </DotSection>
          )}

          {f2.cfr391ConvictedYesNo && (
            <DotSection title='Disqualifying Convictions — 49 CFR 391.15 (Past 3 Years)' isDark={isDark}>
              <span className={`text-sm font-medium px-3 py-1 rounded-full ${
                f2.cfr391ConvictedYesNo === 'yes'
                  ? 'bg-red-500/20 text-red-500'
                  : isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'
              }`}>
                {f2.cfr391ConvictedYesNo === 'yes' ? 'YES — Convicted' : 'NO'}
              </span>
              {f2.cfr391ConvictedYesNo === 'yes' && f2.cfr391ConvictedOffenses?.length && (
                <ul className={`mt-2 text-sm space-y-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {f2.cfr391ConvictedOffenses.map((key, i) => (
                    <li key={i} className='flex items-start gap-2'>
                      <span className='text-red-500 mt-0.5'>•</span>
                      <span>{key}</span>
                    </li>
                  ))}
                </ul>
              )}
              {f2.cfr391ConvictedExplain && (
                <p className={`mt-2 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{f2.cfr391ConvictedExplain}</p>
              )}
            </DotSection>
          )}

          <DotSection title='Traffic Convictions (Past 3 Years)' isDark={isDark}>
            {f2.hasNoConvictions || !f2.convictions?.length ? (
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>No convictions reported</p>
            ) : (
              <div className='space-y-3'>
                {f2.convictions.map((c, i) => (
                  <div key={i} className={`p-3 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
                    <div className='grid grid-cols-2 sm:grid-cols-3 gap-3'>
                      <DotField label='Date' value={fmt(c.dateConvicted)} isDark={isDark} />
                      <DotField label='Violation' value={c.violation} isDark={isDark} />
                      <DotField label='State' value={c.stateOfViolation} isDark={isDark} />
                      <DotField label='Penalty' value={c.penalty} isDark={isDark} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DotSection>
        </>
      )}

      {/* ── Form 3: Employment / Education / Signature ── */}
      {f3 && (
        <>
          {f3.employers && f3.employers.length > 0 && (
            <DotSection title='Employment History (10 Years)' isDark={isDark}>
              <div className='space-y-4'>
                {f3.employers.filter(e => !e.isUnemployment).map((emp, i) => (
                  <div key={i} className={`p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
                    <div className='flex items-start justify-between mb-2'>
                      <div>
                        <p className={`font-medium text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{emp.positionHeld}</p>
                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{emp.name}</p>
                      </div>
                      <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        {emp.fromDate} – {emp.toDate || 'Present'}
                      </span>
                    </div>
                    <div className='grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2'>
                      <DotField label='Address' value={emp.address} isDark={isDark} />
                      <DotField label='Phone' value={emp.phone} isDark={isDark} />
                      <DotField label='Reason for Leaving' value={emp.reasonForLeaving} isDark={isDark} />
                      <DotField label='Subject to FMCSR' value={emp.subjectToFMCSR} isDark={isDark} />
                      <DotField label='Safety-Sensitive' value={emp.safetySensitiveFunction} isDark={isDark} />
                    </div>
                  </div>
                ))}
              </div>
            </DotSection>
          )}

          {f3.education && f3.education.length > 0 && (
            <DotSection title='Education & Training' isDark={isDark}>
              <div className='space-y-3'>
                {f3.education.map((edu, i) => (
                  <div key={i} className={`p-3 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
                    <div className='grid grid-cols-2 gap-3'>
                      <DotField label='Type' value={edu.schoolType} isDark={isDark} />
                      <DotField label='School / Location' value={edu.nameAndLocation} isDark={isDark} />
                      <DotField label='Course of Study' value={edu.courseOfStudy} isDark={isDark} />
                      <DotField label='Years Completed' value={edu.yearsCompleted} isDark={isDark} />
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
                    value={new Date(f3.signedAt).toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    isDark={isDark}
                  />
                )}
                {f3.ipAddress && <DotField label='IP Address' value={f3.ipAddress} isDark={isDark} />}
                {f3.fcraAcknowledgement && (
                  <div className={`flex items-center gap-1 text-xs ${isDark ? 'text-green-400' : 'text-green-700'}`}>
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
