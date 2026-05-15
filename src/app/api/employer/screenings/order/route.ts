import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import {
  getEmployerCompanyAccess,
  companyCanOrderMvr,
  companyCanOrderPsp,
  companyHasScreeningConsentBlock,
} from '@/lib/employer-company-access'
import { getLatestScreeningConsentBundle } from '@/lib/screening-consent-bundle'
import { decryptScreeningSsn } from '@/lib/screening-consent-crypto'
import { placeScreeningOrder } from '@/lib/place-screening-order'

/**
 * POST /api/employer/screenings/order
 *
 * After USDC payment, places MVR or PSP using the candidate's latest complete
 * screening consent bundle (decrypts SSN server-side only on this path).
 */
export async function POST(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 401 })
    }

    const body = await request.json() as {
      candidateUserId?: string
      type?: 'mvr' | 'psp'
      consentBundleId?: string
      paymentTxHash?: string
    }
    const { candidateUserId, type, consentBundleId, paymentTxHash } = body
    if (!candidateUserId || !type || !consentBundleId || !paymentTxHash) {
      return NextResponse.json(
        { error: 'candidateUserId, type, consentBundleId, and paymentTxHash are required' },
        { status: 400 },
      )
    }
    if (!['mvr', 'psp'].includes(type)) {
      return NextResponse.json({ error: 'type must be mvr or psp' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()
    const access = await getEmployerCompanyAccess(supabase, walletAddress)
    if (!access) {
      return NextResponse.json({ error: 'No company access' }, { status: 403 })
    }

    if (!(await companyHasScreeningConsentBlock(supabase, access.companyId))) {
      return NextResponse.json(
        { error: 'Screening consent collection is not enabled for your company' },
        { status: 403 },
      )
    }

    if (type === 'mvr' && !(await companyCanOrderMvr(supabase, access.companyId))) {
      return NextResponse.json({ error: 'Company does not have MVR ordering enabled' }, { status: 403 })
    }
    if (type === 'psp' && !(await companyCanOrderPsp(supabase, access.companyId))) {
      return NextResponse.json({ error: 'Company does not have PSP ordering enabled' }, { status: 403 })
    }

    const truncatedTxHash = paymentTxHash.length > 66 ? paymentTxHash.substring(0, 66) : paymentTxHash
    const paymentType = type === 'mvr' ? 'MVR_ORDER' : 'PSP_ORDER'
    const { data: payment } = await supabase
      .from('payments')
      .select('id, status, company_id')
      .eq('tx_hash', truncatedTxHash)
      .eq('type', paymentType)
      .maybeSingle()

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found — complete USDC payment first' }, { status: 402 })
    }
    if (payment.status !== 'COMPLETED') {
      return NextResponse.json({ error: 'Payment not yet confirmed' }, { status: 402 })
    }
    if (payment.company_id && payment.company_id !== access.companyId) {
      return NextResponse.json({ error: 'This payment is tied to a different company' }, { status: 403 })
    }

    const { data: bundle } = await supabase
      .from('screening_consent_bundles')
      .select('id, driver_user_id, company_id, status, form_data, ssn_encrypted')
      .eq('id', consentBundleId)
      .eq('company_id', access.companyId)
      .eq('driver_user_id', candidateUserId)
      .single()

    if (!bundle || bundle.status !== 'complete') {
      return NextResponse.json({ error: 'Screening consent bundle not found or incomplete' }, { status: 404 })
    }

    const latest = await getLatestScreeningConsentBundle(supabase, candidateUserId, access.companyId)
    if (!latest || latest.id !== consentBundleId) {
      return NextResponse.json(
        { error: 'Use the latest complete consent bundle for this candidate' },
        { status: 400 },
      )
    }

    let ssn: string
    try {
      ssn = decryptScreeningSsn(bundle.ssn_encrypted as string)
    } catch (e) {
      console.error('[EMPLOYER SCREENINGS ORDER] decrypt:', e)
      return NextResponse.json({ error: 'Failed to read stored identity for this bundle' }, { status: 500 })
    }

    const fd = (bundle.form_data ?? {}) as Record<string, string>
    const formData = {
      firstName: fd.firstName ?? '',
      lastName: fd.lastName ?? '',
      middleName: fd.middleName ?? '',
      dob: fd.dob ?? fd.dateOfBirth ?? '',
      ssn,
      dlNumber: fd.dlNumber ?? '',
      dlState: fd.dlState ?? '',
      address: fd.address ?? '',
      city: fd.city ?? '',
      state: fd.state ?? '',
      zip: fd.zip ?? '',
      email: fd.email ?? '',
      phone: fd.phone ?? '',
    }

    const { data: driverUser } = await supabase
      .from('users')
      .select('id, email')
      .eq('id', candidateUserId)
      .maybeSingle()

    const placed = await placeScreeningOrder(supabase, request, {
      driverUserId: candidateUserId,
      driverEmail: driverUser?.email ?? null,
      companyId: access.companyId,
      employerUserId: access.employerUserId,
      type,
      formData,
      candidateRequestIdToComplete: null,
      paymentId: payment.id as string,
      paymentTxHash: truncatedTxHash,
    })

    if (placed.ok === false) {
      return NextResponse.json({ error: placed.error, details: placed.details }, { status: placed.status })
    }

    if (placed.result.type === 'psp') {
      return NextResponse.json({
        success: true,
        order: {
          id: placed.result.pspOrderId,
          mvrOrderId: placed.result.mvrOrderId,
          pspOrderId: placed.result.pspOrderId,
          orderNumber: placed.result.orderNumber,
          type: 'psp',
        },
      })
    }

    return NextResponse.json({
      success: true,
      order: {
        id: placed.result.orderId,
        orderNumber: placed.result.orderNumber,
        type: 'mvr',
      },
    })
  } catch (e) {
    console.error('[EMPLOYER SCREENINGS ORDER]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
