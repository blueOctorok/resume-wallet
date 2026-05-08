import type { SupabaseClient } from '@supabase/supabase-js'
import { extractPspWebhookFields } from '@/lib/accio-psp-webhook'
import { savePspData } from '@/lib/block-data'
import { notifyScreeningReportDelivered } from '@/lib/notify-screening-complete'
import { deriveScreeningStatus } from '@/lib/accio-result-status'
import { parsePspResult, pspResultToJsonb } from '@/lib/accio-psp-parser'

export interface PspWebhookProcessOutcome {
  status: number
  body: Record<string, unknown>
}

/**
 * True when Accio posts an individual <postResults> for the FMCSA PSP suborder.
 * Bundled PSP+MVR orders use `/api/mvr/webhook` as postBack URL — those posts
 * are routed here from the MVR webhook handler.
 */
export function isFmcsaPostResultsWebhookXml(xmlBody: string): boolean {
  if (!xmlBody.includes('<postResults')) return false
  const attrs = xmlBody.match(/<postResults([^>]+)>/i)?.[1] ?? ''
  const type = attrs.match(/\btype=["']([^"']+)["']/i)?.[1]?.toLowerCase() ?? ''
  if (type.includes('fmcsa') || type.includes('crash')) return true
  // Some payloads omit type but include the FMCSA marker in the body
  return type === '' && /fmcsa_crash_inspection/i.test(xmlBody)
}

/**
 * Persists PSP completion from Accio webhook XML (shared by `/api/psp/webhook`
 * and FMCSA posts that land on `/api/mvr/webhook` for PSP+MVR bundle orders).
 */
