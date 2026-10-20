import type { SupabaseClient } from '@supabase/supabase-js'
import { isLicenseScanFields, type LicenseScanFields } from '@/lib/aamva-license'
import { getCdlData, getLicenseScan, saveCdlData, type LicenseScanRow } from '@/lib/block-data'
import { deleteDocument } from '@/lib/document-storage'
import { licenseScanStatus } from '@/lib/license-scan-view'
import { paginateInMemory, textMatchesSearch } from '@/lib/admin-search'
import type { DotFieldPath, Form1WithProvenance } from '@/lib/dot-field-provenance'

export interface AdminLicenseRecord {
  userId: string
  name: string | null
  email: string | null
  status: 'empty' | 'in-progress' | 'complete'
  barcodeStatus: 'unread' | 'read' | 'failed'
  licenseNumber: string | null
  state: string | null
  licenseClass: string | null
  expirationDate: string | null
  endorsements: string[]
  restrictions: string[]
  dateOfBirth: string | null
  address: string | null
  confirmedAt: string | null
  updatedAt: string
}

function fieldsOf(row: LicenseScanRow): LicenseScanFields | null {
  return isLicenseScanFields(row.parsed_fields) ? row.parsed_fields : null
}

function addressOf(fields: LicenseScanFields | null): string | null {
  if (!fields) return null
  const line = [fields.street, fields.city, fields.state, fields.postalCode].filter(Boolean).join(', ')
  return line || null
}

function toRecord(
  row: LicenseScanRow,
  name: string | null,
  email: string | null,
): AdminLicenseRecord {
  const fields = fieldsOf(row)
  return {
    userId: row.user_id,
    name,
    email,
    status: licenseScanStatus(row),
    barcodeStatus: row.barcode_status,
    licenseNumber: fields?.licenseNumber || null,
    state: fields?.state || null,
    licenseClass: fields?.licenseClass || null,
    expirationDate: fields?.expirationDate || null,
    endorsements: fields?.endorsements ?? [],
    restrictions: fields?.restrictions ?? [],
    dateOfBirth: fields?.dateOfBirth || null,
    address: addressOf(fields),
    confirmedAt: row.confirmed_at,
    updatedAt: row.updated_at,
  }
}

async function namesFor(supabase: SupabaseClient, userIds: string[]) {
  const [{ data: profiles }, { data: users }] = await Promise.all([
    userIds.length
      ? supabase.from('user_profiles').select('user_id, first_name, last_name, email').in('user_id', userIds)
      : Promise.resolve({ data: [] as { user_id: string; first_name: string | null; last_name: string | null; email: string | null }[] }),
    userIds.length
      ? supabase.from('users').select('id, email').in('id', userIds)
      : Promise.resolve({ data: [] as { id: string; email: string | null }[] }),
  ])
  const profileById = new Map((profiles ?? []).map((profile) => [profile.user_id as string, profile]))
  const emailById = new Map((users ?? []).map((user) => [user.id as string, user.email as string | null]))
  return { profileById, emailById }
}

function identity(
  userId: string,
  profileById: Map<string, { first_name: string | null; last_name: string | null; email: string | null }>,
  emailById: Map<string, string | null>,
) {
  const profile = profileById.get(userId)
  const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || null
  const email = profile?.email || emailById.get(userId) || null
  return { name, email }
}

/** Every barcode read. Photos are not stored. */
export async function listAdminLicenses(
  supabase: SupabaseClient,
  search: string,
  offset: number,
  limit: number,
): Promise<{ licenses: AdminLicenseRecord[]; total: number }> {
  const { data, error } = await supabase
    .from('block_driver_license')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) throw new Error(error.message)

  const rows = (data ?? []) as LicenseScanRow[]
  const { profileById, emailById } = await namesFor(supabase, rows.map((row) => row.user_id))

  const licenses = rows
    .map((row) => {
      const who = identity(row.user_id, profileById, emailById)
      return toRecord(row, who.name, who.email)
    })
    .filter((license) => {
      if (!search) return true
      return (
        textMatchesSearch(license.name, search) ||
        textMatchesSearch(license.email, search) ||
        textMatchesSearch(license.licenseNumber, search) ||
        textMatchesSearch(license.state, search)
      )
    })

  return { licenses: paginateInMemory(licenses, offset, limit), total: licenses.length }
}

/** One barcode read, without a photo. */
export async function getAdminLicense(
  supabase: SupabaseClient,
  userId: string,
): Promise<AdminLicenseRecord | null> {
  const row = await getLicenseScan(supabase, userId)
  if (!row) return null
  const { profileById, emailById } = await namesFor(supabase, [userId])
  const who = identity(userId, profileById, emailById)
  return toRecord(row, who.name, who.email)
}

const DOT_LICENSE_PATHS = [
  'currentLicenses.0.state',
  'currentLicenses.0.licenseNumber',
  'currentLicenses.0.typeClass',
  'currentLicenses.0.endorsements',
  'currentLicenses.0.expirationDate',
] as const satisfies readonly DotFieldPath[]

function sameText(left: string | null | undefined, right: string | null | undefined): boolean {
  const a = (left ?? '').trim().toLowerCase()
  const b = (right ?? '').trim().toLowerCase()
  return a.length > 0 && a === b
}

