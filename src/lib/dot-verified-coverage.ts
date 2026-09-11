/**
 * P3.7 — DOT verified coverage (honest %).
 *
 * numerator = issuer-backed (MVR/PSP provenance) risk-bearing slots that are filled
 * denominator = filled risk-bearing slots (Form 1 lock paths + Form 2
 * accident/conviction/inspection rows + issuer-stamped clean-record flags)
 *
 * Self-reported-only fields (SSN, position, medical, drug Qs, education, signature)
 * are intentionally excluded from the denominator — they inflate the % without
 * being verifiable. Verified Form 3 employers (prior-employer EVR) ARE counted.
 */

import {
  MVR_FORM1_LOCK_PATHS,
  getForm1ValueAtPath,
  type DotFieldPath,
  type DotForm1FieldProvenance,
  type DotForm2RowProvenance,
  type Form1WithProvenance,
  type Form2WithProvenance,
} from '@/lib/dot-field-provenance'
import type { Form2InspectionRow } from '@/lib/psp-to-form2-mapper'

export interface DotVerifiedSlot {
  id: string
  label: string
  verified: boolean
}

export interface DotVerifiedCoverage {
  verifiedCount: number
  totalCount: number
  /** 0–100 integer; 0 when totalCount is 0 */
  percent: number
  /** Majority of risk-bearing slots are issuer-backed */
  majorityVerified: boolean
  slots: DotVerifiedSlot[]
  /** Honest one-liner for UI small print */
  caveat: string
}

const FORM1_LABELS: Record<DotFieldPath, string> = {
  firstName: 'First name',
  middleName: 'Middle name',
  lastName: 'Last name',
  dateOfBirth: 'Date of birth',
  phone: 'Phone',
  'currentLicenses.0.state': 'License state',
  'currentLicenses.0.licenseNumber': 'License number',
  'currentLicenses.0.typeClass': 'License class',
  'currentLicenses.0.endorsements': 'Endorsements',
  'currentLicenses.0.expirationDate': 'License expiration',
}

function form1Provenance(
  form1: Form1WithProvenance | null | undefined,
): DotForm1FieldProvenance | null {
  return form1?._fieldProvenance ?? null
}

function form2Provenance(
  form2: Form2WithProvenance | null | undefined,
): DotForm2RowProvenance | null {
  return form2?._rowProvenance ?? null
}

function isIssuerSource(source?: string): boolean {
  return source === 'mvr' || source === 'psp'
}

/**
 * Compute live coverage from Form 1 + Form 2 application_data slices.
 */
