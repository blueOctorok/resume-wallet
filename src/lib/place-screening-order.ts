import type { NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildAccioMvrOrderXml,
  buildAccioPspOrderXml,
  generateOrderNumber,
  generateWebhookGuid,
  parseAccioPlaceOrderBundleIds,
} from '@/lib/accio-xml-builder'
import { ensureHubBlockInstalled } from '@/lib/ensure-hub-blocks-psp-mvr-bundle'
import {
  finalizeScreeningOrderReservation,
  releaseScreeningOrderReservation,
  reserveScreeningOrder,
} from '@/lib/screening-order-reservation'
import { getScreeningWebhookBaseUrl } from '@/lib/app-url'
import { isValidSsn, normalizeSsnDigits } from '@/lib/ssn'
import { validateScreeningOrderInput, checkRecentDuplicateOrder } from '@/lib/screening-validation'
import {
  resolveScreeningOrderOwnershipFields,
  type ScreeningOrderOwnership,
} from '@/lib/screening-order-ownership'

export type PlaceScreeningOrderSuccess =
  | { type: 'mvr'; orderId: string; orderNumber: string }
  | { type: 'psp'; pspOrderId: string; orderNumber: string }

export type PlaceScreeningOrderResult =
  | { ok: true; result: PlaceScreeningOrderSuccess }
  | { ok: false; status: number; error: string; details?: string }

export interface PlaceScreeningOrderInput {
  /**
   * Storm hub owner for the order row (`mvr_orders` / `psp_orders.driver_user_id`).
   * Resolved by order email when a matching account exists — not by legal name.
   */
  driverUserId: string
  driverEmail: string | null
  companyId: string
  employerUserId: string | null
  type: 'mvr' | 'psp'
  formData: Record<string, unknown>
  /**
   * Who signed consent (talent-card / bundle subject). Defaults to `driverUserId`.
   * When email rebinds the hub to a different Storm user, consent still checks
   * the signer who completed the disclosure package.
   */
  consentDriverUserId?: string
  /** When set, marks this candidate_requests row completed after a successful order */
  candidateRequestIdToComplete?: string | null
  /** Employer-paid USDC row — linked on PSP bundle inserts when present */
  paymentId?: string | null
  paymentTxHash?: string | null
  /** Skip 24h duplicate window (e.g. retrying a failed order) */
  skipDuplicateCheck?: boolean
  /**
   * Who is the consumer of record on the Accio pull. Required — no default,
   * because a silent `employer` default is how consented pulls ended up
   * company-private and off the candidate's career card. Per DEC-2026-07-002
   * every consent-bundle pull is `driver` (portable, ordered_by_company_id
   * NULL) regardless of who clicked or paid.
   */
  ownership: ScreeningOrderOwnership
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
  const consentDriverUserId = input.consentDriverUserId ?? driverUserId
  const ownershipFields = resolveScreeningOrderOwnershipFields(input.ownership, {
    companyId,
    employerUserId,
  })
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
      .eq('driver_user_id', consentDriverUserId)
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
      .eq('driver_user_id', consentDriverUserId)
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
      .eq('driver_user_id', consentDriverUserId)
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
    String(formData.email ?? '').trim() || driverEmail || `order-${orderNumber}@zknight.io`
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
    orderXml = buildAccioPspOrderXml({
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

  // ── Reserve BEFORE paying Accio ──────────────────────────────────────────
  // The pending row is the atomic lock (partial unique index from migration
  // 102): a concurrent duplicate fails right here with a 409, before any
  // vendor charge. On Accio failure we release (mark failed) so the slot
  // frees for a retry.
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  const reservation = await reserveScreeningOrder(supabase, {
    kind: type,
    driverUserId,
    orderNumber,
    orderXml,
    dlNumber: n.dlNumber,
    dlState: n.dlState,
    expiresAtIso: expiresAt,
    orderedByCompanyId: ownershipFields.ordered_by_company_id,
    orderedByUserId: ownershipFields.ordered_by_user_id,
    orderedByEmployer: ownershipFields.ordered_by_employer,
    paymentId: input.paymentId ?? null,
    paymentTxHash: input.paymentTxHash ?? null,
  })
  if (reservation.ok === false) {
    if (reservation.reason === 'duplicate') {
      return { ok: false, status: 409, error: reservation.message }
    }
    return { ok: false, status: 500, error: 'Failed to store order', details: reservation.message }
  }
  const reservedOrderId = reservation.orderId

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
      await releaseScreeningOrderReservation(supabase, type, reservedOrderId)
      return { ok: false, status: 500, error: 'Failed to submit screening order', details: String(raw.status) }
    }
    accioResponse = await raw.text()
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[PLACE SCREENING ORDER] Accio network error:', msg)
    await releaseScreeningOrderReservation(supabase, type, reservedOrderId)
    return { ok: false, status: 500, error: 'Failed to submit screening order', details: msg }
  }

  // ── Accio error detection ────────────────────────────────────────────────
  // Accio can return HTTP 200 with an error in the XML body. Detect common
  // error patterns and fail loudly so we never keep a "pending" order that
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
    await releaseScreeningOrderReservation(supabase, type, reservedOrderId)
    return {
      ok: false,
      status: 502,
      error: 'Screening service rejected the order — review data and retry',
      details: accioResponse.substring(0, 500),
    }
  }

  if (type === 'psp') {
    const ids = parseAccioPlaceOrderBundleIds(accioResponse)
    await finalizeScreeningOrderReservation(supabase, 'psp', reservedOrderId, {
      accio_suborder_number: ids.fmcsaSuborderId,
      accio_remote_order_number: ids.accioOrderId,
      accio_remote_suborder_number: ids.fmcsaSuborderId,
    })
    await ensureHubBlockInstalled(supabase, driverUserId, 'driver-psp')
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
        pspOrderId: reservedOrderId,
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

  await finalizeScreeningOrderReservation(supabase, 'mvr', reservedOrderId, {
    accio_suborder_number: subOrderId,
    accio_remote_order_number: accioOrderId,
    accio_remote_suborder_number: subOrderId,
    applicant_portal_url: applicantPortalUrl,
  })

  await ensureHubBlockInstalled(supabase, driverUserId, 'driver-mvr')

  if (input.candidateRequestIdToComplete) {
    await supabase
      .from('candidate_requests')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', input.candidateRequestIdToComplete)
      .neq('status', 'completed')
  }

  return { ok: true, result: { type: 'mvr', orderId: reservedOrderId, orderNumber } }
}
