/**
 * Load the latest driver-owned PSP result and map crashes/inspections for Form 2.
 * Accepts terminal orders (`completed` | `needs_review`) with parsed_data present.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ParsedPspResult } from '@/lib/accio-psp-parser'
import { mapPspToForm2Rows } from '@/lib/psp-to-form2-mapper'
import type { Form2AccidentRow } from '@/lib/mvr-to-form2-mapper'
import type { Form2InspectionRow } from '@/lib/psp-to-form2-mapper'
import { isDriverOwnedScreeningOrder } from '@/lib/screening-order-ownership'

export interface PspDotProjection {
  pspCrashesAsAccidents: Form2AccidentRow[]
  pspInspections: Form2InspectionRow[]
  pspResultId: string
  orderId: string | null
  accioOrderNumber: string | null
  asOf: string
  crashCount: number
  inspectionCount: number
  /** True even when both counts are 0 — clean PSP still stamps provenance */
  isCleanRecord: boolean
}

function reconstructParsedPsp(parsedData: Record<string, unknown>): ParsedPspResult {
  const subject = parsedData.subject as ParsedPspResult['subject'] | undefined
  return {
    orderNumber: String(parsedData.orderNumber ?? ''),
    subOrderNumber: String(parsedData.subOrderNumber ?? ''),
    remoteOrderNumber: parsedData.remoteOrderNumber as string | undefined,
    remoteSubOrderNumber: parsedData.remoteSubOrderNumber as string | undefined,
    timeOrdered: parsedData.timeOrdered as string | undefined,
    timeFilled: parsedData.timeFilled as string | undefined,
    subject,
    crashes: (parsedData.crashes as ParsedPspResult['crashes']) ?? [],
    inspections: (parsedData.inspections as ParsedPspResult['inspections']) ?? [],
    crashCount: Number(parsedData.crashCount ?? 0),
    inspectionCount: Number(parsedData.inspectionCount ?? 0),
    oosCount: Number(parsedData.oosCount ?? 0),
    filledStatus: parsedData.filledStatus as string | undefined,
    filledCode: parsedData.filledCode as string | undefined,
    heldForReview: parsedData.heldForReview as boolean | undefined,
    reportText: parsedData.reportText as string | undefined,
    rawXml: '',
  }
}

/**
 * Prefer a terminal driver-owned PSP order's result.
 * Falls back to latest psp_results row for the user with parsed_data.
 */
export async function loadPspDotProjection(
  supabase: SupabaseClient,
  userId: string,
): Promise<PspDotProjection | null> {
  const { data: order } = await supabase
    .from('psp_orders')
    .select('id, status, accio_order_number, completed_at, ordered_by_company_id')
    .eq('driver_user_id', userId)
    .is('ordered_by_company_id', null)
    .in('status', ['completed', 'needs_review'])
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let pspResult: {
    id: string
    parsed_data: Record<string, unknown> | null
    received_at: string | null
    psp_order_id?: string | null
  } | null = null

  let orderId: string | null = null
  let accioOrderNumber: string | null = null
  let asOf: string

  if (order && isDriverOwnedScreeningOrder(order)) {
    orderId = order.id
    accioOrderNumber = order.accio_order_number
    asOf = order.completed_at ?? new Date().toISOString()

    const { data: byOrder } = await supabase
      .from('psp_results')
      .select('id, parsed_data, received_at, psp_order_id')
      .eq('psp_order_id', order.id)
      // Webhook historically stored 'received'; prefer any row with parsed_data
      .not('parsed_data', 'is', null)
      .order('received_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    pspResult = byOrder as typeof pspResult
  } else {
    const { data: latest } = await supabase
      .from('psp_results')
      .select('id, parsed_data, received_at, psp_order_id')
      .eq('driver_user_id', userId)
      .not('parsed_data', 'is', null)
      .order('received_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    pspResult = latest as typeof pspResult
    asOf = pspResult?.received_at ?? new Date().toISOString()
    orderId = pspResult?.psp_order_id ?? null
  }

  if (!pspResult?.parsed_data) return null
  // Skip pure parse-error shells
  if (pspResult.parsed_data.parseError) return null

  const parsed = reconstructParsedPsp(pspResult.parsed_data)
  const { crashesAsAccidents, inspections } = mapPspToForm2Rows(parsed)
  const stampAsOf = pspResult.received_at ?? asOf

  return {
    pspCrashesAsAccidents: crashesAsAccidents,
    pspInspections: inspections,
    pspResultId: pspResult.id,
    orderId,
    accioOrderNumber,
    asOf: stampAsOf,
    crashCount: crashesAsAccidents.length,
    inspectionCount: inspections.length,
    isCleanRecord: crashesAsAccidents.length === 0 && inspections.length === 0,
  }
}
