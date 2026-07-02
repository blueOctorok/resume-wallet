import { NextRequest, NextResponse } from 'next/server'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { companyCanOrderPsp, companyHasScreeningConsentBlock } from '@/lib/employer-company-access'
import {
  buildAccioPspOrderXml,
  generateOrderNumber,
  generateWebhookGuid,
  parseAccioPlaceOrderBundleIds,
} from '@/lib/accio-xml-builder'
import { insertPspOrderOnly } from '@/lib/place-psp-mvr-bundle-db'
import { ensureHubBlockInstalled } from '@/lib/ensure-hub-blocks-psp-mvr-bundle'
import { getScreeningWebhookBaseUrl } from '@/lib/app-url'
import { isValidSsn, normalizeSsnDigits } from '@/lib/ssn'
import { validateScreeningOrderInput, checkRecentDuplicateOrder } from '@/lib/screening-validation'
import { resolveScreeningPayment } from '@/lib/resolve-waived-screening-payment'

/**
 * POST /api/employer/psp/order — employer-paid FMCSA PSP for a candidate (company-scoped, FCRA).
 */
export async function POST(request: NextRequest) {
  try {
    const employerUserId = await getStormUserIdFromRequest(request)
    if (!employerUserId) {
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
    } = body

    const missing = [
      'candidateUserId',
      'dlNumber',
      'dlState',
      'firstName',
      'lastName',
      'dob',
      'ssn',
      'address',
      'city',
      'state',
      'zip',
    ].filter((f) => !body[f])
    if (missing.length > 0) {
      return NextResponse.json({ error: 'Missing required fields', missing }, { status: 400 })
    }

    // FMCSA PSP needs the full 9-digit SSN to do a direct identity match. Without
    // it, Accio bounces the bundle to the applicant-portal slow path that can take
    // hours instead of minutes — even when MVR comes back fast on the same order.
    const normalizedSsn = normalizeSsnDigits(String(ssn))
    if (!isValidSsn(normalizedSsn)) {
      return NextResponse.json(
        { error: 'A full 9-digit SSN is required for FMCSA PSP (last-4 forces the slow applicant-portal path).' },
        { status: 400 },
      )
    }

    // Strict pre-flight validation. Same rules as the candidate path —
    // catches typos in DL number, state code, DOB before Accio is called.
    const validation = validateScreeningOrderInput({
      firstName, lastName, dob, dlState, dlNumber, ssn: normalizedSsn,
    })
    // `=== false` narrows the ValidationResult discriminated union — `!` doesn't.
    if (validation.ok === false) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()

    const { data: membership } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', employerUserId)
      .eq('is_active', true)
      .single()

    let companyId = membership?.company_id || null
    if (!companyId) {
      const { data: legacyCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('employer_user_id', employerUserId)
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
            'Your company collects screening consent in ZKnight first. After the candidate finishes the three-step package, place PSP orders with POST /api/employer/screenings/order (payment + consent bundle id).',
        },
        { status: 400 },
      )
    }

    if (!(await companyCanOrderPsp(supabase, companyId))) {
      return NextResponse.json(
        {
          error:
            'PSP ordering is not enabled for your company. A company owner or admin must install the PSP ordering block (or contact ZKnight support).',
        },
        { status: 403 },
      )
    }

    const paymentResult = await resolveScreeningPayment(supabase, {
      paymentTxHash,
      paymentType: 'PSP_ORDER',
      userId: employerUserId,
      companyId,
      candidateUserId,
    })
    if (!paymentResult.ok) {
      return NextResponse.json({ error: paymentResult.error }, { status: paymentResult.status })
    }
    const payment = { id: paymentResult.paymentId }
    const storedPaymentTxHash = paymentResult.resolvedTxHash ?? paymentTxHash ?? null

    const { data: candidate } = await supabase.from('users').select('id, email').eq('id', candidateUserId).single()
    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
    }

    const { data: pspConsent } = await supabase
      .from('psp_consents')
      .select('id')
      .eq('driver_user_id', candidateUserId)
      .eq('company_id', companyId)
      .order('signed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!pspConsent) {
      return NextResponse.json(
        { error: 'Driver has not signed the FMCSA PSP Disclosure & Authorization for this company' },
        { status: 400 },
      )
    }

    const dupErr = await checkRecentDuplicateOrder(supabase, {
      driverUserId: candidateUserId,
      kind: 'psp',
    })
    if (dupErr) {
      return NextResponse.json({ error: dupErr }, { status: 409 })
    }

    const accioAccount = process.env.ACCIO_ACCOUNT
    const accioUsername = process.env.ACCIO_USERNAME
    const accioPassword = process.env.ACCIO_PASSWORD
    const accioApiUrl = process.env.ACCIO_API_URL || 'https://service.keybackground.com/c/p/researcherxml'

    if (!accioAccount || !accioUsername || !accioPassword) {
      return NextResponse.json({ error: 'PSP service not configured' }, { status: 500 })
    }

    const orderNumber = generateOrderNumber()
    const webhookGuid = generateWebhookGuid()
    let webhookUrl: string
    try {
      webhookUrl = `${getScreeningWebhookBaseUrl(request)}/api/mvr/webhook`
    } catch (err) {
      console.error('[EMPLOYER PSP] Webhook URL resolution failed:', err)
      return NextResponse.json(
        { error: 'Server is not configured for screening webhooks. Contact support.' },
        { status: 500 },
      )
    }

    // Send full SSN — see comment in src/app/api/mvr/order/route.ts.
    // Use normalized values (uppercase state/DL, YYYYMMDD DOB) from validation.
    const n = validation.normalized
    const orderXml = buildAccioPspOrderXml({
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
      webhookUrl,
      webhookGuid,
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
        console.error('[EMPLOYER PSP] Accio error:', raw.status, text)
        throw new Error(`Accio API returned ${raw.status}`)
      }
      accioResponse = await raw.text()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      return NextResponse.json({ error: 'Failed to submit PSP order', details: msg }, { status: 500 })
    }

    const ids = parseAccioPlaceOrderBundleIds(accioResponse)
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    const inserted = await insertPspOrderOnly(supabase, {
      driverUserId: candidateUserId,
      orderNumber,
      orderXml,
      accioOrderId: ids.accioOrderId,
      fmcsaSuborderId: ids.fmcsaSuborderId,
      applicantPortalUrl: ids.applicantPortalUrl,
      dlNumber: n.dlNumber,
      dlState: n.dlState,
      expiresAtIso: expiresAt,
      orderedByCompanyId: companyId,
      orderedByUserId: employerUserId,
      orderedByEmployer: true,
      paymentId: payment.id,
      paymentTxHash: storedPaymentTxHash,
    })

    if ('error' in inserted) {
      console.error('[EMPLOYER PSP] DB insert:', inserted.error)
      return NextResponse.json({ error: 'Failed to store PSP order' }, { status: 500 })
    }

    await ensureHubBlockInstalled(supabase, candidateUserId, 'driver-psp')

    const { data: pspOrder } = await supabase
      .from('psp_orders')
      .select('id, accio_order_number, status')
      .eq('id', inserted.pspOrderId)
      .single()

    if (!pspOrder) {
      return NextResponse.json({ error: 'Failed to load PSP order after insert' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      order: {
        id: pspOrder.id,
        orderNumber: pspOrder.accio_order_number,
        status: pspOrder.status,
      },
    })
  } catch (err) {
    console.error('[EMPLOYER PSP] Unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
