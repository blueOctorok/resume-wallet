import type { SupabaseClient } from '@supabase/supabase-js'
import { isLicenseScanFields } from '@/lib/aamva-license'
import { getLicenseScan, type LicenseScanRow } from '@/lib/block-data'
import type { DqLicenseScanInput } from '@/lib/dq-file-status'
import type { LicenseScanView } from '@/lib/license-scan-types'

export type { LicenseScanView }

function hasSavedFields(row: LicenseScanRow | null): boolean {
  const fields = isLicenseScanFields(row?.parsed_fields) ? row.parsed_fields : null
  return Boolean(fields?.licenseNumber)
}

export function licenseScanStatus(row: LicenseScanRow | null): LicenseScanView['status'] {
  if (!row) return 'empty'
  const saved = hasSavedFields(row) || row.barcode_status === 'read'
  if (row.confirmed_at && saved) return 'complete'
  if (saved) return 'in-progress'
  return 'empty'
}

export function toDqLicenseScan(row: LicenseScanRow | null): DqLicenseScanInput | null {
  if (!row) return null
  const started = hasSavedFields(row) || row.barcode_status === 'read' || Boolean(row.confirmed_at)
  if (!started) return null
  return {
    id: row.id,
    started: true,
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
  return {
    barcodeStatus: row?.barcode_status ?? 'unread',
    fields,
    confirmedAt: row?.confirmed_at ?? null,
    status: licenseScanStatus(row),
  }
}
