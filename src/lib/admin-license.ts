import type { SupabaseClient } from '@supabase/supabase-js'
import { isLicenseScanFields, type LicenseScanFields } from '@/lib/aamva-license'
import { getLicenseScan, type LicenseScanRow } from '@/lib/block-data'
import { deleteDocument } from '@/lib/document-storage'
import { licenseScanStatus } from '@/lib/license-scan-view'
import { paginateInMemory, textMatchesSearch } from '@/lib/admin-search'

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

/** Remove the on-file scan. Does not touch CDL credentials the driver confirmed separately. */
export async function deleteAdminLicense(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const row = await getLicenseScan(supabase, userId)
  if (!row) return false

  for (const path of [row.front_storage_path, row.back_storage_path]) {
    if (!path) continue
    try {
      await deleteDocument('license-images', path)
    } catch (error) {
      console.warn('[ADMIN LICENSE] photo delete failed:', error)
    }
  }

  const { error } = await supabase.from('block_driver_license').delete().eq('user_id', userId)
  if (error) throw new Error(error.message)
  return true
}
