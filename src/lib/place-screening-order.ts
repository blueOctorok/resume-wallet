import type { NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildAccioMvrOrderXml,
  buildAccioPspWithMvrBundleOrderXml,
  generateOrderNumber,
  generateWebhookGuid,
  parseAccioPlaceOrderBundleIds,
} from '@/lib/accio-xml-builder'
import { insertPspMvrBundleOrders } from '@/lib/place-psp-mvr-bundle-db'
import { ensureHubBlocksForPspMvrBundle } from '@/lib/ensure-hub-blocks-psp-mvr-bundle'
import { getScreeningWebhookBaseUrl } from '@/lib/app-url'
import { isValidSsn, normalizeSsnDigits } from '@/lib/ssn'
import { validateScreeningOrderInput, checkRecentDuplicateOrder } from '@/lib/screening-validation'

export type PlaceScreeningOrderSuccess =
  | { type: 'mvr'; orderId: string; orderNumber: string }
  | { type: 'psp'; pspOrderId: string; mvrOrderId: string; orderNumber: string }

export type PlaceScreeningOrderResult =
  | { ok: true; result: PlaceScreeningOrderSuccess }
  | { ok: false; status: number; error: string; details?: string }

export interface PlaceScreeningOrderInput {
  driverUserId: string
  driverEmail: string | null
  companyId: string
  employerUserId: string | null
  type: 'mvr' | 'psp'
  formData: Record<string, unknown>
  /** When set, marks this candidate_requests row completed after a successful order */
  candidateRequestIdToComplete?: string | null
  /** Employer-paid USDC row — linked on PSP bundle inserts when present */
  paymentId?: string | null
  paymentTxHash?: string | null
  /** Skip 24h duplicate window (e.g. retrying a failed order) */
  skipDuplicateCheck?: boolean
}

/**
 * Shared Accio placement for employer-initiated and candidate fulfill-screening flows.
 */
