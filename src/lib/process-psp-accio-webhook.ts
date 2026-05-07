import type { SupabaseClient } from '@supabase/supabase-js'
import { extractPspWebhookFields } from '@/lib/accio-psp-webhook'
import { savePspData } from '@/lib/block-data'
import { notifyScreeningReportDelivered } from '@/lib/notify-screening-complete'

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

  const resultPayload = {
    psp_order_id: pspOrder.id,
    driver_user_id: pspOrder.driver_user_id,
    raw_xml: xmlBody,
    parsed_data: { stub: true, extracted: parsed },
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

  const nextStatus = parsed.filledCode === 'verified' ? 'completed' : 'needs_review'

  await supabase
    .from('psp_orders')
    .update({
      status: nextStatus,
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
    savePspData(supabase, pspOrder.driver_user_id, {
      order_id: pspOrder.id,
      result_id: pspResult.id,
      expires_at: pspOrder.expires_at,
      report_status: nextStatus,
      last_ordered_at: pspOrder.ordered_at,
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
