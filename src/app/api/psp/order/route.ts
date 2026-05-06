import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { buildAccioPspOrderXml, generateOrderNumber, generateWebhookGuid } from '@/lib/accio-xml-builder'
import { getOrCreateUserByWallet, getUserByWallet, normalizeWalletAddress } from '@/lib/user-by-wallet'

/**
 * POST /api/psp/order — candidate self-order FMCSA PSP (Accio fmcsa_crash_inspection).
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
    const webhookUrl = `${baseUrl}/api/psp/webhook`

    const orderXml = buildAccioPspOrderXml({
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
      jobState,
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

    let accioOrderId: string | null = null
    for (const pattern of [
      /<order[^>]*orderID=["']([^"']+)["']/i,
      /<completeOrder[^>]*remote_number=["']([^"']+)["']/i,
      /<completeOrder[^>]*number=["']([^"']+)["']/i,
    ]) {
      const match = accioResponse.match(pattern)
      if (match) {
        accioOrderId = match[1]
        break
      }
    }

    let subOrderId: string | null = null
    for (const pattern of [
      /<subOrder[^>]*type=["']fmcsa_crash_inspection["'][^>]*suborderID=["']([^"']+)["']/i,
      /<subOrder[^>]*suborderID=["']([^"']+)["'][^>]*type=["']fmcsa_crash_inspection["']/i,
    ]) {
      const match = accioResponse.match(pattern)
      if (match) {
        subOrderId = match[1]
        break
      }
    }

    const { data: pspOrder, error: orderError } = await supabaseService
      .from('psp_orders')
      .insert({
        driver_user_id: user.id,
        payment_id: payment.id,
        payment_tx_hash: paymentTxHash,
        accio_order_number: orderNumber,
        accio_suborder_number: subOrderId,
        accio_remote_order_number: accioOrderId,
        accio_remote_suborder_number: subOrderId,
        dl_number: dlNumber,
        dl_state: dlState.toUpperCase(),
        status: 'pending',
        order_xml: orderXml,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single()

    if (orderError) {
      console.error('[PSP ORDER] DB insert:', orderError)
      return NextResponse.json({ error: 'Failed to store PSP order' }, { status: 500 })
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