/**
 * Remove the barcode read and the license fields it copied.
 * An MVR lock on the DOT application is left alone — that record outranks the scan.
 */
export async function deleteAdminLicense(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data: row, error: readError } = await supabase
    .from('block_driver_license')
    .select('front_storage_path, back_storage_path, parsed_fields')
    .eq('user_id', userId)
    .maybeSingle()
  if (readError) throw new Error(readError.message)
  if (!row) return false

  const fields = isLicenseScanFields(row.parsed_fields) ? row.parsed_fields : null

  // Photo files are optional leftovers. A storage failure must not keep the scan.
  for (const path of [row.front_storage_path, row.back_storage_path]) {
    if (!path) continue
    try {
      await deleteDocument('license-images', path)
    } catch (error) {
      console.warn('[ADMIN LICENSE] photo delete failed:', error)
    }
  }

  const { data: removed, error } = await supabase
    .from('block_driver_license')
    .delete()
    .eq('user_id', userId)
    .select('user_id')
  if (error) throw new Error(error.message)
  if ((removed?.length ?? 0) === 0) return false

  if (fields) {
    await clearCopiedLicenseFields(supabase, userId, fields)
  }
  return true
}

async function clearCopiedLicenseFields(
  supabase: SupabaseClient,
  userId: string,
  fields: LicenseScanFields,
): Promise<void> {
  await Promise.all([
    clearMatchingCdl(supabase, userId, fields),
    clearMatchingDotLicense(supabase, userId, fields),
  ])
}

async function clearMatchingCdl(
  supabase: SupabaseClient,
  userId: string,
  fields: LicenseScanFields,
): Promise<void> {
  const cdl = await getCdlData(supabase, userId)
  if (!cdl) return

  const patch: Parameters<typeof saveCdlData>[2] = {}
  if (sameText(cdl.cdl_number, fields.licenseNumber)) patch.cdl_number = null
  if (sameText(cdl.cdl_state, fields.state)) patch.cdl_state = null
  if (sameText(cdl.cdl_class, fields.licenseClass) || sameText(cdl.cdl_class, `Class ${fields.licenseClass}`)) {
    patch.cdl_class = null
  }
  if (sameText(cdl.cdl_expiration?.slice(0, 10), fields.expirationDate)) patch.cdl_expiration = null
  if (fields.endorsements.length > 0 && sameList(cdl.endorsements, fields.endorsements)) {
    patch.endorsements = []
  }
  if (fields.restrictions.length > 0 && sameList(cdl.restrictions, fields.restrictions)) {
    patch.restrictions = []
  }
  if (Object.keys(patch).length === 0) return
  await saveCdlData(supabase, userId, patch)
}

function sameList(current: string[] | null | undefined, next: string[]): boolean {
  if (!current || current.length !== next.length) return false
  return current.every((item, index) => sameText(item, next[index]))
}

async function clearMatchingDotLicense(
  supabase: SupabaseClient,
  userId: string,
  fields: LicenseScanFields,
): Promise<void> {
  const { data: app, error } = await supabase
    .from('driver_applications')
    .select('id, application_data')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !app?.id) return

  const applicationData = (app.application_data ?? {}) as { form1?: Form1WithProvenance | null }
  const form1 = applicationData.form1
  if (!form1) return

  const licenses = Array.isArray(form1.currentLicenses)
    ? [...(form1.currentLicenses as Record<string, unknown>[])]
    : []
  const current = { ...(licenses[0] ?? {}) }
  const provenance = form1._fieldProvenance
  const stamped = { ...(provenance?.fields ?? {}) }
  let changed = false

  const clear = (key: string, path: (typeof DOT_LICENSE_PATHS)[number], scanValue: string) => {
    const source = stamped[path]?.source
    if (source === 'mvr') return
    const value = String(current[key] ?? '')
    if (source !== 'license' && !sameText(value, scanValue) && !sameText(value, `Class ${scanValue}`)) return
    current[key] = ''
    delete stamped[path]
    changed = true
  }

  clear('licenseNumber', 'currentLicenses.0.licenseNumber', fields.licenseNumber)
  clear('state', 'currentLicenses.0.state', fields.state)
  clear('typeClass', 'currentLicenses.0.typeClass', fields.licenseClass)
  clear('endorsements', 'currentLicenses.0.endorsements', fields.endorsements.join(', '))
  clear('expirationDate', 'currentLicenses.0.expirationDate', fields.expirationDate)
  if (fields.restrictions.length > 0 && sameText(String(current.restrictions ?? ''), fields.restrictions.join(', '))) {
    current.restrictions = ''
    changed = true
  }

  if (!changed) return
  licenses[0] = current
  const nextForm1: Form1WithProvenance = {
    ...form1,
    currentLicenses: licenses,
    _fieldProvenance: provenance ? { ...provenance, fields: stamped } : provenance,
  }

  const { error: updateError } = await supabase
    .from('driver_applications')
    .update({
      application_data: { ...applicationData, form1: nextForm1 },
      updated_at: new Date().toISOString(),
    })
    .eq('id', app.id)
  if (updateError) console.warn('[ADMIN LICENSE] DOT license clear failed:', updateError.message)
}
