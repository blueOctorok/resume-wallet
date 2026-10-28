/**
 * P3.7 — DOT field provenance + lock helpers (MVR → Form 1 + Form 2).
 *
 * Locked fields/rows are *projected* from the issuer-backed MVR on save/load/webhook,
 * not merely copied into application_data and disabled in the UI.
 *
 * Form 1: hard-lock identity/license scalar paths.
 * Form 2 accident and conviction rows are the driver's own disclosure.
 * A driving record or PSP crash is not copied onto those rows. Personal info
 * stays on Form 1. Re-projection removes report rows that were copied earlier
 * and leaves the driver's own rows.
 *
 * Honesty: only issuer-backed paths get source:'mvr'. Self-reported fields stay open.
 */

import type { Form2AccidentRow, Form2ConvictionRow } from '@/lib/mvr-to-form2-mapper'

/** Removing a report row must not check "none" for the driver. */
function driverSaidNone(keptCount: number, removedReportRows: boolean, previous: unknown): boolean {
  if (keptCount > 0 || removedReportRows) return false
  return previous === true
}

export type DotFieldPath =
  | 'firstName'
  | 'middleName'
  | 'lastName'
  | 'dateOfBirth'
  | 'phone'
  | 'currentLicenses.0.state'
  | 'currentLicenses.0.licenseNumber'
  | 'currentLicenses.0.typeClass'
  | 'currentLicenses.0.endorsements'
  | 'currentLicenses.0.expirationDate'

/** Paths hard-locked when a driver-owned parsed MVR is available. */
export const MVR_FORM1_LOCK_PATHS: readonly DotFieldPath[] = [
  'firstName',
  'middleName',
  'lastName',
  'dateOfBirth',
  'phone',
  'currentLicenses.0.state',
  'currentLicenses.0.licenseNumber',
  'currentLicenses.0.typeClass',
  'currentLicenses.0.endorsements',
  'currentLicenses.0.expirationDate',
] as const

/**
 * Who last wrote a Form 1 lock path.
 * User-typed values have no entry. A barcode read outranks those.
 * An MVR outranks the license, even when the string is identical —
 * the source change is the point.
 */
export type DotFieldProvenanceEntry =
  | {
      path: DotFieldPath
      source: 'mvr'
      mvrResultId: string
      orderId: string | null
      accioOrderNumber: string | null
      /** ISO timestamp of the MVR result / order completion used for this lock. */
      asOf: string
      /** Canonical value projected from MVR (server re-applies this on save). */
      value: string
    }
  | {
      path: DotFieldPath
      source: 'license'
      /** When the driver confirmed the scan. */
      asOf: string
      value: string
    }

/** The MVR-locked variant — the only one that carries Accio order identifiers. */
export type MvrFieldProvenanceEntry = Extract<DotFieldProvenanceEntry, { source: 'mvr' }>

export interface DotForm1FieldProvenance {
  version: 1
  fields: Partial<Record<DotFieldPath, DotFieldProvenanceEntry>>
}

/** Row-level provenance for Form 2 issuer-backed accidents / convictions / inspections. */
export interface DotForm2RowProvenance {
  version: 1
  /** MVR stamp — present when Form 2 has been projected from an MVR */
  mvrResultId: string | null
  orderId: string | null
  accioOrderNumber: string | null
  asOf: string | null
  /** Count of MVR-sourced accident rows currently projected. */
  mvrAccidentCount: number
  /** Count of MVR-sourced conviction rows currently projected. */
  mvrConvictionCount: number
  /** PSP stamp — present when Form 2 has been projected from a PSP */
  pspResultId?: string | null
  pspOrderId?: string | null
  pspAccioOrderNumber?: string | null
  pspAsOf?: string | null
  pspCrashCount?: number
  pspInspectionCount?: number
}

export type Form1WithProvenance = Record<string, unknown> & {
  _fieldProvenance?: DotForm1FieldProvenance
}

export type Form2WithProvenance = Record<string, unknown> & {
  accidents?: Form2AccidentRow[]
  convictions?: Form2ConvictionRow[]
  inspections?: import('@/lib/psp-to-form2-mapper').Form2InspectionRow[]
  hasNoAccidents?: boolean
  hasNoConvictions?: boolean
  hasNoInspections?: boolean
  _rowProvenance?: DotForm2RowProvenance
}

export function isDotFieldPath(path: string): path is DotFieldPath {
  return (MVR_FORM1_LOCK_PATHS as readonly string[]).includes(path)
}

/** Read a dotted path from Form 1 (supports currentLicenses.0.x). */
export function getForm1ValueAtPath(form1: Record<string, unknown> | null | undefined, path: string): string {
  if (!form1) return ''
  const parts = path.split('.')
  let cur: unknown = form1
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return ''
    cur = (cur as Record<string, unknown>)[part]
  }
  if (cur == null) return ''
  return String(cur)
}

