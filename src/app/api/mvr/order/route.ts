import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { buildAccioMvrOrderXml, generateOrderNumber, generateWebhookGuid } from '@/lib/accio-xml-builder'
import { getOrCreateUserByWallet, getUserByWallet, normalizeWalletAddress } from '@/lib/user-by-wallet'

/**
 * API Route: Order MVR from Accio
 * 
 * POST /api/mvr/order
 * 
 * Body: {
 *   walletAddress: string
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
      walletAddress, 
      paymentTxHash, // Payment transaction hash (required)
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

    // Validate input
    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      )
    }

    if (!dlNumber || !dlState) {
      return NextResponse.json(
        { error: 'Driver license number and state are required' },
        { status: 400 }
      )
    }

    // Validate payment before proceeding
    if (!paymentTxHash) {
      return NextResponse.json(
        { error: 'Payment is required. Please complete payment before ordering.' },
        { status: 400 }
      )
    }

    // Use service role client to bypass RLS for payment lookup and order creation
    const supabaseService = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Verify payment exists and is completed.
    // New payments store the full tx hash; old ones may be truncated to 66 chars.
    // Try exact match first, then fall back to the 66-char prefix for legacy rows.
    let payment = null
    let paymentError = null

    const { data: exactPayment, error: exactError } = await supabaseService
      .from('payments')
      .select('id, status, amount_usdc, user_id, tx_hash, created_at')
      .eq('tx_hash', paymentTxHash)
      .eq('type', 'MVR_ORDER')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (exactPayment) {
      payment = exactPayment
    } else if (paymentTxHash.length > 66) {
      const legacyHash = paymentTxHash.substring(0, 66)
      const { data: legacyPayment, error: legacyError } = await supabaseService
        .from('payments')
        .select('id, status, amount_usdc, user_id, tx_hash, created_at')
        .eq('tx_hash', legacyHash)
        .eq('type', 'MVR_ORDER')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      payment = legacyPayment
      paymentError = legacyError
    } else {
      paymentError = exactError
    }

    if (paymentError) {
      console.error('[MVR ORDER] Payment lookup error:', paymentError)
      return NextResponse.json(
        { error: 'Failed to verify payment. Please try again.' },
        { status: 500 }
      )
    }

    if (!payment) {
      console.error('[MVR ORDER] Payment not found for txHash:', paymentTxHash)
      return NextResponse.json(
        { error: 'Payment not found. Please complete payment before ordering.' },
        { status: 400 }
      )
    }

    console.log('[MVR ORDER] Found payment:', {
      paymentId: payment.id,
      paymentUserId: payment.user_id,
      txHash: payment.tx_hash,
      status: payment.status,
      requestWallet: walletAddress,
    })

    if (payment.status !== 'COMPLETED') {
      console.error('[MVR ORDER] Payment not completed. Status:', payment.status)
      return NextResponse.json(
        { error: 'Payment not completed. Please wait for payment confirmation.' },
        { status: 400 }
      )
    }

    // Verify payment belongs to this wallet (same canonical lookup as payment route + duplicate rows)
    const walletNorm = normalizeWalletAddress(walletAddress)
    let walletUser: { id: string; wallet_address?: string | null }
    try {
      const row = await getUserByWallet(supabaseService, walletAddress)
      if (!row?.id) {
        console.error('[MVR ORDER] No user found for wallet address:', walletAddress)
        return NextResponse.json(
          { error: 'No user account found for this wallet.' },
          { status: 404 }
        )
      }
      walletUser = { id: row.id, wallet_address: row.wallet_address as string | undefined }
    } catch (e) {
      console.error('[MVR ORDER] Error looking up user by wallet:', e)
      return NextResponse.json({ error: 'Failed to verify user.' }, { status: 500 })
    }

    const { data: sameWalletRows, error: sameWalletErr } = await supabaseService
      .from('users')
      .select('id, wallet_address')
      .ilike('wallet_address', walletNorm)

    if (sameWalletErr) {
      console.error('[MVR ORDER] Error listing users for wallet:', sameWalletErr)
      return NextResponse.json({ error: 'Failed to verify user.' }, { status: 500 })
    }

    const userIdsForWallet = new Set((sameWalletRows ?? []).map((r) => r.id))
    const paymentBelongsToWallet = userIdsForWallet.has(payment.user_id)

    if (!paymentBelongsToWallet) {
      const { data: paymentUserRecord } = await supabaseService
        .from('users')
        .select('id, wallet_address')
        .eq('id', payment.user_id)
        .maybeSingle()
      const payWalletNorm = paymentUserRecord?.wallet_address
        ? normalizeWalletAddress(paymentUserRecord.wallet_address)
        : ''
      console.error('[MVR ORDER] Payment user mismatch:', {
        paymentUserId: payment.user_id,
        walletUserId: walletUser.id,
        walletAddress,
        paymentUserWallet: paymentUserRecord?.wallet_address ?? null,
        userIdsForWallet: [...userIdsForWallet],
      })
      if (payWalletNorm && payWalletNorm === walletNorm) {
        console.log('[MVR ORDER] Payment row user_id wallet matches request (Set miss); allowing')
      } else {
        return NextResponse.json(
          { error: 'Payment does not belong to this wallet address.' },
          { status: 403 }
        )
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

    console.log('[MVR ORDER] Starting MVR order for wallet:', walletAddress, 'with payment:', paymentTxHash)

    // 1. Get or create user (single place — avoids duplicate user rows)
    let user: { id: string; email?: string | null }
    try {
      const { user: u } = await getOrCreateUserByWallet(supabaseService, walletAddress)
      user = { id: u.id, email: u.email }
    } catch (err) {
      console.error('[MVR ORDER] Error get/create user:', err)
      return NextResponse.json(
        { error: 'Failed to get or create user account' },
        { status: 500 }
      )
    }

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
    const ssn = providedSsn || form1Data.ssn || '' // Last 4 digits only
    const dob = providedDob || form1Data.dateOfBirth || ''
    const gender = providedGender || form1Data.gender || 'U' // M/F/U
    const address = providedAddress || form1Data.address || ''
    const city = providedCity || form1Data.city || ''
    const state = providedState || form1Data.state || ''
    const zip = providedZip || form1Data.zip || ''

    // Validate required fields
    if (!firstName || !lastName || !email || !ssn || !dob || !address || !city || !state || !zip) {
      const missingFields = {
        firstName: !firstName,
        lastName: !lastName,
        email: !email,
        ssn: !ssn,
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
          error: 'Missing required personal information. Please provide all required fields (name, DOB, SSN, address) either in this form or by completing your DOT application.',
          missingFields,
          requiresPersonalInfo: true
        },
        { status: 400 }
      )
    }

    // 3. Generate order number and webhook GUID
    const orderNumber = generateOrderNumber()
    const webhookGuid = generateWebhookGuid()
    // Remove trailing slash from base URL to avoid double slashes
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')
    const webhookUrl = `${baseUrl}/api/mvr/webhook`

    // 4. Build Accio XML order
    const orderXml = buildAccioMvrOrderXml({
      firstName,
      middleName,
      lastName,
      email,
      phone,
      ssn: ssn.slice(-4), // Only last 4 digits for security
      dob,
      gender,
      address,
      city,
      state,
      zip,
      jobState, // Pass through from request (optional)
      dlNumber,
      dlState,
      orderNumber,
      mvrSearchType,
      includeFmcsaCrashInspection, // Pass through from request
      webhookUrl,
      webhookGuid
    })

    console.log('[MVR ORDER] Built XML order, sending to Accio...')

    // 5. Send order to Accio API
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
      return NextResponse.json(
        { error: 'Failed to submit MVR order to Accio', details: error.message },
        { status: 500 }
      )
    }

    // 6. Parse Accio response to get suborder ID and applicant portal URL
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

    // 7. Store order in database (use service role to bypass RLS)
    // Reuse supabaseService declared earlier in the function
    // Link order to the payment that was used
    const { data: mvrOrder, error: orderError } = await supabaseService
      .from('mvr_orders')
      .insert({
        driver_user_id: user.id,
        driver_profile_id: null,
        driver_application_id: dotApplication?.id || null,
        payment_id: payment.id, // Link to the payment
        payment_tx_hash: paymentTxHash, // Column widened to TEXT in migration 065
        accio_order_number: orderNumber,
        accio_suborder_number: subOrderId,
        accio_remote_order_number: accioOrderId || null, // Accio's internal order number (from orderID in response)
        accio_remote_suborder_number: subOrderId || null, // Accio's internal suborder number (same as suborderID)
        order_type: 'MVR',
        mvr_search_type: mvrSearchType,
        dl_number: dlNumber,
        dl_state: dlState,
        status: 'pending', // Will be updated to 'processing' when Accio accepts it
        order_xml: orderXml,
        applicant_portal_url: applicantPortalUrl,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days from now
      })
      .select()
      .single()

    if (orderError) {
      console.error('[MVR ORDER] Error storing order:', orderError)
      return NextResponse.json(
        { error: 'Failed to store MVR order' },
        { status: 500 }
      )
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

