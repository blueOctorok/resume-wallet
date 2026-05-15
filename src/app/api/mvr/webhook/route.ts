import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { parseAccioMvrResult, mvrResultToJsonb } from '@/lib/accio-xml-parser'
import { saveMvrData } from '@/lib/block-data'
import { notifyScreeningReportDelivered } from '@/lib/notify-screening-complete'
import {
  isFmcsaPostResultsWebhookXml,
  processPspAccioWebhookCompletion,
} from '@/lib/process-psp-accio-webhook'
import { deriveScreeningStatus } from '@/lib/accio-result-status'
import { matchScreeningOrder, buildRemoteIdPatch } from '@/lib/screening-webhook-match'

/**
 * Convert YYYYMMDD date format to ISO date string for database storage
 */
function formatDateForDb(dateStr: string | undefined): string | null {
  if (!dateStr || dateStr.length !== 8) return null
  
  const year = dateStr.substring(0, 4)
  const month = dateStr.substring(4, 6)
  const day = dateStr.substring(6, 8)
  
  // Return as YYYY-MM-DD format
  return `${year}-${month}-${day}`
}

/**
 * API Route: Accio Webhook Handler
 * 
 * POST /api/mvr/webhook
 * 
 * Receives MVR results from Accio via webhook
 * Parses XML, stores results, and updates driver profiles
 * 
 * Note: This endpoint should be called by Accio, not directly by users
 * Uses service role key to bypass RLS for webhook processing
 */