/** Immutable set at a dotted path (creates license[0] shell if needed). */
export function setForm1ValueAtPath(
  form1: Record<string, unknown>,
  path: string,
  value: string,
): Record<string, unknown> {
  const parts = path.split('.')
  if (parts.length === 1) {
    return { ...form1, [parts[0]]: value }
  }

  // currentLicenses.0.field
  if (parts[0] === 'currentLicenses' && parts.length === 3) {
    const index = Number(parts[1])
    const field = parts[2]
    const licenses = Array.isArray(form1.currentLicenses)
      ? [...(form1.currentLicenses as Record<string, unknown>[])]
      : []
    while (licenses.length <= index) {
      licenses.push({
        state: '',
        licenseNumber: '',
        typeClass: '',
        endorsements: '',
        expirationDate: '',
      })
    }
    licenses[index] = { ...licenses[index], [field]: value }
    return { ...form1, currentLicenses: licenses }
  }

  return form1
}

/**
 * Build provenance entries from an MVR-mapped Form 1 payload.
 * Skips empty MVR values — we don't lock a blank field.
 */
export function buildMvrForm1Provenance(
  mvrForm1: Record<string, unknown>,
  meta: {
    mvrResultId: string
    orderId?: string | null
    accioOrderNumber?: string | null
    asOf: string
  },
): DotForm1FieldProvenance {
  const fields: DotForm1FieldProvenance['fields'] = {}
  for (const path of MVR_FORM1_LOCK_PATHS) {
    const value = getForm1ValueAtPath(mvrForm1, path).trim()
    if (!value) continue
    fields[path] = {
      path,
      source: 'mvr',
      mvrResultId: meta.mvrResultId,
      orderId: meta.orderId ?? null,
      accioOrderNumber: meta.accioOrderNumber ?? null,
      asOf: meta.asOf,
      value,
    }
  }
  return { version: 1, fields }
}

/** Overwrite locked paths on form1 from provenance values (projection). */
export function projectLockedFieldsOntoForm1(
  form1: Record<string, unknown> | null | undefined,
  provenance: DotForm1FieldProvenance | null | undefined,
): Record<string, unknown> {
  const base: Record<string, unknown> = form1 ? { ...form1 } : {}
  if (!provenance?.fields) {
    return base
  }
  let next = base
  for (const entry of Object.values(provenance.fields)) {
    if (!entry) continue
    if (entry.source !== 'mvr' && entry.source !== 'license') continue
    next = setForm1ValueAtPath(next, entry.path, entry.value)
  }
  return { ...next, _fieldProvenance: provenance }
}

/**
 * Merge MVR-mapped values into an existing Form 1 and stamp provenance.
 * Existing non-locked fields (SSN, position, etc.) are preserved.
 * Always overwrites lock paths from MVR — even when values already match
 * (late-MVR path: badge + lock is the state change).
 */
export function mergeMvrPrefillIntoForm1(
  existing: Record<string, unknown> | null | undefined,
  mvrForm1: Record<string, unknown>,
  provenance: DotForm1FieldProvenance,
): Form1WithProvenance {
  const base: Record<string, unknown> = existing ? { ...existing } : {}

  let merged = { ...base }
  for (const path of MVR_FORM1_LOCK_PATHS) {
    const mvrVal = getForm1ValueAtPath(mvrForm1, path).trim()
    if (mvrVal) {
      merged = setForm1ValueAtPath(merged, path, mvrVal)
    }
  }

  // Soft-fill empty email/address only. Phone is an MVR lock path — it
  // overwrites above. Never lock a blank or Accio 555 placeholder (mapper
  // already strips those, so an empty MVR phone skips the lock).
  const softFillKeys = ['email'] as const
  for (const key of softFillKeys) {
    const existingVal = String(base[key] ?? '').trim()
    const mvrVal = String(mvrForm1[key] ?? '').trim()
    if (!existingVal && mvrVal) {
      merged[key] = mvrVal
    }
  }

  const existingMailing = (base.currentMailing as Record<string, unknown> | undefined) ?? {}
  const mvrMailing = (mvrForm1.currentMailing as Record<string, unknown> | undefined) ?? {}
  if (mvrMailing && typeof mvrMailing === 'object') {
    const fromLicense = existingMailing._source === 'license'
    const mailing = { ...existingMailing }
    let wrote = false
    for (const key of ['street', 'city', 'state', 'zipCode'] as const) {
      const mvrVal = String(mvrMailing[key] ?? '').trim()
      if (!mvrVal) continue
      const existingVal = String(mailing[key] ?? '').trim()
      // A license address loses to the MVR even when the street is the same.
      // An address the driver typed, with no license stamp, is only filled when blank.
      if (!existingVal || fromLicense) {
        mailing[key] = mvrVal
        wrote = true
      }
    }
    if (wrote) mailing._source = 'mvr'
    merged.currentMailing = mailing
  }

  const prior = (base as Form1WithProvenance)._fieldProvenance
  const overlaid: DotForm1FieldProvenance = {
    version: 1,
    fields: { ...(prior?.fields ?? {}), ...provenance.fields },
  }
  return projectLockedFieldsOntoForm1(merged, overlaid) as Form1WithProvenance
}

