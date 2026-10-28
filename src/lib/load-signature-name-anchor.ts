import type { SupabaseClient } from '@supabase/supabase-js'
import { isLicenseScanFields } from '@/lib/aamva-license'
import { getLicenseScan } from '@/lib/block-data'
import {
  joinPersonName,
  pickSignatureAnchor,
  type SignatureNameAnchor,
} from '@/lib/signature-name-check'

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function subjectName(parsed: unknown): string | null {
  if (!parsed || typeof parsed !== 'object') return null
  const subject = (parsed as { subject?: unknown }).subject
  if (!subject || typeof subject !== 'object') return null
  const row = subject as Record<string, unknown>
  return joinPersonName(text(row.firstName), text(row.middleName), text(row.lastName))
}

/** Latest completed report for this driver, including one a company ordered. */
async function latestMvrName(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data: orders } = await supabase
    .from('mvr_orders')
    .select('id')
    .eq('driver_user_id', userId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(8)

  const orderIds = (orders ?? []).map((order) => order.id).filter(Boolean)
  if (orderIds.length === 0) return null

  const { data: results } = await supabase
    .from('mvr_results')
    .select('parsed_data, received_at')
    .in('mvr_order_id', orderIds)
    .eq('result_status', 'parsed')
    .order('received_at', { ascending: false })
    .limit(1)

  return subjectName(results?.[0]?.parsed_data)
}

/** Confirmed barcode read only. An unread card is not a name to sign against. */
async function confirmedLicenseName(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const scan = await getLicenseScan(supabase, userId)
  if (!scan?.confirmed_at || !isLicenseScanFields(scan.parsed_fields)) return null
  return joinPersonName(
    scan.parsed_fields.firstName,
    scan.parsed_fields.middleName,
    scan.parsed_fields.lastName,
  )
}

export async function loadSignatureNameAnchor(
  supabase: SupabaseClient,
  userId: string,
): Promise<SignatureNameAnchor | null> {
  const [mvrName, licenseName] = await Promise.all([
    latestMvrName(supabase, userId),
    confirmedLicenseName(supabase, userId),
  ])
  return pickSignatureAnchor(mvrName, licenseName)
}
