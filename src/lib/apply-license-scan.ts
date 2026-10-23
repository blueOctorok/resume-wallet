/**
 * Write a confirmed license scan onto the DOT application.
 *
 * Trust order on Form 1 identity and license fields:
 *   what the driver typed  <  the barcode read  <  the MVR
 *
 * The barcode read replaces typed values on the DOT application and on the
 * profile, and locks them. An MVR replaces that read later, even when the
 * string is the same. An MVR lock is never overwritten.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  emptyLicenseFields,
  licenseClassForDot,
  type LicenseScanFields,
} from '@/lib/aamva-license'
import { ensureHubBlockInstalled, getCdlData, getLicenseScan, saveCdlData } from '@/lib/block-data'
import {
  getForm1ValueAtPath,
  isDotFieldPath,
  setForm1ValueAtPath,
  type DotFieldPath,
  type DotForm1FieldProvenance,
  type Form1WithProvenance,
} from '@/lib/dot-field-provenance'

const FORM1_PATHS = [
  ['firstName', 'firstName'],
  ['middleName', 'middleName'],
  ['lastName', 'lastName'],
  ['dateOfBirth', 'dateOfBirth'],
  ['currentLicenses.0.state', 'state'],
  ['currentLicenses.0.licenseNumber', 'licenseNumber'],
  ['currentLicenses.0.typeClass', 'licenseClass'],
  ['currentLicenses.0.endorsements', 'endorsements'],
  ['currentLicenses.0.expirationDate', 'expirationDate'],
  ['currentLicenses.0.restrictions', 'restrictions'],
] as const

type FieldKey = (typeof FORM1_PATHS)[number][1]

export interface LicenseSoftFillResult {
  form1: Form1WithProvenance
  filled: string[]
}

export function softFillForm1FromLicense(
  form1: Record<string, unknown> | null | undefined,
  fields: LicenseScanFields,
): LicenseSoftFillResult {
  const prior = (form1 as Form1WithProvenance | null | undefined)?._fieldProvenance
  let next: Record<string, unknown> = { ...(form1 ?? {}) }
  const stamped: DotForm1FieldProvenance['fields'] = { ...(prior?.fields ?? {}) }
  const filled: string[] = []
  const asOf = new Date().toISOString()

  for (const [path, key] of FORM1_PATHS) {
    if (isDotFieldPath(path) && prior?.fields?.[path]?.source === 'mvr') continue
    const incoming = formValue(fields, key)
    if (!incoming) continue
    const current = getForm1ValueAtPath(next, path).trim()
    const already =
      isDotFieldPath(path) &&
      prior?.fields?.[path]?.source === 'license' &&
      prior.fields[path]?.value === incoming &&
      current === incoming
    if (already) continue
    next = setForm1ValueAtPath(next, path, incoming)
    if (isDotFieldPath(path)) {
      stamped[path] = { path, source: 'license', asOf, value: incoming }
    }
    filled.push(labelFor(key))
  }

  next = softFillMailing(next, fields, filled)
  next._fieldProvenance = { version: 1, fields: stamped }
  return { form1: next, filled }
}

function formValue(fields: LicenseScanFields, key: FieldKey): string {
  if (key === 'licenseClass') return licenseClassForDot(fields.licenseClass)
  if (key === 'endorsements') return fields.endorsements.join(', ')
  if (key === 'restrictions') return fields.restrictions.join(', ')
  return fields[key].trim()
}

function labelFor(key: FieldKey): string {
  switch (key) {
    case 'firstName': return 'First name'
    case 'middleName': return 'Middle name'
    case 'lastName': return 'Last name'
    case 'dateOfBirth': return 'Date of birth'
    case 'state': return 'License state'
    case 'licenseNumber': return 'License number'
    case 'licenseClass': return 'License class'
    case 'endorsements': return 'Endorsements'
    case 'expirationDate': return 'Expiration'
    case 'restrictions': return 'Restrictions'
  }
}

function softFillMailing(
  form1: Record<string, unknown>,
  fields: LicenseScanFields,
  filled: string[],
): Record<string, unknown> {
  const current = (form1.currentMailing ?? {}) as Record<string, unknown>
  if (current._source === 'mvr') return form1
  const next = { ...current }
  let changed = false
  const pairs: Array<[string, string]> = [
    ['street', fields.street],
    ['city', fields.city],
    ['state', fields.state],
    ['zipCode', fields.postalCode],
  ]
  for (const [key, value] of pairs) {
    const incoming = value.trim()
    if (!incoming) continue
    if (String(next[key] ?? '').trim() === incoming && next._source === 'license') continue
    if (String(next[key] ?? '').trim() !== incoming) changed = true
    next[key] = incoming
  }
  if (!changed && next._source === 'license') return form1
  if (!pairs.some(([, value]) => value.trim())) return form1
  next._source = 'license'
  if (!String(next.yearsAtAddress ?? '').trim()) next.yearsAtAddress = ''
  filled.push('Mailing address')
  return { ...form1, currentMailing: next }
}

export async function applyConfirmedLicenseScan(
  supabase: SupabaseClient,
  userId: string,
  fields: LicenseScanFields,
): Promise<{ filled: string[] }> {
  const filled: string[] = []

  await ensureHubBlockInstalled(supabase, userId, 'driver-license')
  if (fields.licenseClass || fields.licenseNumber) {
    await ensureHubBlockInstalled(supabase, userId, 'driver-cdl-credentials')
  }

  const { filled: dotFilled, form1 } = await fillDotApplication(supabase, userId, fields)
  filled.push(...dotFilled)

  // Profile is second so an MVR-locked DOT name wins over the barcode.
  const profileFilled = await fillProfileFromLicense(supabase, userId, fields, form1)
  filled.push(...profileFilled)

  const cdlFilled = await fillCdlFromLicense(supabase, userId, fields, form1)
  filled.push(...cdlFilled)

  return { filled }
}

function sameList(current: string[] | null | undefined, next: string[]): boolean {
  if (!current || current.length !== next.length) return false
  return current.every((item, index) => item === next[index])
}

function licenseOwns(form1: Form1WithProvenance | null, path: DotFieldPath): boolean {
  return form1?._fieldProvenance?.fields?.[path]?.source === 'license'
}

async function fillCdlFromLicense(
  supabase: SupabaseClient,
  userId: string,
  fields: LicenseScanFields,
  form1: Form1WithProvenance | null,
): Promise<string[]> {
  const existing = await getCdlData(supabase, userId)
  const patch: Parameters<typeof saveCdlData>[2] = {}
  const filled: string[] = []

  const assign = (
    column: 'cdl_number' | 'cdl_state' | 'cdl_class' | 'cdl_expiration',
    value: string,
    label: string,
  ) => {
    if (!value) return
    const current = existing?.[column]
    if (typeof current === 'string' && current.trim() === value) return
    patch[column] = value
    filled.push(label)
  }

  if (licenseOwns(form1, 'currentLicenses.0.licenseNumber')) {
    assign('cdl_number', fields.licenseNumber, 'CDL number')
  }
  if (licenseOwns(form1, 'currentLicenses.0.state')) {
    assign('cdl_state', fields.state, 'CDL state')
  }
  if (licenseOwns(form1, 'currentLicenses.0.typeClass')) {
    assign('cdl_class', fields.licenseClass, 'CDL class')
  }
  if (licenseOwns(form1, 'currentLicenses.0.expirationDate')) {
    assign('cdl_expiration', fields.expirationDate, 'CDL expiration')
  }
  if (
    fields.endorsements.length > 0 &&
    licenseOwns(form1, 'currentLicenses.0.endorsements') &&
    !sameList(existing?.endorsements, fields.endorsements)
  ) {
    patch.endorsements = fields.endorsements
    filled.push('CDL endorsements')
  }
  if (fields.restrictions.length > 0 && !sameList(existing?.restrictions, fields.restrictions)) {
    patch.restrictions = fields.restrictions
    filled.push('CDL restrictions')
  }

  if (Object.keys(patch).length === 0) return []
  await saveCdlData(supabase, userId, patch)
  return filled
}

export interface ProfileIdentityRow {
  first_name?: string | null
  last_name?: string | null
  display_name?: string | null
  date_of_birth?: string | null
  city?: string | null
  state?: string | null
  zip_code?: string | null
}

function sameIdentity(current: string | null | undefined, next: string): boolean {
  const left = (current ?? '').trim().toLowerCase()
  const right = next.trim().toLowerCase()
  if (!right) return true
  if (left === right) return true
  // Dates come back from Postgres as YYYY-MM-DD or with a time suffix.
  return left.slice(0, 10) === right.slice(0, 10) && /^\d{4}-\d{2}-\d{2}/.test(right)
}

/** Barcode value, unless an MVR already locked that DOT field. */
function valueOverTyped(
  barcode: string,
  form1: Form1WithProvenance | null,
  path: DotFieldPath,
): string {
  const locked = form1?._fieldProvenance?.fields?.[path]
  if (locked?.source === 'mvr' && locked.value.trim()) return locked.value.trim()
  return barcode.trim()
}