/**
 * Form 2 keeps the driver's accident and conviction rows.
 * Accidents, crashes, and convictions from an MVR or PSP are not written here.
 * Personal info from the MVR stays on Form 1. Report rows copied earlier are removed.
 */
export function mergeMvrRowsIntoForm2(
  existing: Record<string, unknown> | null | undefined,
  _mvrAccidents: Form2AccidentRow[],
  _mvrConvictions: Form2ConvictionRow[],
  meta: {
    mvrResultId: string
    orderId?: string | null
    accioOrderNumber?: string | null
    asOf: string
  },
): Form2WithProvenance {
  void _mvrAccidents
  void _mvrConvictions
  const base: Record<string, unknown> = existing ? { ...existing } : {}
  const prevProv = (base._rowProvenance as DotForm2RowProvenance | undefined) ?? null

  const existingAccidents = Array.isArray(base.accidents)
    ? (base.accidents as Form2AccidentRow[])
    : []
  const existingConvictions = Array.isArray(base.convictions)
    ? (base.convictions as Form2ConvictionRow[])
    : []

  const removedReportAccidents = existingAccidents.some((row) => row._source === 'mvr' || row._source === 'psp')
  const removedReportConvictions = existingConvictions.some((row) => row._source === 'mvr')

  const accidents = existingAccidents
    .filter((row) => row._source !== 'mvr' && row._source !== 'psp')
    .filter((row) => Boolean(row.date?.trim() || row.nature?.trim()))
    .map((row) => ({ ...row, _source: 'self' as const }))

  const convictions = existingConvictions
    .filter((row) => row._source !== 'mvr')
    .filter((row) => Boolean(row.dateConvicted?.trim() || row.violation?.trim()))
    .map((row) => ({ ...row, _source: 'self' as const }))

  const hasNoAccidents = driverSaidNone(accidents.length, removedReportAccidents, base.hasNoAccidents)
  const hasNoConvictions = driverSaidNone(convictions.length, removedReportConvictions, base.hasNoConvictions)

  const rowProvenance: DotForm2RowProvenance = {
    version: 1,
    mvrResultId: meta.mvrResultId,
    orderId: meta.orderId ?? null,
    accioOrderNumber: meta.accioOrderNumber ?? null,
    asOf: meta.asOf,
    mvrAccidentCount: 0,
    mvrConvictionCount: 0,
    // Preserve any prior PSP stamp
    pspResultId: prevProv?.pspResultId ?? null,
    pspOrderId: prevProv?.pspOrderId ?? null,
    pspAccioOrderNumber: prevProv?.pspAccioOrderNumber ?? null,
    pspAsOf: prevProv?.pspAsOf ?? null,
    pspCrashCount: prevProv?.pspCrashCount,
    pspInspectionCount: prevProv?.pspInspectionCount,
  }

  return {
    ...base,
    accidents:
      accidents.length > 0
        ? accidents
        : [
            {
              date: '',
              nature: '',
              fatalities: '',
              injuries: '',
              chemicalSpills: '',
              atFault: '',
              _source: 'self',
            },
          ],
    convictions:
      convictions.length > 0
        ? convictions
        : [
            {
              dateConvicted: '',
              violation: '',
              stateOfViolation: '',
              penalty: '',
              _source: 'self',
            },
          ],
    hasNoAccidents,
    hasNoConvictions,
    _rowProvenance: rowProvenance,
  }
}

/**
 * PSP inspections can still land on Form 2. Crashes do not.
 * Accident rows copied from a PSP or MVR report are removed. The driver lists those himself.
 */
