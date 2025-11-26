import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { buildAccioMvrOrderXml, generateOrderNumber, generateWebhookGuid } from '@/lib/accio-xml-builder'

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
 * }
 * 
 * Creates an MVR order with Accio and stores it in mvr_orders table
 */
export async function POST(request: NextRequest) {
  try {
    const { walletAddress, dlNumber, dlState, mvrSearchType = 'standard' } = await request.json()

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

    console.log('[MVR ORDER] Starting MVR order for wallet:', walletAddress)

    const supabase = await createClient()

    // 1. Get user and driver profile
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, name')
      .ilike('wallet_address', walletAddress)
      .single()

    if (userError || !user) {
      console.error('[MVR ORDER] User not found:', walletAddress)
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Get or create driver profile
    let { data: profile, error: profileError } = await supabase
      .from('driver_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (profileError && profileError.code === 'PGRST116') {
      // Create profile if it doesn't exist
      const { data: newProfile, error: createError } = await supabase
        .from('driver_profiles')
        .insert({
          user_id: user.id,
          profile_completion_score: 0
        })
        .select()
        .single()

      if (createError) {
        console.error('[MVR ORDER] Error creating profile:', createError)
        return NextResponse.json(
          { error: 'Failed to create driver profile' },
          { status: 500 }
        )
      }
      profile = newProfile
    } else if (profileError) {
      console.error('[MVR ORDER] Error fetching profile:', profileError)
      return NextResponse.json(
        { error: 'Failed to fetch driver profile' },
        { status: 500 }
      )
    }

    // 2. Get driver application data for personal info
    const { data: dotApplication } = await supabase
      .from('driver_applications')
      .select('application_data')
      .eq('user_id', user.id)
      .eq('is_complete', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Extract personal info from DOT application or use defaults
    const appData = dotApplication?.application_data || {}
    const form1Data = appData.form1Data || {}
    
    const firstName = form1Data.firstName || user.name?.split(' ')[0] || ''
    const lastName = form1Data.lastName || user.name?.split(' ').slice(1).join(' ') || ''
    const middleName = form1Data.middleName || ''
    const email = user.email || ''
    const phone = form1Data.phone || ''
    const ssn = form1Data.ssn || '' // Last 4 digits only
    const dob = form1Data.dateOfBirth || ''
    const address = form1Data.address || ''
    const city = form1Data.city || ''
    const state = form1Data.state || ''
    const zip = form1Data.zip || ''

    // Validate required fields
    if (!firstName || !lastName || !email || !ssn || !dob || !address || !city || !state || !zip) {
      return NextResponse.json(
        { 
          error: 'Missing required information. Please complete your DOT application first.',
          missingFields: {
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
        },
        { status: 400 }
      )
    }

    // 3. Generate order number and webhook GUID
    const orderNumber = generateOrderNumber()
    const webhookGuid = generateWebhookGuid()
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/mvr/webhook`

    // 4. Build Accio XML order
    const orderXml = buildAccioMvrOrderXml({
      firstName,
      middleName,
      lastName,
      email,
      phone,
      ssn: ssn.slice(-4), // Only last 4 digits for security
      dob,
      address,
      city,
      state,
      zip,
      dlNumber,
      dlState,
      orderNumber,
      mvrSearchType,
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
          'Content-Type': 'application/xml',
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
    } catch (error: any) {
      console.error('[MVR ORDER] Error calling Accio API:', error)
      return NextResponse.json(
        { error: 'Failed to submit MVR order to Accio', details: error.message },
        { status: 500 }
      )
    }

    // 6. Parse Accio response to get suborder number
    // Accio typically returns order confirmation with suborder number
    const subOrderMatch = accioResponse.match(/<subOrder[^>]*number="([^"]+)"/i)
    const subOrderNumber = subOrderMatch ? subOrderMatch[1] : null

    // 7. Store order in database
    const { data: mvrOrder, error: orderError } = await supabase
      .from('mvr_orders')
      .insert({
        driver_user_id: user.id,
        driver_profile_id: profile.id,
        driver_application_id: dotApplication?.id || null,
        accio_order_number: orderNumber,
        accio_suborder_number: subOrderNumber,
        order_type: 'MVR',
        mvr_search_type: mvrSearchType,
        dl_number: dlNumber,
        dl_state: dlState,
        status: 'pending',
        order_xml: orderXml,
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
        orderedAt: mvrOrder.ordered_at
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

