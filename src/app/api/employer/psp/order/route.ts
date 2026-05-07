import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { companyHasEmployerBlock } from '@/lib/employer-company-access'
import { buildAccioPspOrderXml, generateOrderNumber, generateWebhookGuid } from '@/lib/accio-xml-builder'

/**
 * POST /api/employer/psp/order — employer-paid PSP for a candidate (company-scoped, FCRA).
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

    if (!(await companyHasEmployerBlock(supabase, companyId, 'employer-psp-orders'))) {
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
    const webhookUrl = `${baseUrl}/api/psp/webhook`

    const orderXml = buildAccioPspOrderXml({
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

    const accioOrderId = accioResponse.match(/orderID="(\d+)"/)?.[1] ?? null
    const subOrderId =
      accioResponse.match(
        /<subOrder[^>]*type=["']fmcsa_crash_inspection["'][^>]*suborderID=["']([^"']+)["']/i,
      )?.[1] ?? null

    const { data: pspOrder, error: orderError } = await supabase
      .from('psp_orders')
      .insert({
        driver_user_id: candidateUserId,
        payment_id: payment.id,
        payment_tx_hash: paymentTxHash,
        accio_order_number: orderNumber,
        accio_suborder_number: subOrderId,
        accio_remote_order_number: accioOrderId,
        accio_remote_suborder_number: subOrderId,
        dl_number: dlNumber,
        dl_state: dlState,
        status: 'pending',
        order_xml: orderXml,
        ordered_by_company_id: companyId,
        ordered_by_user_id: employer.id,
        ordered_by_employer: true,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single()

    if (orderError) {
      console.error('[EMPLOYER PSP] DB insert:', orderError)
      return NextResponse.json({ error: 'Failed to store PSP order' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      order: { id: pspOrder.id, orderNumber: pspOrder.accio_order_number, status: pspOrder.status },
    })
  } catch (err) {
    console.error('[EMPLOYER PSP] Unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
