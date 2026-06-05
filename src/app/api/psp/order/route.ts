import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import {
  buildAccioPspWithMvrBundleOrderXml,
  generateOrderNumber,
  generateWebhookGuid,
  parseAccioPlaceOrderBundleIds,
} from '@/lib/accio-xml-builder'
import { insertPspMvrBundleOrders } from '@/lib/place-psp-mvr-bundle-db'
import { ensureHubBlocksForPspMvrBundle } from '@/lib/ensure-hub-blocks-psp-mvr-bundle'
import { getOrCreateUserByWallet, normalizeWalletAddress } from '@/lib/user-by-wallet'
import { getScreeningWebhookBaseUrl } from '@/lib/app-url'
import { isValidSsn, normalizeSsnDigits } from '@/lib/ssn'
import { validateScreeningOrderInput, checkRecentDuplicateOrder } from '@/lib/screening-validation'
import { resolveScreeningPayment } from '@/lib/resolve-waived-screening-payment'

/**
 * POST /api/psp/order — candidate self-order **PSP + MVR** (one Accio placeOrder, two suborders).
 */
export async function POST(request: NextRequest) {
  try {
    const {
      walletAddress,
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

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 })
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

    let user: { id: string; email?: string | null }
    try {
      const { user: u } = await getOrCreateUserByWallet(supabaseService, walletAddress)
      user = { id: u.id, email: u.email }
    } catch {
      return NextResponse.json({ error: 'Failed to get or create user account' }, { status: 500 })
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
      const walletNorm = normalizeWalletAddress(walletAddress)
      const { data: paymentRow } = await supabaseService
        .from('payments')
        .select('user_id')
        .eq('id', payment.id)
        .maybeSingle()

      const { data: sameWalletRows } = await supabaseService
        .from('users')
        .select('id, wallet_address')
        .ilike('wallet_address', walletNorm)

      const userIdsForWallet = new Set((sameWalletRows ?? []).map((r) => r.id))
      if (paymentRow?.user_id && !userIdsForWallet.has(paymentRow.user_id)) {
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
    const orderXml = buildAccioPspWithMvrBundleOrderXml({
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
      return NextResponse.json({ error: 'Failed to submit PSP order to Accio', details: msg }, { status: 500 })
    }

    const bundle = parseAccioPlaceOrderBundleIds(accioResponse)
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    const inserted = await insertPspMvrBundleOrders(supabaseService, {
      driverUserId: user.id,
      orderNumber,
      orderXml,
      accioOrderId: bundle.accioOrderId,
      mvrSuborderId: bundle.mvrSuborderId,
      fmcsaSuborderId: bundle.fmcsaSuborderId,
      applicantPortalUrl: bundle.applicantPortalUrl,
      dlNumber: n.dlNumber,
      dlState: n.dlState,
      expiresAtIso: expiresAt,
      paymentId: payment.id,
      paymentTxHash: storedPaymentTxHash,
    })

    if ('error' in inserted) {
      console.error('[PSP ORDER] DB insert:', inserted.error)
      return NextResponse.json({ error: 'Failed to store PSP order' }, { status: 500 })
    }

    await ensureHubBlocksForPspMvrBundle(supabaseService, user.id)

    const { data: pspOrder } = await supabaseService
      .from('psp_orders')
      .select('id, accio_order_number, accio_suborder_number, status, ordered_at')
      .eq('id', inserted.pspOrderId)
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
        mvrOrderId: inserted.mvrOrderId,
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
