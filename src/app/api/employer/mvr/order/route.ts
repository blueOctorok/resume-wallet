import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { companyCanOrderMvr, companyHasScreeningConsentBlock } from '@/lib/employer-company-access'
import { buildAccioMvrOrderXml, generateOrderNumber, generateWebhookGuid } from '@/lib/accio-xml-builder'
import { getScreeningWebhookBaseUrl } from '@/lib/app-url'
import { isValidSsn, normalizeSsnDigits } from '@/lib/ssn'
import { validateScreeningOrderInput, checkRecentDuplicateOrder } from '@/lib/screening-validation'
import { resolveScreeningPayment } from '@/lib/resolve-waived-screening-payment'

/**
 * POST /api/employer/mvr/order
 *
 * Employer-initiated MVR order. Requires:
 *   - Valid employer wallet with company membership
 *   - Driver's signed background check consent (hasBgcheckConsent = true)
 *
 * Optional USDC payment (removed in D3 — waived/internal orders use synthetic payment rows).
 * Unlike the admin route there is no requireAdmin()
 * middleware — any authenticated employer with company access can order.
 *
 * Body:
 *   candidateUserId  string   — the driver's user ID (used to link the order)
 *   dlNumber         string
 *   dlState          string
 *   firstName        string
 *   lastName         string
 *   dob              string   YYYY-MM-DD
 *   ssn              string   full 9-digit SSN (digits only); not persisted
 *   address          string
 *   city             string
 *   state            string
 *   zip              string
 *   middleName?      string
 *   email?           string
 *   phone?           string
 *   gender?          'M' | 'F' | 'U'
 *   jobState?        string   state where job will be performed
 *   mvrSearchType?   'standard' | 'comprehensive'
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const {
      candidateUserId,
      paymentTxHash,
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
      middleName = '',
      email = '',
      phone = '',
      gender = 'U',
      jobState,
      mvrSearchType = 'standard',
    } = body

    // Validate required fields
    const missing = ['candidateUserId','dlNumber','dlState','firstName','lastName','dob','ssn','address','city','state','zip']
      .filter(f => !body[f])
    if (missing.length > 0) {
      return NextResponse.json({ error: 'Missing required fields', missing }, { status: 400 })
    }

    const normalizedSsn = normalizeSsnDigits(String(ssn))
    if (!isValidSsn(normalizedSsn)) {
      return NextResponse.json(
        { error: 'A full 9-digit SSN is required. Last-4 forces Accio onto the slow applicant-portal verification path.' },
        { status: 400 },
      )
    }

    // Strict pre-flight validation — see screening-validation.ts. Catches
    // typos in DL/state/DOB before we spend money calling Accio.
    const validation = validateScreeningOrderInput({
      firstName, lastName, dob, dlState, dlNumber, ssn: normalizedSsn,
    })
    // `=== false` narrows the ValidationResult discriminated union — `!` doesn't.
    if (validation.ok === false) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()

    // Get company (supports both company_members and legacy employer_user_id)
    const { data: membership } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single()

    let companyId = membership?.company_id || null

    if (!companyId) {
      const { data: legacyCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('employer_user_id', userId)
        .single()
      companyId = legacyCompany?.id || null
    }

    if (!companyId) {
      return NextResponse.json({ error: 'No company access' }, { status: 403 })
    }

    if (await companyHasScreeningConsentBlock(supabase, companyId)) {
      return NextResponse.json(
        {
          error:
            'Your company collects screening consent in ZKnight first. After the candidate finishes the three-step package, place MVR orders with POST /api/employer/screenings/order (payment + consent bundle id).',
        },
        { status: 400 },
      )
    }

    if (!(await companyCanOrderMvr(supabase, companyId))) {
      return NextResponse.json(
        {
          error:
            'MVR ordering is not enabled for your company. A company owner or admin must install the MVR ordering block (or contact ZKnight support).',
        },
        { status: 403 },
      )
    }

    // Resolve payment (optional USDC tx hash; waived when omitted — same pattern as screenings/order).
    const paymentResult = await resolveScreeningPayment(supabase, {
      paymentTxHash,
      paymentType: 'MVR_ORDER',
      userId,
      companyId,
      candidateUserId,
    })
    if (!paymentResult.ok) {
      return NextResponse.json({ error: paymentResult.error }, { status: paymentResult.status })
    }
    const payment = { id: paymentResult.paymentId }
    const storedPaymentTxHash = paymentResult.resolvedTxHash ?? paymentTxHash ?? null

    // Verify the candidate exists and has signed the disclosure
    const { data: candidate } = await supabase
      .from('users')
      .select('id, email')
      .eq('id', candidateUserId)
      .single()

    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
    }

    // Check for a signed bgcheck consent from this company for this candidate.
    // The driver must have signed before the employer can run an MVR.
    // Note: the table uses driver_user_id, not candidate_user_id.
    const { data: consent } = await supabase
      .from('bgcheck_consents')
      .select('id')
      .eq('driver_user_id', candidateUserId)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!consent) {
      return NextResponse.json(
        { error: 'Driver has not signed the background check disclosure for this company' },
        { status: 400 }
      )
    }

    // Prevent accidental double-orders for the same driver within 24h.
    const dupErr = await checkRecentDuplicateOrder(supabase, {
      driverUserId: candidateUserId,
      kind: 'mvr',
    })
    if (dupErr) {
      return NextResponse.json({ error: dupErr }, { status: 409 })
    }

    // Resolve driver CDL block for existence check (driver_profile_id is legacy)
    const { data: cdlBlock } = await supabase
      .from('block_driver_cdl')
      .select('id')
      .eq('user_id', candidateUserId)
      .maybeSingle()

    // Check Accio credentials
    const accioAccount  = process.env.ACCIO_ACCOUNT
    const accioUsername = process.env.ACCIO_USERNAME
    const accioPassword = process.env.ACCIO_PASSWORD
    const accioApiUrl   = process.env.ACCIO_API_URL || 'https://service.keybackground.com/c/p/researcherxml'

    if (!accioAccount || !accioUsername || !accioPassword) {
      console.error('[EMPLOYER MVR] Accio credentials not configured')
      return NextResponse.json({ error: 'MVR service not configured' }, { status: 500 })
    }

    const orderNumber  = generateOrderNumber()
    const webhookGuid  = generateWebhookGuid()
    let webhookUrl: string
    try {
      webhookUrl = `${getScreeningWebhookBaseUrl(request)}/api/mvr/webhook`
    } catch (err) {
      console.error('[EMPLOYER MVR] Webhook URL resolution failed:', err)
      return NextResponse.json(
        { error: 'Server is not configured for screening webhooks. Contact support.' },
        { status: 500 },
      )
    }

    // Send full SSN — Accio is FCRA compliant and the state DMV identity match
    // needs all 9 digits. See src/app/api/mvr/order/route.ts for context.
    // Use normalized values from validation (uppercase state/DL, YYYYMMDD DOB).
    const n = validation.normalized
    const orderXml = buildAccioMvrOrderXml({
      firstName: n.firstName,
      middleName,
      lastName: n.lastName,
      email: email || candidate.email || `order-${orderNumber}@zknight.io`,
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
      includeFmcsaCrashInspection: false,
      webhookUrl,
      webhookGuid,
    })

    console.log('[EMPLOYER MVR] Placing order for:', { firstName: n.firstName, lastName: n.lastName, dlState: n.dlState, companyId })

    // Submit to Accio
    let accioResponse: string
    try {
      const raw = await fetch(accioApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml' },
        body: orderXml,
      })
      if (!raw.ok) {
        const text = await raw.text()
        console.error('[EMPLOYER MVR] Accio API error:', raw.status, text)
        throw new Error(`Accio API returned ${raw.status}`)
      }
      accioResponse = await raw.text()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      console.error('[EMPLOYER MVR] Accio error:', msg)
      return NextResponse.json({ error: 'Failed to submit MVR order', details: msg }, { status: 500 })
    }

    // Parse Accio response
    const accioOrderId  = accioResponse.match(/orderID="(\d+)"/)?.[1] ?? null
    const subOrderId    = accioResponse.match(/suborderID="(\d+)"/)?.[1] ?? null
    const portalMatch   =
      accioResponse.match(/<applicantPortalURL><!\[CDATA\[(.*?)\]\]><\/applicantPortalURL>/) ||
      accioResponse.match(/<applicantPortalURL>(.*?)<\/applicantPortalURL>/)
    const applicantPortalUrl = portalMatch?.[1] ?? null

    console.log('[EMPLOYER MVR] Accio response parsed:', { accioOrderId, subOrderId })

    // Store in database — linked to both the candidate user and the ordering company
    const { data: mvrOrder, error: orderError } = await supabase
      .from('mvr_orders')
      .insert({
        driver_user_id:             candidateUserId,
        driver_profile_id:          cdlBlock?.id || null,
        accio_order_number:         orderNumber,
        accio_suborder_number:      subOrderId,
        accio_remote_order_number:  accioOrderId,
        accio_remote_suborder_number: subOrderId,
        order_type:                 'MVR',
        mvr_search_type:            mvrSearchType,
        dl_number:                  n.dlNumber,
        dl_state:                   n.dlState,
        status:                     'pending',
        order_xml:                  orderXml,
        applicant_portal_url:       applicantPortalUrl,
        ordered_by_company_id:      companyId,
        ordered_by_user_id:         userId,
        ordered_by_employer:        true,
        expires_at:                 new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single()

    if (orderError) {
      console.error('[EMPLOYER MVR] DB insert error:', orderError)
      return NextResponse.json({ error: 'Failed to store MVR order' }, { status: 500 })
    }

    console.log('[EMPLOYER MVR] Order created:', mvrOrder.id)

    return NextResponse.json({
      success: true,
      order: {
        id:               mvrOrder.id,
        orderNumber:      mvrOrder.accio_order_number,
        status:           mvrOrder.status,
        applicantPortalUrl: mvrOrder.applicant_portal_url,
      },
    })

  } catch (err) {
    console.error('[EMPLOYER MVR] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
