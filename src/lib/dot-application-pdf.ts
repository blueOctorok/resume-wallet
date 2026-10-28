/**
 * Driver Qualification File as PDF.
 *
 * One generator for the driver's own copy, the employer's copy, and admin.
 * The employer copy is already redacted by the caller (redactDotAppForEmployer)
 * and carries `companyName`, which is printed on the cover and every footer.
 */

import { jsPDF } from 'jspdf'
import type { DotForm1Data, DotForm2Data, DotForm3Data, DotForm3Employer } from '@/lib/dot-form-mapper'
import { historyGroupOf, orderHistoryEntries } from '@/lib/history-entry-order'

type Rgb = [number, number, number]

const MIDNIGHT: Rgb = [23, 49, 80]
const EMBER: Rgb = [241, 90, 43]
const IRONSIDE: Rgb = [147, 149, 152]
const INK_MUTED: Rgb = [92, 97, 102]
const RULE: Rgb = [226, 222, 212]

export interface DotApplicationPdfInput {
  form1: DotForm1Data | null
  form2: DotForm2Data | null
  form3: DotForm3Data | null
  createdAt?: string | null
  isComplete?: boolean
}

export interface DotApplicationPdfOptions {
  candidateName?: string
  /** The company this copy is prepared for. Absent on the driver's own copy. */
  companyName?: string | null
  /** Printed under the cover when the caller withheld identifiers. */
  withheldNote?: string | null
}

interface Field {
  label: string
  value?: string | number | boolean | null
}

/**
 * Date-only strings ("2026-10-20") are parsed by `new Date` as UTC midnight, so
 * formatting them in a US timezone prints the day before. Read them as local.
 */
function fmtDate(raw?: string | null): string {
  if (!raw) return ''
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw)
  const d = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(raw)
  return isNaN(d.getTime())
    ? raw
    : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function yesNo(value?: string | boolean | null): string {
  if (value == null || value === '') return ''
  return value === true || value === 'yes' || value === 'true' ? 'Yes' : 'No'
}

function joinParts(parts: Array<string | undefined | null>): string {
  return parts.filter((p) => p && String(p).trim()).join(', ')
}

function historyHeading(entry: DotForm3Employer): string {
  switch (historyGroupOf(entry)) {
    case 'unemployment':
      return 'Unemployment'
    case 'drivingSchool':
      return entry.name || 'School'
    case 'military':
      return entry.name || 'Military service'
    default:
      return entry.positionHeld ? `${entry.positionHeld} — ${entry.name}` : entry.name
  }
}

