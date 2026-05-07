import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { companyCanOrderPsp } from '@/lib/employer-company-access'
import {
  buildAccioPspWithMvrBundleOrderXml,
  generateOrderNumber,
  generateWebhookGuid,
  parseAccioPlaceOrderBundleIds,
} from '@/lib/accio-xml-builder'
import { insertPspMvrBundleOrders } from '@/lib/place-psp-mvr-bundle-db'

/**
 * POST /api/employer/psp/order — employer-paid **PSP + MVR** bundle for a candidate (company-scoped, FCRA).
 */
export async function POST(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 401 })
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
      'paymentTxHash',
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

    const supabase = await getAdminSupabaseClient()

    const { data: employer } = await supabase
      .from('users')
      .select('id')
      .ilike('wallet_address', walletAddress)
      .single()

    if (!employer) {
      return NextResponse.json({ error: 'Employer not found' }, { status: 404 })
    }

    const { data: membership } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', employer.id)
      .eq('is_active', true)
      .single()

    let companyId = membership?.company_id || null
    if (!companyId) {
      const { data: legacyCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('employer_user_id', employer.id)
        .single()
      companyId = legacyCompany?.id || null
    }

    if (!companyId) {
      return NextResponse.json({ error: 'No company access' }, { status: 403 })
    }

    if (!(await companyCanOrderPsp(supabase, companyId))) {
      return NextResponse.json(
        {
          error:
            'PSP ordering is not enabled for your company. A company owner or admin must install the PSP ordering block (or contact Storm support).',
        },
        { status: 403 },
      )
    }

    const truncatedTxHash = paymentTxHash.length > 66 ? paymentTxHash.substring(0, 66) : paymentTxHash
    const { data: payment } = await supabase
      .from('payments')
      .select('id, status, user_id, company_id')
      .eq('tx_hash', truncatedTxHash)
      .eq('type', 'PSP_ORDER')
      .maybeSingle()

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found — complete USDC payment first' }, { status: 402 })
    }
    if (payment.status !== 'COMPLETED') {
      return NextResponse.json({ error: 'Payment not yet confirmed' }, { status: 402 })
    }
    if (payment.company_id && payment.company_id !== companyId) {
      return NextResponse.json({ error: 'This payment is tied to a different company' }, { status: 403 })
    }

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

    const accioAccount = process.env.ACCIO_ACCOUNT
    const accioUsername = process.env.ACCIO_USERNAME
    const accioPassword = process.env.ACCIO_PASSWORD
    const accioApiUrl = process.env.ACCIO_API_URL || 'https://service.keybackground.com/c/p/researcherxml'

    if (!accioAccount || !accioUsername || !accioPassword) {
      return NextResponse.json({ error: 'PSP service not configured' }, { status: 500 })
    }

    const orderNumber = generateOrderNumber()
    const webhookGuid = generateWebhookGuid()
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')
    const webhookUrl = `${baseUrl}/api/mvr/webhook`

    const orderXml = buildAccioPspWithMvrBundleOrderXml({
      firstName,
      middleName,
      lastName,
      email: email || candidate.email || `order-${orderNumber}@stormchain.ai`,
      phone,
      ssn: String(ssn).slice(-4),
      dob,
      gender,
      address,
      city,
      state,
      zip,
      jobState: jobState || state,
      dlNumber,
      dlState,
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

    const bundle = parseAccioPlaceOrderBundleIds(accioResponse)
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    const inserted = await insertPspMvrBundleOrders(supabase, {
      driverUserId: candidateUserId,
      orderNumber,
      orderXml,
      accioOrderId: bundle.accioOrderId,
      mvrSuborderId: bundle.mvrSuborderId,
      fmcsaSuborderId: bundle.fmcsaSuborderId,
      applicantPortalUrl: bundle.applicantPortalUrl,
      dlNumber,
      dlState,
      expiresAtIso: expiresAt,
      orderedByCompanyId: companyId,
      orderedByUserId: employer.id,
      orderedByEmployer: true,
      paymentId: payment.id,
      paymentTxHash,
    })

    if ('error' in inserted) {
      console.error('[EMPLOYER PSP] DB insert:', inserted.error)
      return NextResponse.json({ error: 'Failed to store PSP order' }, { status: 500 })
    }

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
        mvrOrderId: inserted.mvrOrderId,
        orderNumber: pspOrder.accio_order_number,
        status: pspOrder.status,
      },
    })
  } catch (err) {
    console.error('[EMPLOYER PSP] Unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
