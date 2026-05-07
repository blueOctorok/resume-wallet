import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { extractPspWebhookFields } from '@/lib/accio-psp-webhook'
import { savePspData } from '@/lib/block-data'
import { notifyScreeningReportDelivered } from '@/lib/notify-screening-complete'

/**
 * POST /api/psp/webhook — Accio results for standalone PSP (fmcsa_crash_inspection) orders.
 * Stores raw XML until Accio provides a documented parse shape.
 */
export async function POST(request: NextRequest) {
  try {
    const xmlBody = await request.text()
    console.log('[PSP WEBHOOK] received, length:', xmlBody.length)

    if (!xmlBody) {
      return NextResponse.json({ error: 'Empty body' }, { status: 400 })
    }

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
      return NextResponse.json({
        success: true,
        message: 'Non-completion notification acknowledged',
        type: isInProgressStatus ? 'in_progress' : isConfirmation ? 'confirmation' : 'unknown',
      })
    }

    const parsed = extractPspWebhookFields(xmlBody)
    const orderNumber =
      parsed.orderNumber || parsed.remoteOrderNumber || parsed.remoteSubOrderNumber || ''
    const subOrderNumber = parsed.subOrderNumber || parsed.remoteSubOrderNumber || null

    if (!orderNumber) {
      console.error('[PSP WEBHOOK] Missing order reference', parsed)
      return NextResponse.json({ error: 'Missing order numbers in result' }, { status: 400 })
    }

    const supabaseService = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    let { data: pspOrder } = await supabaseService
      .from('psp_orders')
      .select('*')
      .eq('accio_order_number', orderNumber)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!pspOrder && parsed.remoteOrderNumber) {
      const { data: remoteMatch } = await supabaseService
        .from('psp_orders')
        .select('*')
        .eq('accio_remote_order_number', parsed.remoteOrderNumber)
        .maybeSingle()
      pspOrder = remoteMatch
    }

    if (!pspOrder && parsed.dlNumber && parsed.dlState) {
      const { data: dlMatch } = await supabaseService
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
      const { data: stateMatch } = await supabaseService
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
      return NextResponse.json({ error: 'PSP order not found' }, { status: 404 })
    }

    const previousOrderStatus = pspOrder.status

    const { data: existingResult } = await supabaseService
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
      const { data: updated, error } = await supabaseService
        .from('psp_results')
        .update(resultPayload)
        .eq('id', existingResult.id)
        .select('id')
        .single()
      if (error || !updated) {
        console.error('[PSP WEBHOOK] result update:', error)
        return NextResponse.json({ error: 'Failed to update result' }, { status: 500 })
      }
      pspResult = updated
    } else {
      const { data: inserted, error } = await supabaseService.from('psp_results').insert(resultPayload).select('id').single()
      if (error || !inserted) {
        console.error('[PSP WEBHOOK] result insert:', error)
        return NextResponse.json({ error: 'Failed to store result' }, { status: 500 })
      }
      pspResult = inserted
    }

    const nextStatus =
      parsed.filledCode === 'verified' ? 'completed' : 'needs_review'

    await supabaseService
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

    void notifyScreeningReportDelivered(supabaseService, {
      kind: 'psp',
      previousStatus: previousOrderStatus,
      driverUserId: pspOrder.driver_user_id,
      ordered_by_company_id: pspOrder.ordered_by_company_id,
      ordered_by_user_id: pspOrder.ordered_by_user_id,
      ordered_by_employer: pspOrder.ordered_by_employer,
    }).catch((err) => console.warn('[PSP WEBHOOK] Screening notify non-fatal:', err))

    // FCRA: never mirror employer-ordered PSP onto the candidate hub cache.
    if (!pspOrder.ordered_by_company_id) {
      savePspData(supabaseService, pspOrder.driver_user_id, {
        order_id: pspOrder.id,
        result_id: pspResult.id,
        expires_at: pspOrder.expires_at,
        report_status: nextStatus,
        last_ordered_at: pspOrder.ordered_at,
      }).catch((err) => console.warn('[PSP WEBHOOK] block sync non-fatal:', err))
    }

    return NextResponse.json({
      success: true,
      message: 'PSP result stored',
      orderNumber,
      subOrderNumber,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[PSP WEBHOOK] Unexpected:', error)
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'PSP webhook endpoint is active',
    method: 'POST',
    description: 'Receives FMCSA PSP / crash-inspection results from Accio',
  })
}
