import type { SupabaseClient } from '@supabase/supabase-js'
import { parseAccioMvrResult, mvrResultToJsonb } from '@/lib/accio-xml-parser'
import { saveMvrData } from '@/lib/block-data'
import { notifyScreeningReportDelivered } from '@/lib/notify-screening-complete'
import {
  isFmcsaPostResultsWebhookXml,
  processPspAccioWebhookCompletion,
} from '@/lib/process-psp-accio-webhook'
import { deriveScreeningStatus } from '@/lib/accio-result-status'
import { matchScreeningOrder, buildRemoteIdPatch } from '@/lib/screening-webhook-match'
import { syncOutreachInviteForDriver } from '@/lib/sync-outreach-invite-status'

export interface MvrWebhookProcessOutcome {
  status: number
  body: Record<string, unknown>
}

function formatDateForDb(dateStr: string | undefined): string | null {
  if (!dateStr || dateStr.length !== 8) return null
  const year = dateStr.substring(0, 4)
  const month = dateStr.substring(4, 6)
  const day = dateStr.substring(6, 8)
  return `${year}-${month}-${day}`
}

function isCompletionXml(xmlBody: string): boolean {
  const hasScreeningResults = xmlBody.includes('<ScreeningResults>')
  const hasCompleteOrder = xmlBody.includes('<completeOrder')
  const hasPostResults = xmlBody.includes('<postResults')
  const isInProgressStatus =
    xmlBody.includes('filledStatus="in progress"') ||
    xmlBody.includes("filledStatus='in progress'") ||
    xmlBody.includes('<status>inprogress')
  return (hasScreeningResults || hasCompleteOrder || hasPostResults) && !isInProgressStatus
}

/**
 * Persists MVR completion from Accio webhook XML (or getOrderResults replay).
 * Shared by `/api/mvr/webhook` and employer reconcile.
 */