export async function placeScreeningOrder(
  supabase: SupabaseClient,
  request: NextRequest,
  input: PlaceScreeningOrderInput,
): Promise<PlaceScreeningOrderResult> {
  const { driverUserId, driverEmail, companyId, employerUserId, type, formData } = input
  const { firstName, lastName, dob, ssn, dlNumber, dlState, address, city, state, zip } = formData as Record<
    string,
    string
  >
  const missing = ['firstName', 'lastName', 'dob', 'ssn', 'dlNumber', 'dlState', 'address', 'city', 'state', 'zip'].filter(
    f => !(formData as Record<string, string>)[f]?.trim(),
  )
  if (missing.length > 0) {
    return { ok: false, status: 400, error: 'Missing required fields', details: missing.join(', ') }
  }

  const fullSsn = normalizeSsnDigits(String(ssn))
  if (!isValidSsn(fullSsn)) {
    return {
      ok: false,
      status: 400,
      error:
        'A full 9-digit SSN is required (last-4 forces Accio onto the slow applicant-portal verification path).',
    }
  }

  const validation = validateScreeningOrderInput({
    firstName: String(firstName),
    lastName: String(lastName),
    dob: String(dob),
    dlState: String(dlState),
    dlNumber: String(dlNumber),
    ssn: fullSsn,
  })
  if (validation.ok === false) {
    return { ok: false, status: 400, error: validation.error }
  }

  if (type === 'mvr') {
    const { data: consent } = await supabase
      .from('bgcheck_consents')
      .select('id')
      .eq('driver_user_id', driverUserId)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!consent) {
      return { ok: false, status: 400, error: 'Disclosure consent not found — sign the form first' }
    }
  } else {
    const { data: bgConsent } = await supabase
      .from('bgcheck_consents')
      .select('id')
      .eq('driver_user_id', driverUserId)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!bgConsent) {
      return { ok: false, status: 400, error: 'Background check disclosure not signed — complete Step 1 first' }
    }
    const { data: pspConsent } = await supabase
      .from('psp_consents')
      .select('id')
      .eq('driver_user_id', driverUserId)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!pspConsent) {
      return { ok: false, status: 400, error: 'PSP consent not found — sign the FMCSA form first' }
    }
  }

  const dupErr = input.skipDuplicateCheck
    ? null
    : await checkRecentDuplicateOrder(supabase, {
        driverUserId,
        kind: type,
      })
  if (dupErr) {
    return { ok: false, status: 409, error: dupErr }
  }

  const accioAccount = process.env.ACCIO_ACCOUNT
  const accioUsername = process.env.ACCIO_USERNAME
  const accioPassword = process.env.ACCIO_PASSWORD
  const accioApiUrl = process.env.ACCIO_API_URL || 'https://service.keybackground.com/c/p/researcherxml'
  if (!accioAccount || !accioUsername || !accioPassword) {
    console.error('[PLACE SCREENING ORDER] Accio credentials not configured')
    return { ok: false, status: 500, error: 'Screening service not configured' }
  }

  const orderNumber = generateOrderNumber()
  const webhookGuid = generateWebhookGuid()
  let webhookUrl: string
  try {
    webhookUrl = `${getScreeningWebhookBaseUrl(request)}/api/mvr/webhook`
  } catch (err) {
    console.error('[PLACE SCREENING ORDER] Webhook URL resolution failed:', err)
    return {
      ok: false,
      status: 500,
      error: 'Server is not configured for screening webhooks. Contact support.',
    }
  }

  const n = validation.normalized
  const middleName = String(formData.middleName ?? '').trim()
  const email =
    String(formData.email ?? '').trim() || driverEmail || `order-${orderNumber}@stormchain.ai`
  const phone = String(formData.phone ?? '').trim()

  let orderXml: string
  if (type === 'mvr') {
    orderXml = buildAccioMvrOrderXml({
      firstName: n.firstName,
      middleName,
      lastName: n.lastName,
      email,
      phone,
      ssn: n.ssn,
      dob: n.dob,
      gender: 'U',
      address: String(address).trim(),
      city: String(city).trim(),
      state: String(state).trim().toUpperCase(),
      zip: String(zip).trim(),
      jobState: String(state).trim().toUpperCase(),
      dlNumber: n.dlNumber,
      dlState: n.dlState,
      orderNumber,
      mvrSearchType: 'standard',
      includeFmcsaCrashInspection: false,
      webhookUrl,
      webhookGuid,
    })
  } else {
    orderXml = buildAccioPspWithMvrBundleOrderXml({
      firstName: n.firstName,
      middleName,
      lastName: n.lastName,
      email,
      phone,
      ssn: n.ssn,
      dob: n.dob,
      gender: 'U',
      address: String(address).trim(),
      city: String(city).trim(),
      state: String(state).trim().toUpperCase(),
      zip: String(zip).trim(),
      jobState: String(state).trim().toUpperCase(),
      dlNumber: n.dlNumber,
      dlState: n.dlState,
      orderNumber,
      webhookUrl,
      webhookGuid,
    })
  }

  console.log('[PLACE SCREENING ORDER] Submitting to Accio:', {
    type,
    orderNumber,
    webhookUrl,
    accioApiUrl,
    driverUserId,
    dlState: n.dlState,
    dlNumber: n.dlNumber ? `${n.dlNumber.substring(0, 3)}***` : 'MISSING',
    firstName: n.firstName,
    lastName: n.lastName,
    dob: n.dob,
    hasSsn: Boolean(n.ssn && n.ssn.length === 9),
  })

  let accioResponse: string
  try {
    const raw = await fetch(accioApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' },
      body: orderXml,
    })
    if (!raw.ok) {
      const text = await raw.text()
      console.error(`[PLACE SCREENING ORDER] Accio API HTTP error:`, raw.status, text)
      return { ok: false, status: 500, error: 'Failed to submit screening order', details: String(raw.status) }
    }
    accioResponse = await raw.text()
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[PLACE SCREENING ORDER] Accio network error:', msg)
    return { ok: false, status: 500, error: 'Failed to submit screening order', details: msg }
  }

  // ── Accio error detection ────────────────────────────────────────────────
  // Accio can return HTTP 200 with an error in the XML body. Detect common
  // error patterns and fail loudly so we never store a "pending" order that
  // Accio actually rejected.
  console.log('[PLACE SCREENING ORDER] Accio response length:', accioResponse.length, 'type:', type, 'orderNumber:', orderNumber)
  console.log('[PLACE SCREENING ORDER] Accio response body:', accioResponse.substring(0, 2000))

  const hasOrderId = /orderID=["']\d+["']/i.test(accioResponse)
  const hasError =
    /<error[^>]*>/i.test(accioResponse) ||
    /<status>\s*ERROR\s*<\/status>/i.test(accioResponse) ||
    /errorCode/i.test(accioResponse)

  if (hasError || !hasOrderId) {
    console.error('[PLACE SCREENING ORDER] Accio rejected order:', {
      type,
      orderNumber,
      hasOrderId,
      hasError,
      responseSnippet: accioResponse.substring(0, 1000),
    })
    return {
      ok: false,
      status: 502,
      error: 'Screening service rejected the order — review data and retry',
      details: accioResponse.substring(0, 500),
    }
  }

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  if (type === 'psp') {
    const bundle = parseAccioPlaceOrderBundleIds(accioResponse)
    const inserted = await insertPspMvrBundleOrders(supabase, {
      driverUserId,
      orderNumber,
      orderXml,
      accioOrderId: bundle.accioOrderId,
      mvrSuborderId: bundle.mvrSuborderId,
      fmcsaSuborderId: bundle.fmcsaSuborderId,
      applicantPortalUrl: bundle.applicantPortalUrl,
      dlNumber: n.dlNumber,
      dlState: n.dlState,
      expiresAtIso: expiresAt,
      orderedByCompanyId: companyId,
      orderedByUserId: employerUserId,
      orderedByEmployer: true,
      paymentId: input.paymentId ?? null,
      paymentTxHash: input.paymentTxHash ?? null,
    })
    if ('error' in inserted) {
      return { ok: false, status: 500, error: 'Failed to store orders', details: inserted.error }
    }
    await ensureHubBlocksForPspMvrBundle(supabase, driverUserId)
    if (input.candidateRequestIdToComplete) {
      await supabase
        .from('candidate_requests')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', input.candidateRequestIdToComplete)
        .neq('status', 'completed')
    }
    return {
      ok: true,
      result: {
        type: 'psp',
        pspOrderId: inserted.pspOrderId,
        mvrOrderId: inserted.mvrOrderId,
        orderNumber,
      },
    }
  }

  const accioOrderId = accioResponse.match(/orderID="(\d+)"/)?.[1] ?? null
  const subOrderId = accioResponse.match(/suborderID="(\d+)"/)?.[1] ?? null
  const portalMatch =
    accioResponse.match(/<applicantPortalURL><!\[CDATA\[(.*?)\]\]><\/applicantPortalURL>/) ||
    accioResponse.match(/<applicantPortalURL>(.*?)<\/applicantPortalURL>/)
  const applicantPortalUrl = portalMatch?.[1] ?? null

  const sharedRow = {
    driver_user_id: driverUserId,
    accio_order_number: orderNumber,
    accio_suborder_number: subOrderId,
    accio_remote_order_number: accioOrderId,
    accio_remote_suborder_number: subOrderId,
    dl_number: n.dlNumber,
    dl_state: n.dlState,
    status: 'pending',
    order_xml: orderXml,
    ordered_by_company_id: companyId,
    ordered_by_user_id: employerUserId,
    ordered_by_employer: true,
    expires_at: expiresAt,
  }

  const orderRow: Record<string, unknown> = {
    ...sharedRow,
    order_type: 'MVR',
    mvr_search_type: 'standard',
    applicant_portal_url: applicantPortalUrl,
  }
  if (input.paymentId) {
    orderRow.payment_id = input.paymentId
    orderRow.payment_tx_hash = input.paymentTxHash ?? null
  }

  const { data: order, error: orderError } = await supabase.from('mvr_orders').insert(orderRow).select().single()
  if (orderError || !order) {
    console.error(`[PLACE SCREENING ORDER] DB insert error (mvr_orders):`, orderError)
    return { ok: false, status: 500, error: 'Failed to store order', details: orderError?.message }
  }

  if (input.candidateRequestIdToComplete) {
    await supabase
      .from('candidate_requests')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', input.candidateRequestIdToComplete)
      .neq('status', 'completed')
  }

  return { ok: true, result: { type: 'mvr', orderId: order.id as string, orderNumber } }
}
