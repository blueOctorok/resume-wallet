import type { SupabaseClient } from '@supabase/supabase-js'
import { isLicenseScanFields } from '@/lib/aamva-license'
import { getLicenseScan, type LicenseScanRow } from '@/lib/block-data'
import { getSignedDocumentUrl } from '@/lib/document-storage'
import type { DqLicenseScanInput } from '@/lib/dq-file-status'
import type { LicenseScanView } from '@/lib/license-scan-types'

export type { LicenseScanView }

export function licenseScanStatus(row: LicenseScanRow | null): LicenseScanView['status'] {
  if (!row?.front_storage_path && !row?.back_storage_path) return 'empty'
  if (row.front_storage_path && row.back_storage_path && row.confirmed_at) return 'complete'
  return 'in-progress'
}

export function toDqLicenseScan(row: LicenseScanRow | null): DqLicenseScanInput | null {
  if (!row) return null
  return {
    id: row.id,
    hasFront: Boolean(row.front_storage_path),
    hasBack: Boolean(row.back_storage_path),
    confirmedAt: row.confirmed_at,
    updatedAt: row.updated_at,
  }
}

export async function presentLicenseScan(
  supabase: SupabaseClient,
  userId: string,
): Promise<LicenseScanView> {
  const row = await getLicenseScan(supabase, userId)
  const fields = isLicenseScanFields(row?.parsed_fields) ? row.parsed_fields : null
  const [frontUrl, backUrl] = await Promise.all([
    signed(row?.front_storage_path),
    signed(row?.back_storage_path),
  ])
  return {
    hasFront: Boolean(row?.front_storage_path),
    hasBack: Boolean(row?.back_storage_path),
    frontUrl,
    backUrl,
    barcodeStatus: row?.barcode_status ?? 'unread',
    fields,
    confirmedAt: row?.confirmed_at ?? null,
    status: licenseScanStatus(row),
  }
}

async function signed(path: string | null | undefined): Promise<string | null> {
  if (!path) return null
  try {
    return await getSignedDocumentUrl('license-images', path)
  } catch (error) {
    console.warn('[LICENSE] signed url failed:', error)
    return null
  }
}
