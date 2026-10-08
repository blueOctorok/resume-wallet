/**
 * Write a confirmed license scan into the places that were still empty.
 *
 * A filled field, and any path an MVR has locked, is left alone. The scan is
 * the first fill for someone who does not have a record pull yet. It does not
 * correct or override the DMV record.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  licenseClassForDot,
  type LicenseScanFields,
} from '@/lib/aamva-license'
import { ensureHubBlockInstalled, getCdlData, saveCdlData } from '@/lib/block-data'
import {
  getForm1ValueAtPath,
  getLockedPaths,
  isDotFieldPath,
  setForm1ValueAtPath,
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
  const locked = getLockedPaths(
    (form1 as Form1WithProvenance | null | undefined)?._fieldProvenance,
  )
  let next: Record<string, unknown> = { ...(form1 ?? {}) }
  const filled: string[] = []

  for (const [path, key] of FORM1_PATHS) {
    if (isDotFieldPath(path) && locked.has(path)) continue
    const incoming = formValue(fields, key)
    if (!incoming) continue
    if (getForm1ValueAtPath(next, path).trim()) continue
    next = setForm1ValueAtPath(next, path, incoming)
    filled.push(labelFor(key))
  }

  next = softFillMailing(next, fields, filled)
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
  const next = { ...current }
  let changed = false
  const pairs: Array<[string, string]> = [
    ['street', fields.street],
    ['city', fields.city],
    ['state', fields.state],
    ['zipCode', fields.postalCode],
  ]
  for (const [key, value] of pairs) {
    if (!value.trim()) continue
    if (String(next[key] ?? '').trim()) continue
    next[key] = value.trim()
    changed = true
  }
  if (!changed) return form1
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

  const cdlFilled = await fillEmptyCdl(supabase, userId, fields)
  filled.push(...cdlFilled)

  const profileFilled = await fillEmptyProfile(supabase, userId, fields)
  filled.push(...profileFilled)

  const dotFilled = await fillDotApplication(supabase, userId, fields)
  filled.push(...dotFilled)

  return { filled }
}

async function fillEmptyCdl(
  supabase: SupabaseClient,
  userId: string,
  fields: LicenseScanFields,
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
    if (typeof current === 'string' && current.trim()) return
    patch[column] = value
    filled.push(label)
  }

  assign('cdl_number', fields.licenseNumber, 'CDL number')
  assign('cdl_state', fields.state, 'CDL state')
  assign('cdl_class', fields.licenseClass, 'CDL class')
  assign('cdl_expiration', fields.expirationDate, 'CDL expiration')
  if (fields.endorsements.length > 0 && !(existing?.endorsements?.length)) {
    patch.endorsements = fields.endorsements
    filled.push('CDL endorsements')
  }
  if (fields.restrictions.length > 0 && !(existing?.restrictions?.length)) {
    patch.restrictions = fields.restrictions
    filled.push('CDL restrictions')
  }

  if (Object.keys(patch).length === 0) return []
  await saveCdlData(supabase, userId, patch)
  return filled
}

async function fillEmptyProfile(
  supabase: SupabaseClient,
  userId: string,
  fields: LicenseScanFields,
): Promise<string[]> {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('first_name, last_name, date_of_birth, city, state, zip_code')
    .eq('user_id', userId)
    .maybeSingle()

  const patch: Record<string, string> = {}
  const take = (column: string, value: string) => {
    if (!value) return
    const current = profile?.[column as keyof NonNullable<typeof profile>]
    if (typeof current === 'string' && current.trim()) return
    patch[column] = value
  }

  take('first_name', fields.firstName)
  take('last_name', fields.lastName)
  take('date_of_birth', fields.dateOfBirth)
  take('city', fields.city)
  take('state', fields.state)
  take('zip_code', fields.postalCode)

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
): Promise<string[]> {
  const { data: app, error } = await supabase
    .from('driver_applications')
    .select('id, application_data')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.warn('[LICENSE] DOT load failed:', error.message)
    return []
  }

  const applicationData = (app?.application_data ?? {}) as {
    form1?: Record<string, unknown> | null
    form2?: unknown
    form3?: unknown
  }
  const { form1, filled } = softFillForm1FromLicense(applicationData.form1, fields)
  if (filled.length === 0) return []

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
      return []
    }
    return filled.map((label) => `DOT ${label}`)
  }

  const { error: insertError } = await supabase.from('driver_applications').insert({
    user_id: userId,
    application_data: next,
    current_step: 1,
    is_complete: false,
  })
  if (insertError) {
    console.warn('[LICENSE] DOT create failed:', insertError.message)
    return []
  }
  await ensureHubBlockInstalled(supabase, userId, 'driver-dot-application')
  return filled.map((label) => `DOT ${label}`)
}
