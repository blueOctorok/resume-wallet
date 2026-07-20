import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { buildAccioMvrOrderXml, generateOrderNumber, generateWebhookGuid } from '@/lib/accio-xml-builder'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { getScreeningWebhookBaseUrl } from '@/lib/app-url'
import { isValidSsn, normalizeSsnDigits } from '@/lib/ssn'
import { validateScreeningOrderInput, checkRecentDuplicateOrder } from '@/lib/screening-validation'
import { resolveScreeningPayment } from '@/lib/resolve-waived-screening-payment'
import {
  finalizeScreeningOrderReservation,
  releaseScreeningOrderReservation,
  reserveScreeningOrder,
} from '@/lib/screening-order-reservation'

/**
 * API Route: Order MVR from Accio
 * 
 * POST /api/mvr/order
 * 
 * Body: {
 *   sessionUserId: string
 *   dlNumber: string
 *   dlState: string
 *   mvrSearchType?: 'standard' | 'comprehensive'
 *   jobState?: string (2-letter state code where job will be performed)
 *   includeFmcsaCrashInspection?: boolean (include FMCSA crash/inspection report)
 * }
 * 
 * Creates an MVR order with Accio and stores it in mvr_orders table
 */
export async function POST(request: NextRequest) {
  try {
    const { 
      paymentTxHash, // Optional — omitted when USDC billing removed (D3)
      dlNumber, 
      dlState, 
      mvrSearchType = 'standard',
      jobState,
      includeFmcsaCrashInspection = false,
      // Personal info (optional - will use DOT app if not provided)
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
    } = await request.json()

    const sessionUserId = await getStormUserIdFromRequest(request)
    if (!sessionUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    if (!dlNumber || !dlState) {
      return NextResponse.json(
        { error: 'Driver license number and state are required' },
        { status: 400 }
      )
    }

    const supabaseService = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: userRow, error: userRowError } = await supabaseService
      .from('users')
      .select('id, email')
      .eq('id', sessionUserId)
      .single()

    if (userRowError || !userRow) {
      console.error('[MVR ORDER] User not found:', userRowError)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const user = { id: userRow.id, email: userRow.email }

    const paymentResult = await resolveScreeningPayment(supabaseService, {
      paymentTxHash,
      paymentType: 'MVR_ORDER',
      userId: user.id,
    })
    if (!paymentResult.ok) {
      return NextResponse.json({ error: paymentResult.error }, { status: paymentResult.status })
    }

    const payment = { id: paymentResult.paymentId }
    const storedPaymentTxHash = paymentResult.resolvedTxHash ?? paymentTxHash ?? null

    if (paymentTxHash) {
      const walletNorm = normalizeWalletAddress(sessionUserId)
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
          return NextResponse.json(
            { error: 'Payment does not belong to this wallet address.' },
            { status: 403 }
          )
        }
      }
    }

    // Validate Accio credentials
    const accioAccount = process.env.ACCIO_ACCOUNT
    const accioUsername = process.env.ACCIO_USERNAME
    const accioPassword = process.env.ACCIO_PASSWORD
    const accioApiUrl = process.env.ACCIO_API_URL

    if (!accioAccount || !accioUsername || !accioPassword || !accioApiUrl) {
      console.error('[MVR ORDER] Missing Accio credentials in environment')
      return NextResponse.json(
        { error: 'MVR service configuration error' },
        { status: 500 }
      )
    }

    console.log('[MVR ORDER] Starting MVR order for wallet:', sessionUserId, 'payment:', storedPaymentTxHash ?? 'waived')

    // Resolve name from user_profiles for fallback personal info
    const { data: userProfile } = await supabaseService
      .from('user_profiles')
      .select('first_name, last_name')
      .eq('user_id', user.id)
      .maybeSingle()

    // 2. Get driver application data for personal info
    const { data: dotApplication } = await supabaseService
      .from('driver_applications')
      .select('application_data')
      .eq('user_id', user.id)
      .eq('is_complete', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Extract personal info: Use provided values first, then DOT app, then user defaults
    const appData = dotApplication?.application_data || {}
    const form1Data = appData.form1Data || {}
    
    const firstName = providedFirstName || form1Data.firstName || userProfile?.first_name || ''
    const lastName = providedLastName || form1Data.lastName || userProfile?.last_name || ''
    const middleName = providedMiddleName || form1Data.middleName || ''
    const email = providedEmail || user.email || ''
    const phone = providedPhone || form1Data.phone || ''
    // Full 9-digit SSN; the DOT app stores it as `XXX-XX-XXXX` while the screening forms
    // send digits-only — strip dashes either way so what reaches Accio is consistent.
    const ssn = normalizeSsnDigits(providedSsn || form1Data.ssn || '')
    const dob = providedDob || form1Data.dateOfBirth || ''
    const gender = providedGender || form1Data.gender || 'U' // M/F/U
    const address = providedAddress || form1Data.address || ''
    const city = providedCity || form1Data.city || ''
    const state = providedState || form1Data.state || ''
    const zip = providedZip || form1Data.zip || ''

    // Validate required fields
    if (!firstName || !lastName || !email || !isValidSsn(ssn) || !dob || !address || !city || !state || !zip) {
      const missingFields = {
        firstName: !firstName,
        lastName: !lastName,
        email: !email,
        ssn: !isValidSsn(ssn),
        dob: !dob,
        address: !address,
        city: !city,
        state: !state,
        zip: !zip
      }
      
      // Check if DOT application exists but is incomplete
      const hasIncompleteApp = dotApplication && !dotApplication.is_complete
      
      return NextResponse.json(
        { 
          error: 'Missing required personal information. A full 9-digit SSN is required (Accio uses it to do a direct identity match — last-4 routes the order to the slow applicant-portal path).',
          missingFields,
          requiresPersonalInfo: true,
          hasIncompleteApp,
        },
        { status: 400 }
      )
    }

    // Strict pre-flight validation — formats Accio expects + bad-data tripwires.
    // Anything that fails here means we DON'T spend money calling Accio just to
    // learn 30+ minutes later that the data was wrong.
    const validation = validateScreeningOrderInput({
      firstName, lastName, dob, dlState, dlNumber, ssn,
    })
    // Use `=== false` instead of `!validation.ok` so TypeScript narrows
    // the discriminated union correctly inside the branch.
    if (validation.ok === false) {
      return NextResponse.json(
        { error: validation.error, requiresPersonalInfo: true },
        { status: 400 },
      )
    }

    // Prevent accidental double-orders (and double-charges) — most often a
    // user clicking the place-order button twice while waiting for confirmation.
    const dupErr = await checkRecentDuplicateOrder(supabaseService, {
      driverUserId: user.id,
      kind: 'mvr',
    })
    if (dupErr) {
      return NextResponse.json({ error: dupErr }, { status: 409 })
    }

    // 3. Generate order number + webhook GUID. getScreeningWebhookBaseUrl
    // hard-fails in production if no real public URL is configured, so we never
    // accidentally tell Accio to post results to localhost.
    const orderNumber = generateOrderNumber()
    const webhookGuid = generateWebhookGuid()
    let webhookUrl: string
    try {
      webhookUrl = `${getScreeningWebhookBaseUrl(request)}/api/mvr/webhook`
    } catch (err) {
      console.error('[MVR ORDER] Webhook URL resolution failed:', err)
      return NextResponse.json(
        { error: 'Server is not configured for screening webhooks. Contact support.' },
        { status: 500 },
      )
    }

    // 4. Build Accio XML order. Send the FULL 9-digit SSN — Accio is FCRA
    // compliant and the state DMV identity match needs the full number. Sending
    // last-4 was forcing Accio to re-collect identity via the applicant portal,
    // which is one of the things that made orders take hours instead of minutes.
    // Use the normalized values (uppercase state/DL, YYYYMMDD DOB) from validation.
    const n = validation.normalized
    const orderXml = buildAccioMvrOrderXml({
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
      jobState,
      dlNumber: n.dlNumber,
      dlState: n.dlState,
      orderNumber,
      mvrSearchType,
      includeFmcsaCrashInspection,
      webhookUrl,
      webhookGuid
    })

    // 5. Reserve the order row BEFORE calling Accio — the partial unique index
    // (migration 102) makes this the atomic duplicate lock, so a concurrent or
    // repeat order fails here with 409 instead of costing another pull.
    const expiresAtIso = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    const reservation = await reserveScreeningOrder(supabaseService, {
      kind: 'mvr',
      driverUserId: user.id,
      orderNumber,
      orderXml,
      dlNumber: n.dlNumber,
      dlState: n.dlState,
      expiresAtIso,
      paymentId: payment.id,
      paymentTxHash: storedPaymentTxHash,
      mvrSearchType,
    })
    if (reservation.ok === false) {
      if (reservation.reason === 'duplicate') {
        return NextResponse.json({ error: reservation.message }, { status: 409 })
      }
      return NextResponse.json({ error: 'Failed to store MVR order' }, { status: 500 })
    }

    console.log('[MVR ORDER] Built XML order, sending to Accio...')

    // 6. Send order to Accio API
    let accioResponse
    try {
      const accioResponseRaw = await fetch(accioApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml',
        },
        body: orderXml
      })

      if (!accioResponseRaw.ok) {
        const errorText = await accioResponseRaw.text()
        console.error('[MVR ORDER] Accio API error:', accioResponseRaw.status, errorText)
        throw new Error(`Accio API returned ${accioResponseRaw.status}: ${errorText}`)
      }

      accioResponse = await accioResponseRaw.text()
      console.log('[MVR ORDER] Accio API response received')
      console.log('[MVR ORDER] Accio response (first 500 chars):', accioResponse.substring(0, 500))
    } catch (error: any) {
      console.error('[MVR ORDER] Error calling Accio API:', error)
      await releaseScreeningOrderReservation(supabaseService, 'mvr', reservation.orderId)
      return NextResponse.json(
        { error: 'Failed to submit MVR order to Accio', details: error.message },
        { status: 500 }
      )
    }

    // 7. Parse Accio response to get suborder ID and applicant portal URL
    // Response format (from Accio docs):
    // <?xml version="1.0" encoding="UTF-8"?>
    // <XML>
    //   <order orderID="53027" number="123987">
    //     <subOrder type="MVR" suborderID="889798"/>
    //     <subOrder type="fmcsa_crash_inspection" suborderID="889799"/>
    //     <applicantPortalURL>https://service.keybackground.com/c/p/collect_information?guikey=...</applicantPortalURL>
    //   </order>
    // </XML>
    
    // Extract Accio's orderID (their internal order number - becomes remote_number in webhook)
    // Also try to extract from completeOrder if present
    let accioOrderId = null
    const orderIdPatterns = [
      /<order[^>]*orderID=["']([^"']+)["']/i,
      /<order[^>]*orderID=["']([^"']+)[\"']/i,
      /<completeOrder[^>]*remote_number=["']([^"']+)["']/i,
      /<completeOrder[^>]*number=["']([^"']+)["']/i,
    ]
    
    for (const pattern of orderIdPatterns) {
      const match = accioResponse.match(pattern)
      if (match) {
        accioOrderId = match[1]
        break
      }
    }
    
    if (!accioOrderId) {
      console.warn('[MVR ORDER] Could not extract accioOrderId from response. This may cause webhook matching issues.')
    }

    // Try multiple patterns to find subOrder ID
    let subOrderId = null
    const patterns = [
      /<subOrder[^>]*type=["']MVR["'][^>]*suborderID=["']([^"']+)["']/i,
      /<subOrder[^>]*suborderID=["']([^"']+)["'][^>]*type=["']MVR["']/i,
      /<subOrder[^>]*type=["']MVR["'][^>]*suborderID=["']([^"']+)["']/i,
    ]
    
    for (const pattern of patterns) {
      const match = accioResponse.match(pattern)
      if (match) {
        subOrderId = match[1]
        break
      }
    }
    
    // Try multiple patterns for portal URL
    let applicantPortalUrl = null
    const portalPatterns = [
      /<applicantPortalURL>([^<]+)<\/applicantPortalURL>/i,
      /<applicantPortalURL[^>]*>([^<]+)<\/applicantPortalURL>/i,
      /applicantPortalURL[^>]*>([^<]+)</i,
    ]
    
    for (const pattern of portalPatterns) {
      const match = accioResponse.match(pattern)
      if (match) {
        applicantPortalUrl = match[1]
        break
      }
    }
    
    console.log('[MVR ORDER] Parsed response - accioOrderId:', accioOrderId, 'subOrderId:', subOrderId, 'portalUrl:', applicantPortalUrl)
    
    // Log full response if parsing failed (for debugging)
    if (!subOrderId && !applicantPortalUrl) {
      console.warn('[MVR ORDER] Could not parse Accio response. Full response:', accioResponse)
    }

    // 8. Attach Accio's IDs to the reserved row (status stays pending —
    // webhooks/reconcile move it forward)
    await finalizeScreeningOrderReservation(supabaseService, 'mvr', reservation.orderId, {
      accio_suborder_number: subOrderId,
      accio_remote_order_number: accioOrderId || null,
      accio_remote_suborder_number: subOrderId || null,
      applicant_portal_url: applicantPortalUrl,
    })

    const { data: mvrOrder } = await supabaseService
      .from('mvr_orders')
      .select('id, accio_order_number, accio_suborder_number, status, ordered_at, applicant_portal_url')
      .eq('id', reservation.orderId)
      .single()

    if (!mvrOrder) {
      return NextResponse.json({ error: 'Failed to load MVR order after insert' }, { status: 500 })
    }

    console.log('[MVR ORDER] Order created successfully:', mvrOrder.id)

    return NextResponse.json({
      success: true,
      order: {
        id: mvrOrder.id,
        orderNumber: mvrOrder.accio_order_number,
        subOrderNumber: mvrOrder.accio_suborder_number,
        status: mvrOrder.status,
        orderedAt: mvrOrder.ordered_at,
        applicantPortalUrl: mvrOrder.applicant_portal_url
      }
    })

  } catch (error: any) {
    console.error('[MVR ORDER] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

