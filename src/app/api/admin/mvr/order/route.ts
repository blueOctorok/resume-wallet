import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'
import { buildAccioMvrOrderXml, generateOrderNumber, generateWebhookGuid } from '@/lib/accio-xml-builder'
import { getScreeningWebhookBaseUrl } from '@/lib/app-url'
import { isValidSsn, normalizeSsnDigits } from '@/lib/ssn'
import { validateScreeningOrderInput, checkRecentDuplicateOrder } from '@/lib/screening-validation'

/**
 * POST /api/admin/mvr/order
 * Admin/back-office MVR order with manual data entry
 * 
 * This route allows admins to place MVR orders by manually entering
 * candidate information (typically from a signed authorization form).
 * 
 * Key differences from regular MVR order:
 * - No payment validation (company billing handled separately)
 * - All personal info provided in request (no DOT app lookup)
 * - Optional: link to existing candidate in system
 * - Tracks ordering company for billing/reporting
 * 
 * Body: {
 *   // Required - License info
 *   dlNumber: string
 *   dlState: string
 *   
 *   // Required - Personal info from authorization form
 *   firstName: string
 *   lastName: string
 *   dob: string (YYYY-MM-DD)
 *   ssn: string (full 9-digit SSN, digits only — not persisted)
 *   address: string
 *   city: string
 *   state: string
 *   zip: string
 *   
 *   // Optional
 *   middleName?: string
 *   email?: string
 *   phone?: string
 *   gender?: 'M' | 'F' | 'U'
 *   
 *   // Optional - For tracking/linking
 *   candidateEmail?: string (to link to existing user)
 *   companyId?: string (ordering company for billing)
 *   jobState?: string (state where job will be performed)
 *   mvrSearchType?: 'standard' | 'comprehensive'
 *   includeFmcsaCrashInspection?: boolean
 *   notes?: string (internal notes about this order)
 * }
 */
