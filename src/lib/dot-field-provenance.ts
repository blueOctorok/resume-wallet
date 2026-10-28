/**
 * P3.7 — DOT field provenance + lock helpers (MVR → Form 1 + Form 2).
 *
 * Locked fields/rows are *projected* from the issuer-backed MVR on save/load/webhook,
 * not merely copied into application_data and disabled in the UI.
 *
 * Form 1: hard-lock identity/license scalar paths.
 * Form 2: MVR accident/conviction rows lock against edit/delete; driver may append
 * self-certified rows (391.21 must not block additional disclosures).
 * At-fault, fatalities, injuries, and spills stay open when the record did not
 * state them. Conviction state and penalty stay open when that violation block
 * did not include them. A later re-projection keeps those driver answers.
 *
 * Honesty: only issuer-backed paths get source:'mvr'. Self-reported fields stay open.
 */

import type { Form2AccidentRow, Form2ConvictionRow } from '@/lib/mvr-to-form2-mapper'

function isYesNo(value: string | undefined): value is 'yes' | 'no' {
  return value === 'yes' || value === 'no'
}

/**
 * State MVRs omit fault, fatalities, injuries, and spills. PSP sometimes has
 * the counts and never has fault. A blank incoming field is the driver's
 * answer, and a later re-projection has to keep it. A value the report
 * itself stated replaces that answer and stays locked.
 */
function carryBlankDriverAnswer(
  incoming: string | undefined,
  prior: string | undefined,
  priorFromRecord: boolean | undefined,
  accept: (value: string) => boolean,
): { value: string; fromRecord: boolean } {
  const next = (incoming ?? '').trim()
  if (next && accept(next)) return { value: next, fromRecord: true }
  const kept = (prior ?? '').trim()
  if (kept && priorFromRecord !== true && accept(kept)) return { value: kept, fromRecord: false }
  return { value: '', fromRecord: false }
}

function anyNonEmpty(value: string): boolean {
  return value.trim().length > 0
}

function carryDriverAccidentAnswers(
  previous: Form2AccidentRow[],
  incoming: Form2AccidentRow[],
): Form2AccidentRow[] {
  return incoming.map((row) => {
    const prior = previous.find((existing) => {
      if (row._mvrKey && existing._mvrKey === row._mvrKey) return true
      if (row._pspKey && existing._pspKey === row._pspKey) return true
      return false
    })
    const atFault = carryBlankDriverAnswer(row.atFault, prior?.atFault, prior?._faultFromRecord, isYesNo)
    const fatalities = carryBlankDriverAnswer(
      row.fatalities,
      prior?.fatalities,
      prior?._fatalitiesFromRecord,
      anyNonEmpty,
    )
    const injuries = carryBlankDriverAnswer(
      row.injuries,
      prior?.injuries,
      prior?._injuriesFromRecord,
      anyNonEmpty,
    )
    const spills = carryBlankDriverAnswer(
      row.chemicalSpills,
      prior?.chemicalSpills,
      prior?._spillsFromRecord,
      anyNonEmpty,
    )
    return {
      ...row,
      atFault: atFault.value,
      _faultFromRecord: atFault.fromRecord,
      fatalities: fatalities.value,
      _fatalitiesFromRecord: fatalities.fromRecord,
      injuries: injuries.value,
      _injuriesFromRecord: injuries.fromRecord,
      chemicalSpills: spills.value,
      _spillsFromRecord: spills.fromRecord,
    }
  })
}