function mailingOverTyped(
  barcode: string,
  form1: Form1WithProvenance | null,
  key: 'city' | 'state' | 'zipCode',
): string {
  const mailing = form1?.currentMailing as Record<string, unknown> | undefined
  if (mailing?._source === 'mvr') return String(mailing[key] ?? '').trim()
  return barcode.trim()
}

/**
 * Fields to write onto the profile. A typed name, date of birth, or address
 * is replaced. An empty barcode field is left alone. An MVR lock on the DOT
 * application wins over the barcode, so the profile stays in agreement with it.
 */
export function profilePatchFromLicense(
  profile: ProfileIdentityRow | null,
  fields: LicenseScanFields,
  form1: Form1WithProvenance | null,
): Record<string, string> {
  const first = valueOverTyped(fields.firstName, form1, 'firstName')
  const last = valueOverTyped(fields.lastName, form1, 'lastName')
  const patch: Record<string, string> = {}
  const take = (column: keyof ProfileIdentityRow, value: string) => {
    if (!value || sameIdentity(profile?.[column], value)) return
    patch[column] = value
  }

  take('first_name', first)
  take('last_name', last)
  take('date_of_birth', valueOverTyped(fields.dateOfBirth, form1, 'dateOfBirth'))
  take('city', mailingOverTyped(fields.city, form1, 'city'))
  take('state', mailingOverTyped(fields.state, form1, 'state'))
  take('zip_code', mailingOverTyped(fields.postalCode, form1, 'zipCode'))

  const display = licenseIdentityName(fields, form1)
  take('display_name', display)
  return patch
}

