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
    if (!paymentTxHash) {
      return NextResponse.json(
        { error: 'Payment is required. Please complete payment before ordering.' },
        { status: 400 },
      )
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

    let payment = null
    const { data: exactPayment } = await supabaseService
      .from('payments')
      .select('id, status, amount_usdc, user_id, tx_hash, created_at')
      .eq('tx_hash', paymentTxHash)
      .eq('type', 'PSP_ORDER')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (exactPayment) {
      payment = exactPayment
    } else if (paymentTxHash.length > 66) {
      const legacyHash = paymentTxHash.substring(0, 66)
      const { data: legacyPayment } = await supabaseService
        .from('payments')
        .select('id, status, amount_usdc, user_id, tx_hash, created_at')
        .eq('tx_hash', legacyHash)
        .eq('type', 'PSP_ORDER')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      payment = legacyPayment
    }

    if (!payment) {
      console.error('[PSP ORDER] Payment not found for txHash:', paymentTxHash)
      return NextResponse.json({ error: 'Payment not found. Please complete payment before ordering.' }, { status: 400 })
    }

    if (payment.status !== 'COMPLETED') {
      return NextResponse.json({ error: 'Payment not completed. Please wait for payment confirmation.' }, { status: 400 })
    }

    const walletNorm = normalizeWalletAddress(walletAddress)
    const { data: sameWalletRows } = await supabaseService
      .from('users')
      .select('id, wallet_address')
      .ilike('wallet_address', walletNorm)

    const userIdsForWallet = new Set((sameWalletRows ?? []).map((r) => r.id))
    if (!userIdsForWallet.has(payment.user_id)) {
      const { data: paymentUserRecord } = await supabaseService
        .from('users')
        .select('id, wallet_address')
        .eq('id', payment.user_id)
        .maybeSingle()
      const payWalletNorm = paymentUserRecord?.wallet_address
        ? normalizeWalletAddress(paymentUserRecord.wallet_address)
        : ''
      if (!(payWalletNorm && payWalletNorm === walletNorm)) {
        return NextResponse.json({ error: 'Payment does not belong to this wallet address.' }, { status: 403 })
      }
    }

    const accioAccount = process.env.ACCIO_ACCOUNT
    const accioUsername = process.env.ACCIO_USERNAME
    const accioPassword = process.env.ACCIO_PASSWORD
    const accioApiUrl = process.env.ACCIO_API_URL
    if (!accioAccount || !accioUsername || !accioPassword || !accioApiUrl) {
      return NextResponse.json({ error: 'PSP service configuration error' }, { status: 500 })
    }

    let user: { id: string; email?: string | null }
    try {
      const { user: u } = await getOrCreateUserByWallet(supabaseService, walletAddress)
      user = { id: u.id, email: u.email }
    } catch {
      return NextResponse.json({ error: 'Failed to get or create user account' }, { status: 500 })
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
    const ssn = providedSsn || form1Data.ssn || ''
    const dob = providedDob || form1Data.dateOfBirth || ''
    const gender = providedGender || form1Data.gender || 'U'
    const address = providedAddress || form1Data.address || ''
    const city = providedCity || form1Data.city || ''
    const state = providedState || form1Data.state || ''
    const zip = providedZip || form1Data.zip || ''

    if (!firstName || !lastName || !email || !ssn || !dob || !address || !city || !state || !zip) {
      return NextResponse.json(
        {
          error:
            'Missing required personal information. Provide all fields or complete your DOT application.',
          requiresPersonalInfo: true,
        },
        { status: 400 },
      )
    }

    const orderNumber = generateOrderNumber()
    const webhookGuid = generateWebhookGuid()
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')
    const webhookUrl = `${baseUrl}/api/mvr/webhook`

    const orderXml = buildAccioPspWithMvrBundleOrderXml({
      firstName,
      middleName,
      lastName,
      email,
      phone,
      ssn: ssn.slice(-4),
      dob,
      gender,
      address,
      city,
      state,
      zip,
      jobState: jobState ?? state,
      dlNumber,
      dlState,
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
      dlNumber,
      dlState: dlState.toUpperCase(),
      expiresAtIso: expiresAt,
      paymentId: payment.id,
      paymentTxHash,
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