export async function processPspAccioWebhookCompletion(
  supabase: SupabaseClient,
  xmlBody: string,
): Promise<PspWebhookProcessOutcome> {
  const hasScreeningResults = xmlBody.includes('<ScreeningResults>')
  const hasCompleteOrder = xmlBody.includes('<completeOrder')
  const hasPostResults = xmlBody.includes('<postResults')
  const isInProgressStatus =
    xmlBody.includes('filledStatus="in progress"') ||
    xmlBody.includes("filledStatus='in progress'") ||
    xmlBody.includes('<status>inprogress')
  const isConfirmation = xmlBody.includes('<orderConfirmation>') || xmlBody.includes('<confirmation>')

  const isCompletionNotification =
    (hasScreeningResults || hasCompleteOrder || hasPostResults) && !isInProgressStatus

  if (!isCompletionNotification) {
    return {
      status: 200,
      body: {
        success: true,
        message: 'Non-completion notification acknowledged',
        type: isInProgressStatus ? 'in_progress' : isConfirmation ? 'confirmation' : 'unknown',
      },
    }
  }

  const parsed = extractPspWebhookFields(xmlBody)
  const orderNumber =
    parsed.orderNumber || parsed.remoteOrderNumber || parsed.remoteSubOrderNumber || ''
  const subOrderNumber = parsed.subOrderNumber || parsed.remoteSubOrderNumber || null

  if (!orderNumber) {
    console.error('[PSP WEBHOOK] Missing order reference', parsed)
    return { status: 400, body: { error: 'Missing order numbers in result' } }
  }

  let { data: pspOrder } = await supabase
    .from('psp_orders')
    .select('*')
    .eq('accio_order_number', orderNumber)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!pspOrder && parsed.remoteOrderNumber) {
    const { data: remoteMatch } = await supabase
      .from('psp_orders')
      .select('*')
      .eq('accio_remote_order_number', parsed.remoteOrderNumber)
      .maybeSingle()
    pspOrder = remoteMatch
  }

  if (!pspOrder && parsed.dlNumber && parsed.dlState) {
    const { data: dlMatch } = await supabase
      .from('psp_orders')
      .select('*')
      .eq('status', 'pending')
      .eq('dl_number', parsed.dlNumber)
      .eq('dl_state', parsed.dlState)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    pspOrder = dlMatch
  }

  if (!pspOrder && parsed.dlState) {
    const { data: stateMatch } = await supabase
      .from('psp_orders')
      .select('*')
      .eq('status', 'pending')
      .eq('dl_state', parsed.dlState)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    pspOrder = stateMatch
  }

  if (!pspOrder) {
    console.error('[PSP WEBHOOK] Order not found', { orderNumber, subOrderNumber, parsed })
    return { status: 404, body: { error: 'PSP order not found' } }
  }

  const previousOrderStatus = pspOrder.status

  const { data: existingResult } = await supabase
    .from('psp_results')
    .select('id')
    .eq('psp_order_id', pspOrder.id)
    .maybeSingle()

  // Run the structured PSP parser. If parsing throws (malformed XML) we still
  // persist the raw XML — losing the report would be worse than losing the
  // structured fields, and admin can re-derive later from raw_xml.
  let parsedPsp: ReturnType<typeof parsePspResult> | null = null
  try {
    parsedPsp = parsePspResult(xmlBody)
  } catch (err) {
    console.error('[PSP WEBHOOK] Structured parse failed, storing raw only:', err)
  }

  const resultPayload = {
    psp_order_id: pspOrder.id,
    driver_user_id: pspOrder.driver_user_id,
    raw_xml: xmlBody,
    parsed_data: parsedPsp
      ? pspResultToJsonb(parsedPsp)
      : { parseError: true, extracted: parsed },
    result_status: 'received' as const,
    received_at: new Date().toISOString(),
  }

  let pspResult: { id: string }
  if (existingResult) {
    const { data: updated, error } = await supabase
      .from('psp_results')
      .update(resultPayload)
      .eq('id', existingResult.id)
      .select('id')
      .single()
    if (error || !updated) {
      console.error('[PSP WEBHOOK] result update:', error)
      return { status: 500, body: { error: 'Failed to update result' } }
    }
    pspResult = updated
  } else {
    const { data: inserted, error } = await supabase.from('psp_results').insert(resultPayload).select('id').single()
    if (error || !inserted) {
      console.error('[PSP WEBHOOK] result insert:', error)
      return { status: 500, body: { error: 'Failed to store result' } }
    }
    pspResult = inserted
  }

  // Centralized Accio mapping — see src/lib/accio-result-status.ts.
  // Prefer the structured-parsed values (parsedPsp) when available — they
  // include filledStatus AND held_for_review which the lightweight extractor
  // doesn't surface. Fall back to the extractor for malformed XML so a parse
  // failure doesn't pin the order at "pending" forever.
  const { status: nextStatus, outcome: nextOutcome } = deriveScreeningStatus({
    filledStatus: parsedPsp?.filledStatus ?? 'filled',
    filledCode: parsedPsp?.filledCode ?? parsed.filledCode,
    heldForReview: parsedPsp?.heldForReview ?? false,
  })

  await supabase
    .from('psp_orders')
    .update({
      status: nextStatus,
      result_outcome: nextOutcome,
      accio_remote_order_number: parsed.remoteOrderNumber || pspOrder.accio_remote_order_number,
      accio_remote_suborder_number: parsed.remoteSubOrderNumber || pspOrder.accio_remote_suborder_number,
      processed_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      result_xml: xmlBody,
    })
    .eq('id', pspOrder.id)

  void notifyScreeningReportDelivered(supabase, {
    kind: 'psp',
    previousStatus: previousOrderStatus,
    driverUserId: pspOrder.driver_user_id,
    ordered_by_company_id: pspOrder.ordered_by_company_id,
    ordered_by_user_id: pspOrder.ordered_by_user_id,
    ordered_by_employer: pspOrder.ordered_by_employer,
  }).catch((err) => console.warn('[PSP WEBHOOK] Screening notify non-fatal:', err))

  if (!pspOrder.ordered_by_company_id) {
    // Surface the parsed summary (crash/inspection/oos counts + brief snippet)
    // on the candidate's hub block so the career card can show real numbers
    // instead of just "Report on file".
    savePspData(supabase, pspOrder.driver_user_id, {
      order_id: pspOrder.id,
      result_id: pspResult.id,
      expires_at: pspOrder.expires_at,
      report_status: nextStatus,
      last_ordered_at: pspOrder.ordered_at,
      crash_count: parsedPsp?.crashCount ?? null,
      inspection_count: parsedPsp?.inspectionCount ?? null,
      oos_count: parsedPsp?.oosCount ?? null,
      report_summary: parsedPsp
        ? {
            outcome: nextOutcome,
            crashCount: parsedPsp.crashCount,
            inspectionCount: parsedPsp.inspectionCount,
            oosCount: parsedPsp.oosCount,
          }
        : null,
    }).catch((err) => console.warn('[PSP WEBHOOK] block sync non-fatal:', err))
  }

  return {
    status: 200,
    body: {
      success: true,
      message: 'PSP result stored',
      orderNumber,
      subOrderNumber,
    },
  }
}
