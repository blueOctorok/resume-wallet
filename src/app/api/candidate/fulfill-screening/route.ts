import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import {
  buildAccioMvrOrderXml,
  buildAccioPspWithMvrBundleOrderXml,
  generateOrderNumber,
  generateWebhookGuid,
  parseAccioPlaceOrderBundleIds,
} from '@/lib/accio-xml-builder'
import { insertPspMvrBundleOrders } from '@/lib/place-psp-mvr-bundle-db'

/**
 * POST /api/candidate/fulfill-screening
 *
 * Candidate-initiated endpoint that places an Accio order AFTER the candidate
 * has signed the employer-requested disclosure form (MVR or PSP).
 *
 * This is used in the "employer outreach via email" flow where the candidate
 * fills ONE combined form (disclosure + personal info) and the order is placed
 * automatically. The employer is billed through the CRA account — no USDC
 * payment step required from either party at this stage.
 *
 * Body:
 *   requestId    string   — candidate_requests.id being fulfilled
 *   type         'mvr' | 'psp'  — `psp` places **MVR + FMCSA PSP** in one Accio order (product bundle).
 *   formData: {
 *     firstName, lastName, middleName?, dob, ssn (last 4),
 *     dlNumber, dlState, address, city, state, zip, email?, phone?
 *   }
 */