export function generateDotApplicationPDF(
  input: DotApplicationPdfInput,
  options: DotApplicationPdfOptions = {},
): Buffer {
  const pdf = new jsPDF('p', 'mm', 'a4')
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const margin = 16
  const contentW = pageW - margin * 2
  // Footer rule sits at pageH-13; content may run to just above it.
  const bottomLimit = pageH - 17
  let y = margin
  let sectionNumber = 0
  // Extra left/right padding while drawing inside a framed card.
  let inset = 0

  const { form1: f1, form2: f2, form3: f3 } = input
  const applicantName =
    options.candidateName?.trim() ||
    joinParts([f1?.firstName, f1?.lastName]).replace(', ', ' ') ||
    'Applicant'

  // ── Layout helpers ─────────────────────────────────────────────────────────

  const ensureRoom = (needed: number) => {
    if (y + needed > bottomLimit) {
      pdf.addPage()
      y = margin
    }
  }

  const sectionHeader = (title: string) => {
    sectionNumber += 1
    ensureRoom(18)
    y += 6
    pdf.setFillColor(...MIDNIGHT)
    pdf.roundedRect(margin, y - 4.5, 7, 7, 1.2, 1.2, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8)
    pdf.setTextColor(255, 255, 255)
    pdf.text(String(sectionNumber), margin + 3.5, y + 0.4, { align: 'center' })
    pdf.setFontSize(10.5)
    pdf.setTextColor(...MIDNIGHT)
    pdf.text(title.toUpperCase(), margin + 10, y + 0.5)
    y += 4
    pdf.setDrawColor(...EMBER)
    pdf.setLineWidth(0.5)
    pdf.line(margin, y, margin + 22, y)
    pdf.setDrawColor(...RULE)
    pdf.setLineWidth(0.3)
    pdf.line(margin + 22, y, pageW - margin, y)
    y += 6
  }

  /** Label over value, laid out in columns. Empty values are skipped. */
  const fieldRow = (fields: Field[], columns = 3) => {
    const present = fields
      .map((f) => ({ label: f.label, value: f.value == null ? '' : String(f.value).trim() }))
      .filter((f) => f.value)
    if (present.length === 0) return
    const colW = (contentW - inset * 2) / columns
    for (let i = 0; i < present.length; i += columns) {
      const row = present.slice(i, i + columns)
      const wrapped = row.map((f) => pdf.splitTextToSize(f.value, colW - 4) as string[])
      const lines = Math.max(...wrapped.map((w) => w.length))
      const rowH = 4 + lines * 4.2 + 2.5
      ensureRoom(rowH)
      row.forEach((f, idx) => {
        const x = margin + inset + idx * colW
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(7.5)
        pdf.setTextColor(...INK_MUTED)
        pdf.text(f.label.toUpperCase(), x, y)
        pdf.setFontSize(10)
        pdf.setTextColor(...MIDNIGHT)
        pdf.text(wrapped[idx], x, y + 4.2)
      })
      y += rowH
    }
  }

  const paragraph = (text: string, color: Rgb = MIDNIGHT, size = 9.5) => {
    const lines = pdf.splitTextToSize(text, contentW) as string[]
    ensureRoom(lines.length * 4.4 + 2)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(size)
    pdf.setTextColor(...color)
    pdf.text(lines, margin, y)
    y += lines.length * 4.4 + 2
  }

  /**
   * Framed group — one license, one accident, one employer.
   * `meta` prints right-aligned on the heading line (dates); `tag` goes in ember after it.
   */
  const card = (draw: () => void, heading?: string, meta?: string, tag?: string) => {
    ensureRoom(heading ? 24 : 16) // start the card on a fresh page if only a sliver is left
    const startY = y
    const startPage = pdf.getNumberOfPages()
    inset = 4
    y += 4
    if (heading) {
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(10)
      pdf.setTextColor(...MIDNIGHT)
      pdf.text(heading, margin + inset, y + 1)
      let rightX = pageW - margin - inset
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8.5)
      if (meta) {
        pdf.setTextColor(...INK_MUTED)
        pdf.text(meta, rightX, y + 1, { align: 'right' })
        rightX -= pdf.getTextWidth(meta) + 3
      }
      if (tag) {
        pdf.setTextColor(...EMBER)
        pdf.text(tag, rightX, y + 1, { align: 'right' })
      }
      y += 7
    }
    draw()
    inset = 0
    y += 1
    // Only frame cards that fit on one page; a card that broke across pages gets a rule instead.
    if (pdf.getNumberOfPages() === startPage) {
      pdf.setDrawColor(...RULE)
      pdf.setLineWidth(0.3)
      pdf.roundedRect(margin, startY, contentW, y - startY, 2, 2, 'S')
    } else {
      pdf.setDrawColor(...RULE)
      pdf.line(margin, y, pageW - margin, y)
    }
    y += 4
  }

  /** Question on the left, answer on the right, hairline under. */
  const answerRow = (question: string, answer: string, detail?: string, highlight = false) => {
    const detailLines = detail?.trim() ? (pdf.splitTextToSize(detail.trim(), contentW - 8) as string[]) : []
    const rowH = 6.5 + detailLines.length * 4.2
    ensureRoom(rowH)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9.5)
    pdf.setTextColor(...MIDNIGHT)
    pdf.text(question, margin + 2, y)
    pdf.setFont('helvetica', 'bold')
    if (highlight) pdf.setTextColor(...EMBER)
    else pdf.setTextColor(...INK_MUTED)
    pdf.text(answer, pageW - margin - 2, y, { align: 'right' })
    if (detailLines.length) {
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8.5)
      pdf.setTextColor(...INK_MUTED)
      pdf.text(detailLines, margin + 2, y + 4.4)
    }
    y += rowH
    pdf.setDrawColor(...RULE)
    pdf.setLineWidth(0.2)
    pdf.line(margin, y - 2, pageW - margin, y - 2)
  }

  // A "Yes" is the answer a safety clerk has to read, so it is the one in ember.
  const yesNoRow = (question: string, value?: string | boolean | null, detail?: string) => {
    const answer = yesNo(value) || '—'
    answerRow(question, answer, detail, answer === 'Yes')
  }

  const emptyNote = (text: string) => paragraph(text, INK_MUTED, 9)

  // ── Cover band ─────────────────────────────────────────────────────────────

  pdf.setFillColor(...MIDNIGHT)
  pdf.rect(0, 0, pageW, 46, 'F')
  pdf.setFillColor(...EMBER)
  pdf.rect(0, 46, pageW, 1.2, 'F')

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(...IRONSIDE)
  pdf.text('DRIVER QUALIFICATION FILE  ·  49 CFR 391.21', margin, 15)

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(20)
  pdf.setTextColor(255, 255, 255)
  pdf.text(applicantName, margin, 26)

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9.5)
  pdf.setTextColor(...IRONSIDE)
  const status = input.isComplete ? 'Complete' : 'In progress'
  const submitted = fmtDate(input.createdAt)
  pdf.text(submitted ? `${status}  ·  Submitted ${submitted}` : status, margin, 33)

  if (options.companyName) {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8)
    pdf.setTextColor(...EMBER)
    pdf.text('PREPARED FOR', pageW - margin, 22, { align: 'right' })
    pdf.setFontSize(14)
    pdf.setTextColor(255, 255, 255)
    pdf.text(options.companyName, pageW - margin, 29.5, { align: 'right' })
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(...IRONSIDE)
    pdf.text('Shared by the driver through Provven', pageW - margin, 35, { align: 'right' })
  }

  y = 56
  if (options.withheldNote) {
    paragraph(options.withheldNote, INK_MUTED, 8.5)
  }

  // ── 1. Personal information ────────────────────────────────────────────────

  if (f1) {
    sectionHeader('Personal information')
    fieldRow([
      { label: 'First name', value: f1.firstName },
      { label: 'Middle name', value: f1.middleName },
      { label: 'Last name', value: f1.lastName },
    ])
    fieldRow([
      { label: 'Phone', value: f1.phone },
      { label: 'Email', value: f1.email },
      { label: 'Date of birth', value: fmtDate(f1.dateOfBirth) },
    ])
    if (f1.socialSecurity) {
      fieldRow([{ label: 'Social Security number', value: f1.socialSecurity }])
    }
    fieldRow([
      { label: 'Position applied for', value: f1.positionAppliedFor },
      { label: 'Date available', value: fmtDate(f1.dateAvailableForWork) },
      { label: 'Legal right to work', value: yesNo(f1.hasLegalRightToWork) },
    ])
    if (f1.currentMailing) {
      const m = f1.currentMailing
      fieldRow(
        [
          { label: 'Current address', value: joinParts([m.street, m.city, m.state, m.zipCode]) },
          { label: 'Years at address', value: m.yearsAtAddress },
        ],
        2,
      )
    }
    if (f1.previousAddresses?.length) {
      for (const a of f1.previousAddresses) {
        fieldRow(
          [
            { label: 'Previous address', value: joinParts([a.street, a.city, a.state, a.zipCode]) },
            { label: 'Years there', value: a.yearsAtAddress },
          ],
          2,
        )
      }
    }

    // ── 2. Licenses ──
    if (f1.currentLicenses?.length || f1.previousLicenses?.length) {
      sectionHeader("Driver's licenses")
      for (const lic of f1.currentLicenses ?? []) {
        card(() =>
          fieldRow([
            { label: 'State', value: lic.state },
            { label: 'License #', value: lic.licenseNumber },
            { label: 'Class', value: lic.typeClass },
            { label: 'Endorsements', value: lic.endorsements },
            { label: 'Expires', value: fmtDate(lic.expirationDate) },
          ]),
        )
      }
      for (const lic of f1.previousLicenses ?? []) {
        card(
          () =>
            fieldRow([
              { label: 'State', value: lic.state },
              { label: 'License #', value: lic.licenseNumber },
              { label: 'Class', value: lic.typeClass },
              { label: 'Endorsements', value: lic.endorsements },
              { label: 'Expired', value: fmtDate(lic.expirationDate) },
            ]),
          'Previous license',
        )
      }
    }

    // ── 3. Disqualification history ──
    if (f1.disqualificationHistory) {
      const d = f1.disqualificationHistory
      sectionHeader('License disqualification history')
      yesNoRow('License suspended or revoked?', d.hasLicenseSuspension, d.licenseSuspensionDetails)
      yesNoRow('Disqualifying offense?', d.hasDisqualifyingOffense, d.disqualifyingOffenseDetails)
      yesNoRow('Out-of-service violation?', d.hasOutOfServiceViolation, d.outOfServiceViolationDetails)
      yesNoRow('Mobile device violation?', d.hasMobileDeviceViolation, d.mobileDeviceViolationDetails)
    }

    // ── 4. Medical ──
    if (f1.medicalQualification) {
      const m = f1.medicalQualification
      sectionHeader('Medical qualification')
      fieldRow([
        { label: 'Valid medical certificate', value: yesNo(m.hasValidMedicalCertificate) },
        { label: 'Certificate expires', value: fmtDate(m.medicalCertificateExpiration) },
        { label: 'Filed with state', value: yesNo(m.hasFiledWithState) },
      ])
      fieldRow([
        { label: 'Exam date', value: fmtDate(m.medicalExamDate) },
        { label: 'Examiner', value: m.medicalExaminerName },
        { label: 'Examiner phone', value: m.medicalExaminerPhone },
      ])
      fieldRow([
        { label: 'Registry ID', value: m.medicalExaminerRegistryId },
        { label: 'Examiner type', value: m.medicalExaminerType },
      ])
      yesNoRow('Medical variance?', m.hasMedicalVariance, m.medicalVarianceDetails)
      yesNoRow('Chronic conditions?', m.hasChronicConditions, m.chronicConditionsDetails)
    }
  }

  // ── 5–8. Driving record ────────────────────────────────────────────────────

  if (f2) {
    if (f2.drivingExperience?.length) {
      sectionHeader('Driving experience')
      for (const exp of f2.drivingExperience) {
        answerRow(exp.equipmentType || 'Equipment', `${exp.yearsOfExperience || '—'} yrs`)
      }
    }

    sectionHeader('Accident history — past 5 years')
    if (f2.hasNoAccidents || !f2.accidents?.length) {
      emptyNote('No accidents reported.')
    } else {
      for (const acc of f2.accidents) {
        card(() =>
          fieldRow([
            { label: 'Date', value: fmtDate(acc.date) },
            { label: 'Nature', value: acc.nature },
            { label: 'Fatalities', value: acc.fatalities },
            { label: 'Injuries', value: acc.injuries },
            { label: 'Chemical spills', value: acc.chemicalSpills },
            { label: 'At fault', value: acc.atFault },
          ]),
        )
      }
    }

    sectionHeader('Traffic convictions — past 3 years')
    if (f2.hasNoConvictions || !f2.convictions?.length) {
      emptyNote('No convictions reported.')
    } else {
      for (const c of f2.convictions) {
        card(() =>
          fieldRow([
            { label: 'Date convicted', value: fmtDate(c.dateConvicted) },
            { label: 'Violation', value: c.violation },
            { label: 'State', value: c.stateOfViolation },
            { label: 'Penalty', value: c.penalty },
          ]),
        )
      }
    }

    sectionHeader('License actions and federal disclosures')
    yesNoRow('Denied a license, permit, or privilege?', f2.deniedLicense, f2.deniedLicenseExplain)
    yesNoRow('License, permit, or privilege suspended or revoked?', f2.suspendedLicense, f2.suspendedLicenseExplain)
    if (f2.drugTestPositive) {
      yesNoRow(
        'Positive or refused pre-employment drug/alcohol test — 49 CFR 40.25 (2 yrs)?',
        f2.drugTestPositive,
        f2.drugTestPositiveExplain,
      )
    }
    if (f2.cfr391ConvictedYesNo) {
      const offenses = f2.cfr391ConvictedOffenses?.length
        ? `Offenses: ${f2.cfr391ConvictedOffenses.join('; ')}${f2.cfr391ConvictedExplain ? ` — ${f2.cfr391ConvictedExplain}` : ''}`
        : f2.cfr391ConvictedExplain
      yesNoRow('Disqualifying conviction — 49 CFR 391.15 (3 yrs)?', f2.cfr391ConvictedYesNo, offenses)
    }
  }

  // ── 9–11. History, education, signature ────────────────────────────────────

  if (f3) {
    if (f3.employers?.length) {
      sectionHeader('Employment and history — past 10 years')
      for (const emp of orderHistoryEntries(f3.employers)) {
        const dates = [emp.fromDate, emp.toDate || 'Present'].filter(Boolean).join(' – ')
        const tag = emp._source === 'verified' ? 'Confirmed by employer' : undefined
        const group = historyGroupOf(emp)
        card(() => {
          if (group === 'employment') {
            fieldRow([
              { label: 'Address', value: emp.address },
              { label: 'Phone', value: emp.phone },
              { label: 'Reason for leaving', value: emp.reasonForLeaving },
              { label: 'Subject to FMCSR', value: yesNo(emp.subjectToFMCSR) },
              { label: 'Safety-sensitive function', value: yesNo(emp.safetySensitiveFunction) },
              { label: 'Salary', value: emp.salary },
            ])
            if (emp.duties) fieldRow([{ label: 'Work description', value: emp.duties }], 1)
          } else {
            fieldRow([
              { label: 'Course of study', value: emp.courseOfStudy },
              { label: 'Address', value: emp.address },
              { label: 'Phone', value: emp.phone },
              { label: 'Notes', value: emp.gapsInEmployment },
            ])
          }
        }, historyHeading(emp), dates, tag)
      }
    }

    if (f3.education?.length) {
      sectionHeader('Education and training')
      for (const edu of f3.education) {
        card(() =>
          fieldRow([
            { label: 'Type', value: edu.schoolType },
            { label: 'School / location', value: edu.nameAndLocation },
            { label: 'Course of study', value: edu.courseOfStudy },
            { label: 'Years completed', value: edu.yearsCompleted },
            { label: 'Graduated', value: yesNo(edu.graduated) },
            { label: 'Details', value: edu.details },
          ]),
        )
      }
    }

    if (f3.applicantSignature || f3.applicantNamePrinted) {
      sectionHeader('Certification and electronic signature')
      fieldRow([
        { label: 'Signed as', value: f3.applicantSignature },
        { label: 'Printed name', value: f3.applicantNamePrinted },
        { label: 'Signature date', value: fmtDate(f3.signatureDate) },
      ])
      fieldRow([
        {
          label: 'Signed at',
          value: f3.signedAt ? new Date(f3.signedAt).toLocaleString('en-US') : '',
        },
        { label: 'Previous road test', value: yesNo(f3.hasPreviousRoadTest) },
        { label: 'Holds valid CDL', value: yesNo(f3.hasValidCDL) },
      ])
      const acks = [
        f3.fcraAcknowledgement && 'FCRA rights acknowledged',
        f3.safetyPerformanceHistoryAcknowledgement && 'Safety performance history acknowledged',
        f3.safetyPerformanceInquiryConsent && 'Consents to safety performance inquiry',
        f3.roadTestAcknowledgement && 'Road test acknowledged',
      ].filter((a): a is string => Boolean(a))
      if (acks.length) paragraph(acks.join('  ·  '), INK_MUTED, 8.5)
    }
  }

  // ── Footer on every page ───────────────────────────────────────────────────

  const pageCount = pdf.getNumberOfPages()
  const footerLeft = options.companyName
    ? `${applicantName}  ·  Prepared for ${options.companyName}`
    : applicantName
  for (let p = 1; p <= pageCount; p += 1) {
    pdf.setPage(p)
    const fy = pageH - 9
    pdf.setDrawColor(...RULE)
    pdf.setLineWidth(0.3)
    pdf.line(margin, fy - 4, pageW - margin, fy - 4)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7.5)
    pdf.setTextColor(...INK_MUTED)
    pdf.text(footerLeft, margin, fy)
    pdf.setTextColor(...EMBER)
    pdf.setFont('helvetica', 'bold')
    pdf.text('provven.com', pageW / 2, fy, { align: 'center' })
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(...INK_MUTED)
    pdf.text(`Page ${p} of ${pageCount}`, pageW - margin, fy, { align: 'right' })
  }

  return Buffer.from(pdf.output('arraybuffer'))
}