/** A state or penalty the violation itself omitted stays the driver's answer. */
function carryDriverConvictionAnswers(
  previous: Form2ConvictionRow[],
  incoming: Form2ConvictionRow[],
): Form2ConvictionRow[] {
  return incoming.map((row) => {
    const prior = previous.find((existing) => row._mvrKey && existing._mvrKey === row._mvrKey)
    const stateFromRecord = row._stateFromRecord === true
    const driverState =
      !stateFromRecord && prior && prior._stateFromRecord !== true
        ? (prior.stateOfViolation ?? '').trim()
        : ''
    const penaltyFromRecord = row._penaltyFromRecord === true
    const driverPenalty =
      !penaltyFromRecord && prior && prior._penaltyFromRecord !== true
        ? (prior.penalty ?? '').trim()
        : ''
    return {
      ...row,
      stateOfViolation: stateFromRecord ? row.stateOfViolation : driverState || row.stateOfViolation,
      _stateFromRecord: stateFromRecord,
      penalty: penaltyFromRecord ? row.penalty : driverPenalty || row.penalty,
      _penaltyFromRecord: penaltyFromRecord,
    }
  })
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
 * Merge MVR accident/conviction rows into Form 2.
 * - Replaces all prior `_source:'mvr'` rows with the fresh MVR projection
 * - Keeps `_source:'psp'` and `_source:'self'` (or untagged legacy) rows
 * - Even identical values get re-stamped so badges appear (late-MVR path)
 */
export function mergeMvrRowsIntoForm2(
  existing: Record<string, unknown> | null | undefined,
  mvrAccidents: Form2AccidentRow[],
  mvrConvictions: Form2ConvictionRow[],
  meta: {
    mvrResultId: string
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
  const existingConvictions = Array.isArray(base.convictions)
    ? (base.convictions as Form2ConvictionRow[])
    : []

  // Keep PSP + self-certified rows (driver disclosures / FMCSA crashes)
  const keepAccidents = existingAccidents
    .filter((row) => {
      if (row._source === 'mvr') return false
      return Boolean(row.date?.trim() || row.nature?.trim())
    })
    .map((row) =>
      row._source === 'psp' ? row : { ...row, _source: 'self' as const },
    )

  const keepConvictions = existingConvictions
    .filter((row) => {
      if (row._source === 'mvr') return false
      return Boolean(row.dateConvicted?.trim() || row.violation?.trim())
    })
    .map((row) =>
      row._source === 'psp' ? row : { ...row, _source: 'self' as const },
    )

  const priorMvrAccidents = existingAccidents.filter((row) => row._source === 'mvr')
  const accidents = [...carryDriverAccidentAnswers(priorMvrAccidents, mvrAccidents), ...keepAccidents]
  const priorMvrConvictions = existingConvictions.filter((row) => row._source === 'mvr')
  const convictions = [...carryDriverConvictionAnswers(priorMvrConvictions, mvrConvictions), ...keepConvictions]

  const hasNoAccidents = accidents.length === 0
  const hasNoConvictions = convictions.length === 0

  const rowProvenance: DotForm2RowProvenance = {
    version: 1,
    mvrResultId: meta.mvrResultId,
    orderId: meta.orderId ?? null,
    accioOrderNumber: meta.accioOrderNumber ?? null,
    asOf: meta.asOf,
    mvrAccidentCount: mvrAccidents.length,
    mvrConvictionCount: mvrConvictions.length,
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
 * Merge PSP crash/inspection rows into Form 2.
 * - Crashes replace prior `_source:'psp'` accident rows; keep MVR + self
 * - Inspections array is fully replaced with PSP projection (self appends kept)
 * - Preserves MVR provenance fields on `_rowProvenance`
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

  const keepAccidents = existingAccidents
    .filter((row) => {
      if (row._source === 'psp') return false
      return Boolean(row.date?.trim() || row.nature?.trim())
    })
    .map((row) =>
      row._source === 'mvr' ? row : { ...row, _source: 'self' as const },
    )

  const keepInspections = existingInspections
    .filter((row) => {
      if (row._source === 'psp') return false
      return Boolean(row.date?.trim() || row.reportNumber?.trim() || row.result?.trim())
    })
    .map((row) => ({ ...row, _source: 'self' as const }))

  // Order: MVR crashes, PSP crashes, self disclosures
  const mvrAcc = keepAccidents.filter((r) => r._source === 'mvr')
  const selfAcc = keepAccidents.filter((r) => r._source !== 'mvr')
  const priorPspAccidents = existingAccidents.filter((row) => row._source === 'psp')
  const orderedAccidents = [
    ...mvrAcc,
    ...carryDriverAccidentAnswers(priorPspAccidents, pspCrashesAsAccidents),
    ...selfAcc,
  ]
  const inspections = [...pspInspections, ...keepInspections]

  const hasNoAccidents = orderedAccidents.length === 0
  const hasNoInspections = inspections.length === 0

  const rowProvenance: DotForm2RowProvenance = {
    version: 1,
    mvrResultId: prevProv?.mvrResultId ?? null,
    orderId: prevProv?.orderId ?? null,
    accioOrderNumber: prevProv?.accioOrderNumber ?? null,
    asOf: prevProv?.asOf ?? null,
    mvrAccidentCount: prevProv?.mvrAccidentCount ?? 0,
    mvrConvictionCount: prevProv?.mvrConvictionCount ?? 0,
    pspResultId: meta.pspResultId,
    pspOrderId: meta.orderId ?? null,
    pspAccioOrderNumber: meta.accioOrderNumber ?? null,
    pspAsOf: meta.asOf,
    pspCrashCount: pspCrashesAsAccidents.length,
    pspInspectionCount: pspInspections.length,
  }

  return {
    ...base,
    accidents:
      orderedAccidents.length > 0
        ? orderedAccidents
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