export async function POST(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 401 })
    }

    const body = await request.json()
    const { requestId, type, formData } = body

    if (!requestId || !type || !formData) {
      return NextResponse.json({ error: 'requestId, type, and formData are required' }, { status: 400 })
    }

    if (!['mvr', 'psp'].includes(type)) {
      return NextResponse.json({ error: 'type must be mvr or psp' }, { status: 400 })
    }

    const { firstName, lastName, dob, ssn, dlNumber, dlState, address, city, state, zip } = formData
    const missing = ['firstName', 'lastName', 'dob', 'ssn', 'dlNumber', 'dlState', 'address', 'city', 'state', 'zip']
      .filter(f => !formData[f]?.trim())
    if (missing.length > 0) {
      return NextResponse.json({ error: 'Missing required fields', missing }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()

    // Resolve candidate
    const { data: user } = await supabase
      .from('users')
      .select('id, email')
      .ilike('wallet_address', walletAddress)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Verify the candidate_request belongs to this user and is employer-initiated
    const { data: candidateRequest } = await supabase
      .from('candidate_requests')
      .select('id, company_id, requested_by_user_id, candidate_user_id, request_type, status')
      .eq('id', requestId)
      .eq('candidate_user_id', user.id)
      .single()

    if (!candidateRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    // Verify consent was saved (MVR → bgcheck_consents, PSP → both bgcheck_consents AND psp_consents)
    if (type === 'mvr') {
      const { data: consent } = await supabase
        .from('bgcheck_consents')
        .select('id')
        .eq('driver_user_id', user.id)
        .eq('company_id', candidateRequest.company_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!consent) {
        return NextResponse.json({ error: 'Disclosure consent not found — sign the form first' }, { status: 400 })
      }
    } else {
      // PSP requires BOTH the general BG disclosure AND the FMCSA PSP disclosure
      const { data: bgConsent } = await supabase
        .from('bgcheck_consents')
        .select('id')
        .eq('driver_user_id', user.id)
        .eq('company_id', candidateRequest.company_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!bgConsent) {
        return NextResponse.json({ error: 'Background check disclosure not signed — complete Step 1 first' }, { status: 400 })
      }

      const { data: pspConsent } = await supabase
        .from('psp_consents')
        .select('id')
        .eq('driver_user_id', user.id)
        .eq('company_id', candidateRequest.company_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!pspConsent) {
        return NextResponse.json({ error: 'PSP consent not found — sign the FMCSA form first' }, { status: 400 })
      }
    }

    // Check Accio credentials
    const accioAccount = process.env.ACCIO_ACCOUNT
    const accioUsername = process.env.ACCIO_USERNAME
    const accioPassword = process.env.ACCIO_PASSWORD
    const accioApiUrl = process.env.ACCIO_API_URL || 'https://service.keybackground.com/c/p/researcherxml'

    if (!accioAccount || !accioUsername || !accioPassword) {
      console.error('[FULFILL SCREENING] Accio credentials not configured')
      return NextResponse.json({ error: 'Screening service not configured' }, { status: 500 })
    }

    const orderNumber = generateOrderNumber()
    const webhookGuid = generateWebhookGuid()
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')

    const middleName = formData.middleName?.trim() || ''
    const email = formData.email?.trim() || user.email || `order-${orderNumber}@stormchain.ai`
    const phone = formData.phone?.trim() || ''

    let orderXml: string
    let webhookUrl: string

    if (type === 'mvr') {
      webhookUrl = `${baseUrl}/api/mvr/webhook`
      orderXml = buildAccioMvrOrderXml({
        firstName: firstName.trim(),
        middleName,
        lastName: lastName.trim(),
        email,
        phone,
        ssn: ssn.trim().slice(-4),
        dob: dob.trim(),
        gender: 'U',
        address: address.trim(),
        city: city.trim(),
        state: state.trim().toUpperCase(),
        zip: zip.trim(),
        jobState: state.trim().toUpperCase(),
        dlNumber: dlNumber.trim(),
        dlState: dlState.trim().toUpperCase(),
        orderNumber,
        mvrSearchType: 'standard',
        includeFmcsaCrashInspection: false,
        webhookUrl,
        webhookGuid,
      })
    } else {
      // PSP product = MVR + FMCSA in one placeOrder; postbacks hit /api/mvr/webhook (FMCSA routed to PSP).
      webhookUrl = `${baseUrl}/api/mvr/webhook`
      orderXml = buildAccioPspWithMvrBundleOrderXml({
        firstName: firstName.trim(),
        middleName,
        lastName: lastName.trim(),
        email,
        phone,
        ssn: ssn.trim().slice(-4),
        dob: dob.trim(),
        gender: 'U',
        address: address.trim(),
        city: city.trim(),
        state: state.trim().toUpperCase(),
        zip: zip.trim(),
        jobState: state.trim().toUpperCase(),
        dlNumber: dlNumber.trim(),
        dlState: dlState.trim().toUpperCase(),
        orderNumber,
        webhookUrl,
        webhookGuid,
      })
    }

    console.log(`[FULFILL SCREENING] Placing ${type.toUpperCase()} order for:`, {
      firstName,
      lastName,
      dlState,
      companyId: candidateRequest.company_id,
    })

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
        console.error(`[FULFILL SCREENING] Accio API error:`, raw.status, text)
        throw new Error(`Accio API returned ${raw.status}`)
      }
      accioResponse = await raw.text()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      console.error('[FULFILL SCREENING] Accio error:', msg)
      return NextResponse.json({ error: 'Failed to submit screening order', details: msg }, { status: 500 })
    }

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    if (type === 'psp') {
      const bundle = parseAccioPlaceOrderBundleIds(accioResponse)
      console.log(`[FULFILL SCREENING] Accio bundle response:`, bundle)

      const inserted = await insertPspMvrBundleOrders(supabase, {
        driverUserId: user.id,
        orderNumber,
        orderXml,
        accioOrderId: bundle.accioOrderId,
        mvrSuborderId: bundle.mvrSuborderId,
        fmcsaSuborderId: bundle.fmcsaSuborderId,
        applicantPortalUrl: bundle.applicantPortalUrl,
        dlNumber: dlNumber.trim(),
        dlState: dlState.trim().toUpperCase(),
        expiresAtIso: expiresAt,
        orderedByCompanyId: candidateRequest.company_id,
        orderedByUserId: candidateRequest.requested_by_user_id,
        orderedByEmployer: true,
      })

      if ('error' in inserted) {
        return NextResponse.json({ error: 'Failed to store orders', details: inserted.error }, { status: 500 })
      }

      await supabase
        .from('candidate_requests')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', requestId)
        .neq('status', 'completed')

      console.log(`[FULFILL SCREENING] PSP+MVR bundle created:`, inserted)

      return NextResponse.json({
        success: true,
        order: {
          id: inserted.pspOrderId,
          mvrOrderId: inserted.mvrOrderId,
          pspOrderId: inserted.pspOrderId,
          orderNumber,
          status: 'pending',
          type: 'psp',
        },
      })
    }

    const accioOrderId = accioResponse.match(/orderID="(\d+)"/)?.[1] ?? null
    const subOrderId = accioResponse.match(/suborderID="(\d+)"/)?.[1] ?? null
    const portalMatch =
      accioResponse.match(/<applicantPortalURL><!\[CDATA\[(.*?)\]\]><\/applicantPortalURL>/) ||
      accioResponse.match(/<applicantPortalURL>(.*?)<\/applicantPortalURL>/)
    const applicantPortalUrl = portalMatch?.[1] ?? null

    console.log(`[FULFILL SCREENING] Accio response:`, { accioOrderId, subOrderId })

    const sharedRow = {
      driver_user_id: user.id,
      accio_order_number: orderNumber,
      accio_suborder_number: subOrderId,
      accio_remote_order_number: accioOrderId,
      accio_remote_suborder_number: subOrderId,
      dl_number: dlNumber.trim(),
      dl_state: dlState.trim().toUpperCase(),
      status: 'pending',
      order_xml: orderXml,
      ordered_by_company_id: candidateRequest.company_id,
      ordered_by_user_id: candidateRequest.requested_by_user_id,
      ordered_by_employer: true,
      expires_at: expiresAt,
    }

    const orderRow: Record<string, unknown> = {
      ...sharedRow,
      order_type: 'MVR',
      mvr_search_type: 'standard',
      applicant_portal_url: applicantPortalUrl,
    }

    const { data: order, error: orderError } = await supabase.from('mvr_orders').insert(orderRow).select().single()

    if (orderError) {
      console.error(`[FULFILL SCREENING] DB insert error (mvr_orders):`, orderError)
      return NextResponse.json(
        { error: 'Failed to store order', details: orderError.message },
        { status: 500 },
      )
    }

    await supabase
      .from('candidate_requests')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', requestId)
      .neq('status', 'completed')

    console.log(`[FULFILL SCREENING] Order created:`, order.id)

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        orderNumber,
        status: 'pending',
        type: 'mvr',
      },
    })
  } catch (err) {
    console.error('[FULFILL SCREENING] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