export async function POST(request: NextRequest) {
  const auth = requireAdmin(request)
  if (!auth.authorized) return auth.error!

  try {
    const body = await request.json()
    const {
      // Required
      dlNumber,
      dlState,
      firstName,
      lastName,
      dob,
      ssn,
      address,
      city,
      state,
      zip,
      // Optional personal
      middleName = '',
      email = '',
      phone = '',
      gender = 'U',
      // Optional tracking
      candidateEmail,
      companyId,
      jobState,
      mvrSearchType = 'standard',
      includeFmcsaCrashInspection = false,
      notes,
    } = body

    // Validate required fields
    const missingFields: string[] = []
    if (!dlNumber) missingFields.push('dlNumber')
    if (!dlState) missingFields.push('dlState')
    if (!firstName) missingFields.push('firstName')
    if (!lastName) missingFields.push('lastName')
    if (!dob) missingFields.push('dob')
    if (!ssn) missingFields.push('ssn')
    if (!address) missingFields.push('address')
    if (!city) missingFields.push('city')
    if (!state) missingFields.push('state')
    if (!zip) missingFields.push('zip')

    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: 'Missing required fields', missingFields },
        { status: 400 }
      )
    }

    const normalizedSsn = normalizeSsnDigits(String(ssn))
    if (!isValidSsn(normalizedSsn)) {
      return NextResponse.json(
        { error: 'A full 9-digit SSN is required (last-4 forces Accio onto the slow applicant-portal verification path).' },
        { status: 400 },
      )
    }

    // Strict pre-flight validation. Even admins typo — and a bad order
    // costs the same as a good one but takes 30+ minutes to fail.
    const validation = validateScreeningOrderInput({
      firstName, lastName, dob, dlState, dlNumber, ssn: normalizedSsn,
    })
    // `=== false` narrows the ValidationResult discriminated union — `!` doesn't.
    if (validation.ok === false) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    // Get Accio credentials
    const accioAccount = process.env.ACCIO_ACCOUNT
    const accioUsername = process.env.ACCIO_USERNAME
    const accioPassword = process.env.ACCIO_PASSWORD
    const accioMode = process.env.ACCIO_MODE || 'TEST'
    const accioApiUrl = process.env.ACCIO_API_URL || 'https://service.keybackground.com/c/p/researcherxml'

    if (!accioAccount || !accioUsername || !accioPassword) {
      console.error('[ADMIN MVR] Accio credentials not configured')
      return NextResponse.json(
        { error: 'MVR service not configured' },
        { status: 500 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    // Try to find existing user by candidate email (if provided)
    let candidateUserId: string | null = null
    let candidateProfileId: string | null = null
    
    if (candidateEmail) {
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .ilike('email', candidateEmail)
        .single()
      
      if (existingUser) {
        candidateUserId = existingUser.id
        
        // Check for CDL block data as a proxy for driver profile existence
        const { data: cdlBlock } = await supabase
          .from('block_driver_cdl')
          .select('id')
          .eq('user_id', existingUser.id)
          .maybeSingle()
        
        candidateProfileId = cdlBlock?.id || null
      }
    }

    // Duplicate-prevention only applies when we know the candidate. Admin can
    // also place orders for unlinked candidates (where candidateUserId is null).
    if (candidateUserId) {
      const dupErr = await checkRecentDuplicateOrder(supabase, {
        driverUserId: candidateUserId,
        kind: 'mvr',
      })
      if (dupErr) {
        return NextResponse.json({ error: dupErr }, { status: 409 })
      }
    }

    // Validate company if provided
    let orderingCompanyName: string | null = null
    if (companyId) {
      const { data: company } = await supabase
        .from('companies')
        .select('company_name')
        .eq('id', companyId)
        .single()

      if (!company) {
        return NextResponse.json(
          { error: 'Company not found' },
          { status: 404 }
        )
      }
      orderingCompanyName = company.company_name
    }

    // Generate order identifiers
    const orderNumber = generateOrderNumber()
    const webhookGuid = generateWebhookGuid()
    let webhookUrl: string
    try {
      webhookUrl = `${getScreeningWebhookBaseUrl(request)}/api/mvr/webhook`
    } catch (err) {
      console.error('[ADMIN MVR] Webhook URL resolution failed:', err)
      return NextResponse.json(
        { error: 'Server is not configured for screening webhooks. Contact support.' },
        { status: 500 },
      )
    }

    // Build Accio XML order. Send full SSN — see comment in mvr/order/route.ts.
    // Use normalized values from validation (uppercase state/DL, YYYYMMDD DOB).
    const n = validation.normalized
    const orderXml = buildAccioMvrOrderXml({
      firstName: n.firstName,
      middleName,
      lastName: n.lastName,
      email: email || `admin-order-${orderNumber}@stormchain.ai`,
      phone,
      ssn: n.ssn,
      dob: n.dob,
      gender,
      address,
      city,
      state,
      zip,
      jobState: jobState || state,
      dlNumber: n.dlNumber,
      dlState: n.dlState,
      orderNumber,
      mvrSearchType,
      includeFmcsaCrashInspection,
      webhookUrl,
      webhookGuid,
    })

    console.log('[ADMIN MVR] Placing order for:', { firstName: n.firstName, lastName: n.lastName, dlState: n.dlState, orderedBy: auth.walletAddress })

    // Send order to Accio
    let accioResponse: string
    try {
      const accioResponseRaw = await fetch(accioApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml' },
        body: orderXml,
      })

      if (!accioResponseRaw.ok) {
        const errorText = await accioResponseRaw.text()
        console.error('[ADMIN MVR] Accio API error:', accioResponseRaw.status, errorText)
        throw new Error(`Accio API returned ${accioResponseRaw.status}`)
      }

      accioResponse = await accioResponseRaw.text()
      console.log('[ADMIN MVR] Accio response received')
    } catch (error: any) {
      console.error('[ADMIN MVR] Error calling Accio:', error)
      return NextResponse.json(
        { error: 'Failed to submit MVR order to Accio', details: error.message },
        { status: 500 }
      )
    }

    // Parse Accio response
    let accioOrderId: string | null = null
    let subOrderId: string | null = null
    let applicantPortalUrl: string | null = null

    // Extract order ID
    const orderIdMatch = accioResponse.match(/orderID="(\d+)"/)
    if (orderIdMatch) accioOrderId = orderIdMatch[1]

    // Extract suborder ID
    const subOrderMatch = accioResponse.match(/suborderID="(\d+)"/)
    if (subOrderMatch) subOrderId = subOrderMatch[1]

    // Extract applicant portal URL
    const portalPatterns = [
      /<applicantPortalURL>(.*?)<\/applicantPortalURL>/,
      /<applicantPortalURL><!\[CDATA\[(.*?)\]\]><\/applicantPortalURL>/,
    ]
    for (const pattern of portalPatterns) {
      const match = accioResponse.match(pattern)
      if (match) {
        applicantPortalUrl = match[1]
        break
      }
    }

    console.log('[ADMIN MVR] Parsed response:', { accioOrderId, subOrderId, applicantPortalUrl })

    // Store order in database
    const { data: mvrOrder, error: orderError } = await supabase
      .from('mvr_orders')
      .insert({
        // Link to candidate if found
        driver_user_id: candidateUserId,
        driver_profile_id: candidateProfileId,
        // Accio identifiers
        accio_order_number: orderNumber,
        accio_suborder_number: subOrderId,
        accio_remote_order_number: accioOrderId,
        accio_remote_suborder_number: subOrderId,
        // Order details
        order_type: 'MVR',
        mvr_search_type: mvrSearchType,
        dl_number: n.dlNumber,
        dl_state: n.dlState,
        status: 'pending',
        order_xml: orderXml,
        applicant_portal_url: applicantPortalUrl,
        // Company tracking
        ordered_by_company_id: companyId || null,
        ordered_by_user_id: null, // Admin doesn't have user ID in this context
        ordered_by_employer: true, // Mark as employer/admin ordered
        // Admin tracking (store in metadata or notes field if available)
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single()

    if (orderError) {
      console.error('[ADMIN MVR] Error storing order:', orderError)
      return NextResponse.json(
        { error: 'Failed to store MVR order' },
        { status: 500 }
      )
    }

    console.log('[ADMIN MVR] Order created:', mvrOrder.id)

    return NextResponse.json({
      success: true,
      order: {
        id: mvrOrder.id,
        orderNumber: mvrOrder.accio_order_number,
        subOrderNumber: mvrOrder.accio_suborder_number,
        status: mvrOrder.status,
        orderedAt: mvrOrder.ordered_at,
        applicantPortalUrl: mvrOrder.applicant_portal_url,
        candidateLinked: !!candidateUserId,
        companyName: orderingCompanyName,
      },
      message: candidateUserId 
        ? 'MVR ordered and linked to existing candidate'
        : 'MVR ordered. Candidate not in system - results will be standalone.',
    })

  } catch (error: any) {
    console.error('[ADMIN MVR] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/mvr/order
 * List all admin-placed MVR orders
 */
export async function GET(request: NextRequest) {
  const auth = requireAdmin(request)
  if (!auth.authorized) return auth.error!

  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const status = searchParams.get('status')

    const supabase = await getAdminSupabaseClient()

    let query = supabase
      .from('mvr_orders')
      .select(`
        id, accio_order_number, accio_suborder_number, status,
        dl_number, dl_state, mvr_search_type,
        ordered_at, expires_at, applicant_portal_url,
        driver_user_id, ordered_by_company_id,
        companies(company_name),
        users(email)
      `)
      .eq('ordered_by_employer', true) // Only admin/employer orders
      .order('ordered_at', { ascending: false })
      .limit(limit)

    if (status) {
      query = query.eq('status', status)
    }

    const { data: orders, error } = await query

    if (error) {
      console.error('[ADMIN MVR LIST] Error:', error)
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
    }

    return NextResponse.json({
      orders: (orders || []).map(order => ({
        id: order.id,
        orderNumber: order.accio_order_number,
        subOrderNumber: order.accio_suborder_number,
        status: order.status,
        dlNumber: order.dl_number,
        dlState: order.dl_state,
        searchType: order.mvr_search_type,
        orderedAt: order.ordered_at,
        expiresAt: order.expires_at,
        applicantPortalUrl: order.applicant_portal_url,
        candidateName: (order.users as any)?.email || null,
        companyName: (order.companies as any)?.company_name || null,
      })),
    })

  } catch (error) {
    console.error('[ADMIN MVR LIST] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