export function mergePspRowsIntoForm2(
  existing: Record<string, unknown> | null | undefined,
  pspCrashesAsAccidents: Form2AccidentRow[],
  pspInspections: import('@/lib/psp-to-form2-mapper').Form2InspectionRow[],
  meta: {
    pspResultId: string
    orderId?: string | null
    accioOrderNumber?: string | null
    asOf: string
  },
): Form2WithProvenance {
  const base: Record<string, unknown> = existing ? { ...existing } : {}
  const prevProv = (base._rowProvenance as DotForm2RowProvenance | undefined) ?? null

  const existingAccidents = Array.isArray(base.accidents)
    ? (base.accidents as Form2AccidentRow[])
    : []
  const existingInspections = Array.isArray(base.inspections)
    ? (base.inspections as import('@/lib/psp-to-form2-mapper').Form2InspectionRow[])
    : []

  void pspCrashesAsAccidents

  const removedReportAccidents = existingAccidents.some(
    (row) => row._source === 'mvr' || row._source === 'psp',
  )
  const accidents = existingAccidents
    .filter((row) => row._source !== 'mvr' && row._source !== 'psp')
    .filter((row) => Boolean(row.date?.trim() || row.nature?.trim()))
    .map((row) => ({ ...row, _source: 'self' as const }))

  const keepInspections = existingInspections
    .filter((row) => {
      if (row._source === 'psp') return false
      return Boolean(row.date?.trim() || row.reportNumber?.trim() || row.result?.trim())
    })
    .map((row) => ({ ...row, _source: 'self' as const }))

  const inspections = [...pspInspections, ...keepInspections]
  const hasNoAccidents = driverSaidNone(accidents.length, removedReportAccidents, base.hasNoAccidents)
  const hasNoInspections = inspections.length === 0

  const rowProvenance: DotForm2RowProvenance = {
    version: 1,
    mvrResultId: prevProv?.mvrResultId ?? null,
    orderId: prevProv?.orderId ?? null,
    accioOrderNumber: prevProv?.accioOrderNumber ?? null,
    asOf: prevProv?.asOf ?? null,
    mvrAccidentCount: 0,
    mvrConvictionCount: prevProv?.mvrConvictionCount ?? 0,
    pspResultId: meta.pspResultId,
    pspOrderId: meta.orderId ?? null,
    pspAccioOrderNumber: meta.accioOrderNumber ?? null,
    pspAsOf: meta.asOf,
    pspCrashCount: 0,
    pspInspectionCount: pspInspections.length,
  }

  return {
    ...base,
    accidents:
      accidents.length > 0
        ? accidents
        : [
            {
              date: '',
              nature: '',
              fatalities: '',
              injuries: '',
              chemicalSpills: '',
              atFault: '',
              _source: 'self',
            },
          ],
    inspections,
    hasNoAccidents,
    hasNoInspections,
    _rowProvenance: rowProvenance,
  }
}

/** Saved applications may still contain report rows. Readers drop them. */
export function omitScreeningHistoryFromForm2(
  form2: object | null | undefined,
): Form2WithProvenance | null {
  if (!form2) return null
  const record = form2 as Record<string, unknown>
  const prev = record._rowProvenance as DotForm2RowProvenance | undefined
  return mergeMvrRowsIntoForm2(record, [], [], {
    mvrResultId: prev?.mvrResultId ?? '',
    orderId: prev?.orderId,
    accioOrderNumber: prev?.accioOrderNumber,
    asOf: prev?.asOf ?? new Date(0).toISOString(),
  })
}

export function getLockedPaths(
  provenance: DotForm1FieldProvenance | null | undefined,
): Set<DotFieldPath> {
  const locked = new Set<DotFieldPath>()
  if (!provenance?.fields) return locked
  for (const [path, entry] of Object.entries(provenance.fields)) {
    if ((entry?.source === 'mvr' || entry?.source === 'license') && isDotFieldPath(path)) {
      locked.add(path)
    }
  }
  return locked
}

export function formatMvrFieldBadge(
  entry: MvrFieldProvenanceEntry,
): string {
  const order = entry.accioOrderNumber ? `Accio order #${entry.accioOrderNumber}` : 'your MVR'
  const asOf = entry.asOf ? new Date(entry.asOf).toLocaleDateString() : null
  return asOf
    ? `Verified — sourced from ${order}, as of ${asOf}`
    : `Verified — sourced from ${order}`
}

export function formatMvrRowBadge(meta: {
  accioOrderNumber?: string | null
  asOf?: string | null
  /** Defaults to MVR; PSP rows pass 'psp' for honest copy */
  kind?: 'mvr' | 'psp'
}): string {
  const kind = meta.kind ?? 'mvr'
  const fallback = kind === 'psp' ? 'your PSP' : 'your MVR'
  const order = meta.accioOrderNumber ? `Accio order #${meta.accioOrderNumber}` : fallback
  const asOf = meta.asOf ? new Date(meta.asOf).toLocaleDateString() : null
  return asOf
    ? `Verified — sourced from ${order}, as of ${asOf}`
    : `Verified — sourced from ${order}`
}

/** Strip provenance before comparing / sending to mappers that don't expect it. */
export function stripForm1Provenance<T extends Record<string, unknown>>(form1: T): Omit<T, '_fieldProvenance'> {
  const { _fieldProvenance: _, ...rest } = form1
  return rest
}
