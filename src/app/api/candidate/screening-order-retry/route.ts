import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { placeDriverOwnedOrdersFromConsentBundle } from '@/lib/place-driver-owned-orders-from-bundle'
import { getScreeningOrderLocks } from '@/lib/driver-owned-screening'

/**
 * GET /api/candidate/screening-order-retry
 *
 * Returns whether the signed-in driver can retry placing orders from a saved
 * consent bundle (consent saved, orders missing).
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()

    const { data: bundle } = await supabase
      .from('screening_consent_bundles')
      .select('id, candidate_request_id, form_data, company_id, completed_at')
      .eq('driver_user_id', userId)
      .eq('status', 'complete')
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!bundle?.candidate_request_id) {
      return NextResponse.json({ retryable: false })
    }

    // Any active order (driver- OR employer-owned) locks its kind — offering a
    // retry the duplicate guard would 409 just confuses the candidate.
    const locks = await getScreeningOrderLocks(supabase, userId)
    if (locks.mvr.locked && locks.psp.locked) {
      return NextResponse.json({ retryable: false })
    }

    const { data: company } = await supabase
      .from('companies')
      .select('company_name')
      .eq('id', bundle.company_id)
      .maybeSingle()

    const formData = (bundle.form_data ?? {}) as Record<string, string>
    const storedDob = String(formData.dob ?? formData.dateOfBirth ?? '').trim() || null

    return NextResponse.json({
      retryable: true,
      requestId: bundle.candidate_request_id as string,
      companyName: (company as { company_name?: string } | null)?.company_name ?? 'Your employer',
      storedDob,
      needsMvr: !locks.mvr.locked,
      needsPsp: !locks.psp.locked,
    })
  } catch (e) {
    console.error('[SCREENING ORDER RETRY GET]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/candidate/screening-order-retry
 *
 * Retry driver-owned MVR + PSP when consent saved but orders failed (e.g. bad DOB).
 * Body: { requestId, formDataPatch?: { dob?, dlNumber?, ... } }
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = (await request.json()) as {
      requestId?: string
      formDataPatch?: Record<string, string>
    }

    if (!body.requestId) {
      return NextResponse.json({ error: 'requestId is required' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()

    const { data: user } = await supabase
      .from('users')
      .select('id, email')
      .eq('id', userId)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const result = await placeDriverOwnedOrdersFromConsentBundle(
      supabase,
      request,
      user.id,
      user.email ?? null,
      { requestId: body.requestId, formDataPatch: body.formDataPatch },
    )

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[SCREENING ORDER RETRY]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