/** Name the barcode (or an MVR lock) should show. Middle name is included. */
export function licenseIdentityName(
  fields: LicenseScanFields,
  form1: Form1WithProvenance | null,
): string {
  const first = valueOverTyped(fields.firstName, form1, 'firstName')
  const middle = valueOverTyped(fields.middleName, form1, 'middleName')
  const last = valueOverTyped(fields.lastName, form1, 'lastName')
  return [first, middle, last].filter(Boolean).join(' ')
}

function coerceLicenseFields(raw: unknown): LicenseScanFields | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const text = (key: string) => (typeof row[key] === 'string' ? row[key].trim() : '')
  if (!text('firstName') && !text('lastName')) return null
  return {
    ...emptyLicenseFields(),
    firstName: text('firstName'),
    middleName: text('middleName'),
    lastName: text('lastName'),
  }
}

/**
 * A confirmed barcode read is the profile name until an MVR locks it.
 * A later profile save can put the typed name back into first and last
 * while leaving the scan in place, so the card calls this on load.
 * Returns the name to show, or null when there is no confirmed read.
 */
export async function syncConfirmedLicenseName(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const scan = await getLicenseScan(supabase, userId)
  if (!scan?.confirmed_at) return null
  const fields = coerceLicenseFields(scan.parsed_fields)
  if (!fields) return null

  const { data: app } = await supabase
    .from('driver_applications')
    .select('application_data')
    .eq('user_id', userId)
    .maybeSingle()
  const form1 =
    (app?.application_data as { form1?: Form1WithProvenance | null } | null)?.form1 ?? null

  await fillProfileFromLicense(supabase, userId, fields, form1)
  const name = licenseIdentityName(fields, form1)
  return name || null
}

async function fillProfileFromLicense(
  supabase: SupabaseClient,
  userId: string,
  fields: LicenseScanFields,
  form1: Form1WithProvenance | null,
): Promise<string[]> {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('first_name, last_name, display_name, date_of_birth, city, state, zip_code')
    .eq('user_id', userId)
    .maybeSingle()

  const patch = profilePatchFromLicense(profile, fields, form1)
  if (Object.keys(patch).length === 0) return []

  const { error } = await supabase
    .from('user_profiles')
    .upsert({ user_id: userId, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })

  if (error) {
    console.warn('[LICENSE] profile soft-fill failed:', error.message)
    return []
  }
  return ['Profile']
}

async function fillDotApplication(
  supabase: SupabaseClient,
  userId: string,
  fields: LicenseScanFields,
): Promise<{ filled: string[]; form1: Form1WithProvenance | null }> {
  const { data: app, error } = await supabase
    .from('driver_applications')
    .select('id, application_data')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.warn('[LICENSE] DOT load failed:', error.message)
    return { filled: [], form1: null }
  }

  const applicationData = (app?.application_data ?? {}) as {
    form1?: Record<string, unknown> | null
    form2?: unknown
    form3?: unknown
  }
  const { form1, filled } = softFillForm1FromLicense(applicationData.form1, fields)
  if (filled.length === 0) return { filled: [], form1 }

  const next = {
    ...applicationData,
    form1,
    form2: applicationData.form2 ?? null,
    form3: applicationData.form3 ?? null,
  }

  if (app?.id) {
    const { error: updateError } = await supabase
      .from('driver_applications')
      .update({ application_data: next, updated_at: new Date().toISOString() })
      .eq('id', app.id)
    if (updateError) {
      console.warn('[LICENSE] DOT update failed:', updateError.message)
      return { filled: [], form1: null }
    }
    return { filled: filled.map((label) => `DOT ${label}`), form1 }
  }

  const { error: insertError } = await supabase.from('driver_applications').insert({
    user_id: userId,
    application_data: next,
    current_step: 1,
    is_complete: false,
  })
  if (insertError) {
    console.warn('[LICENSE] DOT create failed:', insertError.message)
    return { filled: [], form1: null }
  }
  await ensureHubBlockInstalled(supabase, userId, 'driver-dot-application')
  return { filled: filled.map((label) => `DOT ${label}`), form1 }
}
