import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import {
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
import { normalizeWalletAddress } from '@/lib/user-by-wallet'
import { getScreeningWebhookBaseUrl } from '@/lib/app-url'
import { isValidSsn, normalizeSsnDigits } from '@/lib/ssn'
import { validateScreeningOrderInput, checkRecentDuplicateOrder } from '@/lib/screening-validation'
import { resolveScreeningPayment } from '@/lib/resolve-waived-screening-payment'
import { getStormUserIdFromRequest } from '@/lib/auth-session'

/**
 * POST /api/psp/order — candidate self-order FMCSA PSP (single Accio suborder).
 */
export async function POST(request: NextRequest) {
  try {
    const {
      paymentTxHash,
      pspConsentId,
      dlNumber,
      dlState,
      firstName: providedFirstName,
      lastName: providedLastName,
      middleName: providedMiddleName,
      email: providedEmail,
      phone: providedPhone,
      ssn: providedSsn,
      dob: providedDob,
      gender: providedGender,
      address: providedAddress,
      city: providedCity,
      state: providedState,
      zip: providedZip,
      jobState,
    } = await request.json()

    const sessionUserId = await getStormUserIdFromRequest(request)
    if (!sessionUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    if (!dlNumber || !dlState) {
      return NextResponse.json({ error: 'Driver license number and state are required' }, { status: 400 })
    }
    if (!pspConsentId || typeof pspConsentId !== 'string') {
      return NextResponse.json(
        { error: 'FMCSA PSP disclosure must be signed before ordering. Complete the PSP authorization form first.' },
        { status: 400 },
      )
    }

    const supabaseService = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const { data: user, error: userError } = await supabaseService
      .from('users')
      .select('id, email, wallet_address')
      .eq('id', sessionUserId)
      .maybeSingle()
    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const paymentResult = await resolveScreeningPayment(supabaseService, {
      paymentTxHash,
      paymentType: 'PSP_ORDER',
      userId: user.id,
    })
    if (!paymentResult.ok) {
      return NextResponse.json({ error: paymentResult.error }, { status: paymentResult.status })
    }

    const payment = { id: paymentResult.paymentId }
    const storedPaymentTxHash = paymentResult.resolvedTxHash ?? paymentTxHash ?? null

    if (paymentTxHash) {
      const walletNorm = normalizeWalletAddress(user.wallet_address ?? '')
      const { data: paymentRow } = await supabaseService
        .from('payments')
        .select('user_id')
        .eq('id', payment.id)
        .maybeSingle()

      if (paymentRow?.user_id && paymentRow.user_id !== user.id) {
        const { data: paymentUserRecord } = await supabaseService
          .from('users')
          .select('wallet_address')
          .eq('id', paymentRow.user_id)
          .maybeSingle()
        const payWalletNorm = paymentUserRecord?.wallet_address
          ? normalizeWalletAddress(paymentUserRecord.wallet_address)
          : ''
        if (!(payWalletNorm && payWalletNorm === walletNorm)) {
          return NextResponse.json({ error: 'Payment does not belong to this wallet address.' }, { status: 403 })
        }
      }
    }

    const accioAccount = process.env.ACCIO_ACCOUNT
    const accioUsername = process.env.ACCIO_USERNAME
    const accioPassword = process.env.ACCIO_PASSWORD
    const accioApiUrl = process.env.ACCIO_API_URL
    if (!accioAccount || !accioUsername || !accioPassword || !accioApiUrl) {
      return NextResponse.json({ error: 'PSP service configuration error' }, { status: 500 })
    }

    const { data: fmcsaConsent, error: consentErr } = await supabaseService
      .from('psp_consents')
      .select('id, consumed_at')
      .eq('id', pspConsentId)
      .eq('driver_user_id', user.id)
      .is('request_id', null)
      .is('company_id', null)
      .maybeSingle()

    if (consentErr || !fmcsaConsent) {
      return NextResponse.json(
        { error: 'PSP consent not found or does not match this account.' },
        { status: 400 },
      )
    }
    if (fmcsaConsent.consumed_at) {
      return NextResponse.json(
        { error: 'This PSP authorization was already used. Sign the disclosure again before ordering.' },
        { status: 400 },
      )
    }

    const { data: userProfile } = await supabaseService
      .from('user_profiles')
      .select('first_name, last_name')
      .eq('user_id', user.id)
      .maybeSingle()

    const { data: dotApplication } = await supabaseService
      .from('driver_applications')
      .select('application_data')
      .eq('user_id', user.id)
      .eq('is_complete', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const appData = dotApplication?.application_data || {}
    const form1Data = appData.form1Data || {}

    const firstName = providedFirstName || form1Data.firstName || userProfile?.first_name || ''
    const lastName = providedLastName || form1Data.lastName || userProfile?.last_name || ''
    const middleName = providedMiddleName || form1Data.middleName || ''
    const email = providedEmail || user.email || ''
    const phone = providedPhone || form1Data.phone || ''
    // Full 9-digit SSN; the DOT app stores it as `XXX-XX-XXXX`, the screening forms send digits-only.
    // Normalize so what reaches Accio is always 9 raw digits — last-4 forces FMCSA into the slow path.
    const ssn = normalizeSsnDigits(providedSsn || form1Data.ssn || '')
    const dob = providedDob || form1Data.dateOfBirth || ''
    const gender = providedGender || form1Data.gender || 'U'
    const address = providedAddress || form1Data.address || ''
    const city = providedCity || form1Data.city || ''
    const state = providedState || form1Data.state || ''
    const zip = providedZip || form1Data.zip || ''

    if (!firstName || !lastName || !email || !isValidSsn(ssn) || !dob || !address || !city || !state || !zip) {
      return NextResponse.json(
        {
          error:
            'Missing required personal information. A full 9-digit SSN is required for FMCSA PSP — last-4 forces the order to a slow applicant-portal verification path.',
          requiresPersonalInfo: true,
        },
        { status: 400 },
      )
    }

    // Strict pre-flight validation — see screening-validation.ts. Bad data
    // here means we don't pay Accio for an order we already know will fail.
    const validation = validateScreeningOrderInput({
      firstName, lastName, dob, dlState, dlNumber, ssn,
    })
    // `=== false` narrows the ValidationResult discriminated union — `!` doesn't.
    if (validation.ok === false) {
      return NextResponse.json(
        { error: validation.error, requiresPersonalInfo: true },
        { status: 400 },
      )
    }

    // PSP duplicate-prevention also catches the bundle's MVR — both rows
    // come from the same placeOrder, so checking either kind is sufficient.
    const dupErr = await checkRecentDuplicateOrder(supabaseService, {
      driverUserId: user.id,
      kind: 'psp',
    })
    if (dupErr) {
      return NextResponse.json({ error: dupErr }, { status: 409 })
    }

    const orderNumber = generateOrderNumber()
    const webhookGuid = generateWebhookGuid()
    let webhookUrl: string
    try {
      webhookUrl = `${getScreeningWebhookBaseUrl(request)}/api/mvr/webhook`
    } catch (err) {
      console.error('[PSP ORDER] Webhook URL resolution failed:', err)
      return NextResponse.json(
        { error: 'Server is not configured for screening webhooks. Contact support.' },
        { status: 500 },
      )
    }

    // Send full SSN (see comment in mvr/order/route.ts). Use normalized
    // values from validation (uppercase state/DL, YYYYMMDD DOB).
    const n = validation.normalized
    const orderXml = buildAccioPspOrderXml({
      firstName: n.firstName,
      middleName,
      lastName: n.lastName,
      email,
      phone,
      ssn: n.ssn,
      dob: n.dob,
      gender,
      address,
      city,
      state,
      zip,
      jobState: jobState ?? state,
      dlNumber: n.dlNumber,
      dlState: n.dlState,
      orderNumber,
      webhookUrl,
      webhookGuid,
    })

    // Reserve the order row BEFORE calling Accio — the partial unique index
    // (migration 102) makes this the atomic duplicate lock, so a concurrent
    // or repeat order fails here with 409 instead of costing another pull.
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    const reservation = await reserveScreeningOrder(supabaseService, {
      kind: 'psp',
      driverUserId: user.id,
      orderNumber,
      orderXml,
      dlNumber: n.dlNumber,
      dlState: n.dlState,
      expiresAtIso: expiresAt,
      paymentId: payment.id,
      paymentTxHash: storedPaymentTxHash,
    })
    if (reservation.ok === false) {
      if (reservation.reason === 'duplicate') {
        return NextResponse.json({ error: reservation.message }, { status: 409 })
      }
      return NextResponse.json({ error: 'Failed to store PSP order' }, { status: 500 })
    }

    let accioResponse: string
    try {
      const accioResponseRaw = await fetch(accioApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml' },
        body: orderXml,
      })
      if (!accioResponseRaw.ok) {
        const errorText = await accioResponseRaw.text()
        throw new Error(`Accio API returned ${accioResponseRaw.status}: ${errorText}`)
      }
      accioResponse = await accioResponseRaw.text()
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Accio request failed'
      console.error('[PSP ORDER] Accio error:', msg)
      await releaseScreeningOrderReservation(supabaseService, 'psp', reservation.orderId)
      return NextResponse.json({ error: 'Failed to submit PSP order to Accio', details: msg }, { status: 500 })
    }

    const ids = parseAccioPlaceOrderBundleIds(accioResponse)

    await finalizeScreeningOrderReservation(supabaseService, 'psp', reservation.orderId, {
      accio_suborder_number: ids.fmcsaSuborderId,
      accio_remote_order_number: ids.accioOrderId,
      accio_remote_suborder_number: ids.fmcsaSuborderId,
    })

    await ensureHubBlockInstalled(supabaseService, user.id, 'driver-psp')

    const { data: pspOrder } = await supabaseService
      .from('psp_orders')
      .select('id, accio_order_number, accio_suborder_number, status, ordered_at')
      .eq('id', reservation.orderId)
      .single()

    if (!pspOrder) {
      return NextResponse.json({ error: 'Failed to load PSP order after insert' }, { status: 500 })
    }

    const { error: consumeErr } = await supabaseService
      .from('psp_consents')
      .update({ consumed_at: new Date().toISOString() })
      .eq('id', pspConsentId)

    if (consumeErr) {
      console.error('[PSP ORDER] Consent consume error:', consumeErr)
    }

    return NextResponse.json({
      success: true,
      order: {
        id: pspOrder.id,
        orderNumber: pspOrder.accio_order_number,
        subOrderNumber: pspOrder.accio_suborder_number,
        status: pspOrder.status,
        orderedAt: pspOrder.ordered_at,
      },
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[PSP ORDER] Unexpected:', error)
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 })
  }
}