export function computeDotVerifiedCoverage(
  form1: Form1WithProvenance | null | undefined,
  form2: Form2WithProvenance | null | undefined,
  form3?: Record<string, unknown> | null,
): DotVerifiedCoverage {
  const slots: DotVerifiedSlot[] = []
  const f1Prov = form1Provenance(form1)

  for (const path of MVR_FORM1_LOCK_PATHS) {
    const value = getForm1ValueAtPath(form1 ?? {}, path).trim()
    if (!value) continue
    const verified = f1Prov?.fields?.[path]?.source === 'mvr'
    slots.push({
      id: `f1:${path}`,
      label: FORM1_LABELS[path],
      verified,
    })
  }

  const f2Prov = form2Provenance(form2)
  const accidents = Array.isArray(form2?.accidents) ? form2!.accidents! : []
  const convictions = Array.isArray(form2?.convictions) ? form2!.convictions! : []
  const inspections = Array.isArray(form2?.inspections)
    ? (form2!.inspections as Form2InspectionRow[])
    : []

  accidents.forEach((row, i) => {
    const filled = Boolean(row.date?.trim() || row.nature?.trim())
    if (!filled) return
    slots.push({
      id: `f2:accident:${row._mvrKey ?? row._pspKey ?? i}`,
      label: `Accident: ${row.nature?.trim() || row.date || `#${i + 1}`}`,
      verified: isIssuerSource(row._source),
    })
  })

  convictions.forEach((row, i) => {
    const filled = Boolean(row.dateConvicted?.trim() || row.violation?.trim())
    if (!filled) return
    slots.push({
      id: `f2:conviction:${row._mvrKey ?? i}`,
      label: `Conviction: ${row.violation?.trim() || row.dateConvicted || `#${i + 1}`}`,
      verified: row._source === 'mvr',
    })
  })

  inspections.forEach((row, i) => {
    const filled = Boolean(
      row.date?.trim() || row.reportNumber?.trim() || row.result?.trim(),
    )
    if (!filled) return
    slots.push({
      id: `f2:inspection:${row._pspKey ?? i}`,
      label: `Inspection: ${row.result?.trim() || row.reportNumber || row.date || `#${i + 1}`}`,
      verified: row._source === 'psp',
    })
  })

  // Clean-record flags — only when that issuer stamped a zero count
  if (f2Prov?.mvrResultId && form2?.hasNoAccidents && f2Prov.mvrAccidentCount === 0) {
    slots.push({
      id: 'f2:no-accidents-mvr',
      label: 'No accidents (MVR)',
      verified: true,
    })
  }
  if (f2Prov?.mvrResultId && form2?.hasNoConvictions && f2Prov.mvrConvictionCount === 0) {
    slots.push({
      id: 'f2:no-convictions',
      label: 'No convictions (MVR)',
      verified: true,
    })
  }
  if (f2Prov?.pspResultId && (f2Prov.pspCrashCount ?? 0) === 0) {
    slots.push({
      id: 'f2:no-crashes-psp',
      label: 'No FMCSA crashes (PSP)',
      verified: true,
    })
  }
  if (f2Prov?.pspResultId && (f2Prov.pspInspectionCount ?? 0) === 0) {
    slots.push({
      id: 'f2:no-inspections-psp',
      label: 'No FMCSA inspections (PSP)',
      verified: true,
    })
  }

  // Form 3 — only prior-employer-verified employment rows count (self never does)
  const employers = Array.isArray(form3?.employers)
    ? (form3!.employers as Array<{
        name?: string
        positionHeld?: string
        isUnemployment?: boolean
        _source?: string
        _evrKey?: string
        id?: string
      }>)
    : []
  employers.forEach((emp, i) => {
    if (emp.isUnemployment) return
    if (!emp.name?.trim() && !emp.positionHeld?.trim()) return
    slots.push({
      id: `f3:employer:${emp._evrKey ?? emp.id ?? i}`,
      label: `Employment: ${emp.name?.trim() || emp.positionHeld || `#${i + 1}`}`,
      verified: emp._source === 'verified',
    })
  })

  const totalCount = slots.length
  const verifiedCount = slots.filter((s) => s.verified).length
  const percent = totalCount === 0 ? 0 : Math.round((100 * verifiedCount) / totalCount)
  const majorityVerified = totalCount > 0 && verifiedCount * 2 > totalCount

  return {
    verifiedCount,
    totalCount,
    percent,
    majorityVerified,
    slots,
    caveat:
      totalCount === 0
        ? 'No risk-bearing fields filled yet. Complete Section 1–2 or apply an MVR/PSP to start verifying.'
        : `Verified fields are sourced from your MVR/PSP (Accio) or prior-employer confirmation. Other fields are self-certified by you — not issuer-verified.`,
  }
}

/** Compact summary for career-card projection (no slot list). */
export function summarizeDotVerifiedCoverage(
  coverage: DotVerifiedCoverage,
): Pick<
  DotVerifiedCoverage,
  'verifiedCount' | 'totalCount' | 'percent' | 'majorityVerified'
> {
  return {
    verifiedCount: coverage.verifiedCount,
    totalCount: coverage.totalCount,
    percent: coverage.percent,
    majorityVerified: coverage.majorityVerified,
  }
}