export async function POST(request: NextRequest) {
  try {
    // Get raw XML body
    const xmlBody = await request.text()

    // Log EVERYTHING for debugging - we need to see what Accio sends
    console.log('[MVR WEBHOOK] ========== INCOMING WEBHOOK ==========')
    console.log('[MVR WEBHOOK] Body length:', xmlBody.length)
    console.log('[MVR WEBHOOK] Full XML body:', xmlBody)
    console.log('[MVR WEBHOOK] FMCSA detection:', {
      hasPostResults: xmlBody.includes('<postResults'),
      hasFmcsaType: /type=["']fmcsa_crash_inspection["']/i.test(xmlBody),
      hasMvrType: /<subOrder[^>]*type=["']MVR["']/i.test(xmlBody),
      isFmcsaPostResults: xmlBody.includes('<postResults') && (/fmcsa|crash/i.test(xmlBody)),
    })
    console.log('[MVR WEBHOOK] ========================================')

    if (!xmlBody) {
      console.error('[MVR WEBHOOK] Empty body received')
      return NextResponse.json({ error: 'Empty body' }, { status: 400 })
    }

    // Check if this is a completion notification - Accio sends different formats:
    // 1. <ScreeningResults><completeOrder>...</completeOrder></ScreeningResults> (full order)
    // 2. <postResults order="..." subOrder="..." type="MVR">...</postResults> (individual result)
    // 3. In-progress updates wrapped in ScreeningResults with filledStatus="in progress"
    const hasScreeningResults = xmlBody.includes('<ScreeningResults>')
    const hasCompleteOrder = xmlBody.includes('<completeOrder')
    const hasPostResults = xmlBody.includes('<postResults')
    
    // Check for in-progress status (not a completion)
    const isInProgressStatus = xmlBody.includes('filledStatus="in progress"') || 
                               xmlBody.includes("filledStatus='in progress'") ||
                               xmlBody.includes('<status>inprogress')
    
    const isConfirmation = xmlBody.includes('<orderConfirmation>') || xmlBody.includes('<confirmation>')
    
    // It's a completion if it has results AND is not marked as in-progress
    const isCompletionNotification = (hasScreeningResults || hasCompleteOrder || hasPostResults) && !isInProgressStatus
    
    if (!isCompletionNotification) {
      // This might be a confirmation, in-progress, or ETA notification - acknowledge but don't process
      console.log('[MVR WEBHOOK] Non-completion notification received:', {
        hasScreeningResults,
        hasCompleteOrder,
        hasPostResults,
        isInProgressStatus,
        isConfirmation,
        type: isInProgressStatus ? 'in_progress' : isConfirmation ? 'confirmation' : 'unknown'
      })
      // Return 200 to acknowledge receipt - don't want Accio to keep retrying
      return NextResponse.json({ 
        success: true, 
        message: 'Non-completion notification acknowledged',
        type: isInProgressStatus ? 'in_progress' : isConfirmation ? 'confirmation' : 'unknown'
      })
    }

    console.log('[MVR WEBHOOK] Processing completion notification')

    // Detect FMCSA content early — used for routing decisions below.
    const hasFmcsaSuborder = /type=["']fmcsa_crash_inspection["']/i.test(xmlBody)
    const hasMvrSuborder = /<subOrder[^>]*type=["']MVR["']/i.test(xmlBody)

    // PSP+MVR bundle uses this URL for all Accio postbacks. Route FMCSA-only
    // payloads (<postResults> or <completeOrder> with no MVR suborder) directly
    // to the PSP processor — they contain no MVR data for the parser below.
    if (isFmcsaPostResultsWebhookXml(xmlBody) || (hasFmcsaSuborder && !hasMvrSuborder)) {
      console.log('[MVR WEBHOOK] Routing to PSP processor (FMCSA-only payload)')
      const supabaseService = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      )
      const outcome = await processPspAccioWebhookCompletion(supabaseService, xmlBody)
      return NextResponse.json(outcome.body, { status: outcome.status })
    }

    // Parse XML result (MVR suborder or bundled payload Accio labels as MVR)
    let parsedResult
    try {
      parsedResult = parseAccioMvrResult(xmlBody)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown parse error'
      console.error('[MVR WEBHOOK] Error parsing XML:', error)
      return NextResponse.json(
        { error: 'Failed to parse XML result', details: message },
        { status: 400 }
      )
    }

    // Extract order numbers from XML
    // Use remoteOrderNumber as fallback if orderNumber is empty (Accio sometimes only sends remote_number)
    const orderNumber = parsedResult.orderNumber || parsedResult.remoteOrderNumber || ''
    const subOrderNumber = parsedResult.subOrderNumber || parsedResult.remoteSubOrderNumber

    if (!orderNumber || !subOrderNumber) {
      console.error('[MVR WEBHOOK] Missing order numbers in XML', {
        orderNumber: parsedResult.orderNumber,
        remoteOrderNumber: parsedResult.remoteOrderNumber,
        subOrderNumber: parsedResult.subOrderNumber,
        remoteSubOrderNumber: parsedResult.remoteSubOrderNumber,
        licenseNumber: parsedResult.licenseNumber,
        licenseState: parsedResult.licenseState,
        parsedResult: {
          orderNumber: parsedResult.orderNumber,
          subOrderNumber: parsedResult.subOrderNumber,
          remoteOrderNumber: parsedResult.remoteOrderNumber,
          remoteSubOrderNumber: parsedResult.remoteSubOrderNumber
        }
      })
      // Log more of the XML to help debug
      console.error('[MVR WEBHOOK] Full XML (first 2000 chars):', xmlBody.substring(0, 2000))
      return NextResponse.json(
        { error: 'Missing order numbers in result' },
        { status: 400 }
      )
    }

    console.log('[MVR WEBHOOK] Processing order:', orderNumber, 'subOrder:', subOrderNumber)

    // Use service role client to bypass RLS
    const supabaseService = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Find the MVR order using the hardened matcher. The state-only fallback
    // that used to live here is gone — see src/lib/screening-webhook-match.ts
    // for the wrongful-matching incident that motivated the rewrite.
    const matched = await matchScreeningOrder<{
      id: string
      status: string
      ordered_at: string
      driver_user_id: string | null
      driver_profile_id: string | null
      accio_remote_order_number?: string | null
      accio_remote_suborder_number?: string | null
      expires_at: string | null
      ordered_at_ts?: string
      ordered_by_company_id?: string | null
      ordered_by_user_id?: string | null
      ordered_by_employer?: boolean | null
      employer_company_id?: string | null
      employer_user_id?: string | null
    }>(supabaseService, 'mvr_orders', {
      ourOrderNumber: orderNumber,
      remoteOrderNumber: parsedResult.remoteOrderNumber,
      ourSubOrderNumber: subOrderNumber,
      remoteSubOrderNumber: parsedResult.remoteSubOrderNumber,
      dlNumber: parsedResult.licenseNumber,
      dlState: parsedResult.licenseState,
    })

    if (!matched) {
      console.error('[MVR WEBHOOK] No MVR order matched (returning 404 — Accio will retry):', {
        orderNumber,
        subOrderNumber,
        remoteOrderNumber: parsedResult.remoteOrderNumber,
        remoteSubOrderNumber: parsedResult.remoteSubOrderNumber,
        licenseNumber: parsedResult.licenseNumber,
        licenseState: parsedResult.licenseState,
      })
      return NextResponse.json({ error: 'MVR order not found' }, { status: 404 })
    }

    const mvrOrder = matched.row
    console.log(
      `[MVR WEBHOOK] Matched order ${mvrOrder.id} via ${matched.matchedBy}` +
        (matched.warning ? ` (warning: ${matched.warning})` : ''),
    )

    const previousOrderStatus = mvrOrder.status

    // 2. Check if result already exists (idempotency)
    const { data: existingResult } = await supabaseService
      .from('mvr_results')
      .select('id')
      .eq('mvr_order_id', mvrOrder.id)
      .maybeSingle()

    if (existingResult) {
      console.log('[MVR WEBHOOK] Result already exists, updating...')
    }

    // 3. Convert parsed result to JSONB for storage
    const parsedData = mvrResultToJsonb(parsedResult)

    // 4. Extract license details from mvr_license blocks (use first license as primary)
    const primaryLicense = parsedResult.licenses && parsedResult.licenses.length > 0 
      ? parsedResult.licenses[0] 
      : null

    // 5. Store or update MVR result
    const resultData = {
      mvr_order_id: mvrOrder.id,
      driver_user_id: mvrOrder.driver_user_id,
      driver_profile_id: mvrOrder.driver_profile_id,
      license_number: parsedResult.licenseNumber,
      license_state: parsedResult.licenseState,
      license_class: primaryLicense?.class || null, // From mvr_license block
      license_status: primaryLicense?.status || null, // From mvr_license block
      license_expiration_date: primaryLicense?.expirationDate 
        ? formatDateForDb(primaryLicense.expirationDate) 
        : (parsedResult.licenseExpirationDate ? formatDateForDb(parsedResult.licenseExpirationDate) : null),
      total_points: parsedResult.totalPoints || 0,
      violation_count: parsedResult.violationCount || 0,
      violations: parsedResult.violations || [],
      accident_count: parsedResult.accidentCount || 0,
      accidents: parsedResult.accidents || [],
      suspension_count: parsedResult.suspensionCount || 0,
      suspensions: parsedResult.suspensions || [],
      medical_cert_expiration: parsedResult.medicalCertExpiration || null,
      medical_cert_status: parsedResult.medicalCertStatus || null,
      cdl_endorsements: primaryLicense?.endorsements ? [primaryLicense.endorsements] : [],
      cdl_restrictions: primaryLicense?.restrictions ? [primaryLicense.restrictions] : [],
      parsed_data: parsedData, // Complete structured data for prefilling
      result_status: 'parsed',
      parsed_at: new Date().toISOString()
    }

    let mvrResult
    if (existingResult) {
      // Update existing result
      const { data: updated, error: updateError } = await supabaseService
        .from('mvr_results')
        .update(resultData)
        .eq('id', existingResult.id)
        .select()
        .single()

      if (updateError) {
        console.error('[MVR WEBHOOK] Error updating result:', updateError)
        throw updateError
      }
      mvrResult = updated
    } else {
      // Insert new result
      const { data: inserted, error: insertError } = await supabaseService
        .from('mvr_results')
        .insert(resultData)
        .select()
        .single()

      if (insertError) {
        console.error('[MVR WEBHOOK] Error inserting result:', insertError)
        throw insertError
      }
      mvrResult = inserted
    }

    // 5. Update MVR order status using the centralized Accio mapping.
    // See src/lib/accio-result-status.ts for why this matters — the previous
    // `=== 'verified'` check silently routed every report to needs_review.
    const { status: nextStatus, outcome: nextOutcome } = deriveScreeningStatus({
      filledStatus: parsedResult.filledStatus,
      filledCode: parsedResult.filledCode,
      heldForReview: parsedResult.heldForReview,
    })

    // Only allow remote-ID writes from the DL+state recovery path. For every
    // other matching path the IDs already match by definition — overwriting
    // them is what allowed the wrongful-matching corruption.
    const remoteIdPatch = buildRemoteIdPatch(
      matched,
      parsedResult.remoteOrderNumber,
      parsedResult.remoteSubOrderNumber,
    )

    const { error: orderUpdateError } = await supabaseService
      .from('mvr_orders')
      .update({
        status: nextStatus,
        result_outcome: nextOutcome,
        ...remoteIdPatch,
        processed_at: parsedResult.timeFilled || new Date().toISOString(),
        completed_at: new Date().toISOString(),
        result_xml: xmlBody,
        fee_amount: parsedResult.fees?.addon || null
      })
      .eq('id', mvrOrder.id)

    if (orderUpdateError) {
      console.error('[MVR WEBHOOK] Error updating order:', orderUpdateError)
      // Don't fail - result is stored, order update is secondary
    }

    // 6. Write MVR data to block table
    if (mvrOrder.driver_user_id) {
      saveMvrData(supabaseService, mvrOrder.driver_user_id, {
        order_id: mvrOrder.id,
        result_id: mvrResult.id,
        expires_at: mvrOrder.expires_at,
        license_status: parsedResult.licenseStatus,
        total_points: parsedResult.totalPoints || 0,
        violation_count: parsedResult.violationCount || 0,
        violations: parsedResult.violations || [],
        accidents: parsedResult.accidents || [],
        last_ordered_at: mvrOrder.ordered_at,
        last_updated: new Date().toISOString(),
      }).catch((err) =>
        console.warn('[MVR WEBHOOK] Block table sync failed (non-fatal):', err)
      )
    }

    console.log('[MVR WEBHOOK] MVR result processed successfully:', mvrResult.id)

    // Bundle completion: when Accio sends a <completeOrder> containing both MVR
    // and FMCSA suborders, the parser above only processes the MVR half.
    // Detect the bundled FMCSA suborder and process it so psp_orders doesn't
    // stay stuck at 'pending'. processPspAccioWebhookCompletion is idempotent
    // (checks for existing psp_results before insert), so this is safe even if
    // Accio also sends a separate <postResults> for the FMCSA suborder later.
    if (hasFmcsaSuborder) {
      console.log('[MVR WEBHOOK] Detected bundled FMCSA suborder — processing PSP result')
      try {
        const pspOutcome = await processPspAccioWebhookCompletion(supabaseService, xmlBody)
        console.log('[MVR WEBHOOK] Bundled PSP result:', pspOutcome.status, JSON.stringify(pspOutcome.body))
      } catch (pspErr) {
        console.error('[MVR WEBHOOK] Bundled FMCSA processing error (non-fatal):', pspErr)
      }
    }

    // Only notify on the first transition out of `pending`. Guarding at the call
    // site (in addition to inside notifyScreeningReportDelivered) ensures Accio
    // webhook retries cannot fire duplicate emails — see PSP webhook for the
    // bug history (Jason Peterson got 3 "report ready" emails for one stuck order).
    const becameTerminal = previousOrderStatus === 'pending' && nextStatus !== 'pending'
    if (becameTerminal) {
      void notifyScreeningReportDelivered(supabaseService, {
        kind: 'mvr',
        previousStatus: previousOrderStatus,
        driverUserId: mvrOrder.driver_user_id,
        ordered_by_company_id: mvrOrder.ordered_by_company_id,
        ordered_by_user_id: mvrOrder.ordered_by_user_id,
        ordered_by_employer: mvrOrder.ordered_by_employer,
        employer_company_id: mvrOrder.employer_company_id,
        employer_user_id: mvrOrder.employer_user_id,
      }).catch((err) => console.warn('[MVR WEBHOOK] Screening notify non-fatal:', err))
    }

    return NextResponse.json({
      success: true,
      message: 'MVR result processed successfully',
      orderNumber,
      subOrderNumber
    })

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[MVR WEBHOOK] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: message },
      { status: 500 }
    )
  }
}

/**
 * GET handler for webhook health check
 * Allows verification that the webhook endpoint is accessible
 */
export async function GET() {
  return NextResponse.json(
    { 
      message: 'MVR webhook endpoint is active',
      method: 'POST',
      description: 'This endpoint receives MVR results from Accio via POST requests'
    },
    { status: 200 }
  )
}