export async function processMvrAccioWebhookCompletion(
  supabase: SupabaseClient,
  xmlBody: string,
): Promise<MvrWebhookProcessOutcome> {
  if (!isCompletionXml(xmlBody)) {
    const isInProgressStatus =
      xmlBody.includes('filledStatus="in progress"') ||
      xmlBody.includes("filledStatus='in progress'")
    const isConfirmation =
      xmlBody.includes('<orderConfirmation>') || xmlBody.includes('<confirmation>')
    return {
      status: 200,
      body: {
        success: true,
        message: 'Non-completion notification acknowledged',
        type: isInProgressStatus ? 'in_progress' : isConfirmation ? 'confirmation' : 'unknown',
      },
    }
  }

  const hasFmcsaSuborder = /type=["']fmcsa_crash_inspection["']/i.test(xmlBody)
  const hasMvrSuborder = /<subOrder[^>]*type=["']MVR["']/i.test(xmlBody)

  if (isFmcsaPostResultsWebhookXml(xmlBody) || (hasFmcsaSuborder && !hasMvrSuborder)) {
    const outcome = await processPspAccioWebhookCompletion(supabase, xmlBody)
    return { status: outcome.status, body: outcome.body }
  }

  let parsedResult
  try {
    parsedResult = parseAccioMvrResult(xmlBody)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown parse error'
    console.error('[MVR PROCESS] Parse error:', error)
    return { status: 400, body: { error: 'Failed to parse XML result', details: message } }
  }

  const orderNumber = parsedResult.orderNumber || parsedResult.remoteOrderNumber || ''
  const subOrderNumber =
    parsedResult.subOrderNumber || parsedResult.remoteSubOrderNumber || ''

  // Require at least one order identifier — suborder is optional (PSP path already allows this).
  if (!orderNumber) {
    console.error('[MVR PROCESS] Missing order reference', parsedResult)
    return { status: 400, body: { error: 'Missing order numbers in result' } }
  }

  const matched = await matchScreeningOrder<{
    id: string
    status: string
    ordered_at: string
    driver_user_id: string | null
    driver_profile_id: string | null
    accio_remote_order_number?: string | null
    accio_remote_suborder_number?: string | null
    expires_at: string | null
    ordered_by_company_id?: string | null
    ordered_by_user_id?: string | null
    ordered_by_employer?: boolean | null
    employer_company_id?: string | null
    employer_user_id?: string | null
  }>(supabase, 'mvr_orders', {
    ourOrderNumber: orderNumber,
    remoteOrderNumber: parsedResult.remoteOrderNumber,
    ourSubOrderNumber: subOrderNumber || undefined,
    remoteSubOrderNumber: parsedResult.remoteSubOrderNumber,
    dlNumber: parsedResult.licenseNumber,
    dlState: parsedResult.licenseState,
  })

  if (!matched) {
    console.error('[MVR PROCESS] No order matched:', {
      orderNumber,
      subOrderNumber,
      remoteOrderNumber: parsedResult.remoteOrderNumber,
      remoteSubOrderNumber: parsedResult.remoteSubOrderNumber,
    })
    return { status: 404, body: { error: 'MVR order not found' } }
  }

  const mvrOrder = matched.row
  const previousOrderStatus = mvrOrder.status

  const { data: existingResult } = await supabase
    .from('mvr_results')
    .select('id')
    .eq('mvr_order_id', mvrOrder.id)
    .maybeSingle()

  const parsedData = mvrResultToJsonb(parsedResult)
  const primaryLicense =
    parsedResult.licenses && parsedResult.licenses.length > 0
      ? parsedResult.licenses[0]
      : null

  // Defensive truncation: license_class/status are now `text` in DB, but if
  // anyone narrows them again or we hit an unexpected column constraint we'd
  // rather store a truncated value than fail the whole reconcile silently.
  const safe = (v: string | undefined | null, max = 1000): string | null =>
    v ? v.slice(0, max) : null

  const resultData = {
    mvr_order_id: mvrOrder.id,
    driver_user_id: mvrOrder.driver_user_id,
    driver_profile_id: mvrOrder.driver_profile_id,
    license_number: safe(parsedResult.licenseNumber, 50),
    license_state: safe(parsedResult.licenseState, 2),
    license_class: safe(primaryLicense?.class),
    license_status: safe(primaryLicense?.status),
    license_expiration_date: primaryLicense?.expirationDate
      ? formatDateForDb(primaryLicense.expirationDate)
      : parsedResult.licenseExpirationDate
        ? formatDateForDb(parsedResult.licenseExpirationDate)
        : null,
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
    parsed_data: parsedData,
    result_status: 'parsed',
    parsed_at: new Date().toISOString(),
  }

  let mvrResult
  if (existingResult) {
    const { data: updated, error: updateError } = await supabase
      .from('mvr_results')
      .update(resultData)
      .eq('id', existingResult.id)
      .select()
      .single()
    if (updateError) throw updateError
    mvrResult = updated
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from('mvr_results')
      .insert(resultData)
      .select()
      .single()
    if (insertError) throw insertError
    mvrResult = inserted
  }

  const { status: nextStatus, outcome: nextOutcome } = deriveScreeningStatus({
    filledStatus: parsedResult.filledStatus,
    filledCode: parsedResult.filledCode,
    heldForReview: parsedResult.heldForReview,
  })

  const remoteIdPatch = buildRemoteIdPatch(
    matched,
    parsedResult.remoteOrderNumber,
    parsedResult.remoteSubOrderNumber,
  )

  await supabase
    .from('mvr_orders')
    .update({
      status: nextStatus,
      result_outcome: nextOutcome,
      ...remoteIdPatch,
      processed_at: parsedResult.timeFilled || new Date().toISOString(),
      completed_at: new Date().toISOString(),
      result_xml: xmlBody,
      fee_amount: parsedResult.fees?.addon || null,
    })
    .eq('id', mvrOrder.id)

  if (mvrOrder.driver_user_id) {
    void saveMvrData(supabase, mvrOrder.driver_user_id, {
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
    }).catch((err) => console.warn('[MVR PROCESS] Block sync non-fatal:', err))
  }

  if (hasFmcsaSuborder) {
    try {
      await processPspAccioWebhookCompletion(supabase, xmlBody)
    } catch (pspErr) {
      console.error('[MVR PROCESS] Bundled PSP error (non-fatal):', pspErr)
    }
  }

  const becameTerminal = previousOrderStatus === 'pending' && nextStatus !== 'pending'
  if (becameTerminal && mvrOrder.driver_user_id && mvrOrder.ordered_by_company_id) {
    void syncOutreachInviteForDriver(
      supabase,
      mvrOrder.ordered_by_company_id,
      mvrOrder.driver_user_id,
    ).catch((err) => console.warn('[MVR PROCESS] Outreach invite sync non-fatal:', err))
  }

  if (becameTerminal) {
    void notifyScreeningReportDelivered(supabase, {
      kind: 'mvr',
      previousStatus: previousOrderStatus,
      driverUserId: mvrOrder.driver_user_id,
      ordered_by_company_id: mvrOrder.ordered_by_company_id,
      ordered_by_user_id: mvrOrder.ordered_by_user_id,
      ordered_by_employer: mvrOrder.ordered_by_employer,
      employer_company_id: mvrOrder.employer_company_id,
      employer_user_id: mvrOrder.employer_user_id,
    }).catch((err) => console.warn('[MVR PROCESS] Notify non-fatal:', err))
  }

  return {
    status: 200,
    body: {
      success: true,
      message: 'MVR result processed successfully',
      orderId: mvrOrder.id,
      matchedBy: matched.matchedBy,
      status: nextStatus,
    },
  }
}
