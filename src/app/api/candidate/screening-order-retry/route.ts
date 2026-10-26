import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { placeDriverOwnedOrdersFromConsentBundle } from '@/lib/place-driver-owned-orders-from-bundle'
import { getScreeningOrderLocks } from '@/lib/driver-owned-screening'
import { findMvrIdentityMismatch, storedIdentityFromForm } from '@/lib/mvr-identity-correction'

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

    // Any active order locks its kind. A DMV identity mismatch is the exception:
    // the driver can correct the name, license number, or date of birth and
    // we place a new MVR with the SSN already on the consent.
    const locks = await getScreeningOrderLocks(supabase, userId)
    const mismatch = locks.mvr.locked ? await findMvrIdentityMismatch(supabase, userId) : null
    if (locks.mvr.locked && locks.psp.locked && !mismatch) {
      return NextResponse.json({ retryable: false })
    }

    const { data: company } = await supabase
      .from('companies')
      .select('company_name')
      .eq('id', bundle.company_id)
      .maybeSingle()

    const stored = storedIdentityFromForm((bundle.form_data ?? {}) as Record<string, unknown>)

    return NextResponse.json({
      retryable: true,
      requestId: bundle.candidate_request_id as string,
      companyName: (company as { company_name?: string } | null)?.company_name ?? 'Your employer',
      storedDob: stored.dob || null,
      storedFirstName: stored.firstName,
      storedLastName: stored.lastName,
      storedDlNumber: stored.dlNumber,
      storedDlState: stored.dlState,
      correctIdentity: Boolean(mismatch),
      mismatchFields: mismatch?.fields ?? [],
      needsMvr: !locks.mvr.locked || Boolean(mismatch),
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
 * Retry driver-owned MVR + PSP when consent saved but orders failed, or replace
 * an MVR the state could not match. Body:
 * { requestId, correctIdentity?: boolean, formDataPatch?: { firstName?, lastName?, dob?, dlNumber?, dlState? } }
 * SSN is not accepted — the encrypted value on the consent is reused.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = (await request.json()) as {
      requestId?: string
      correctIdentity?: boolean
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
      {
        requestId: body.requestId,
        formDataPatch: body.formDataPatch,
        correctIdentity: body.correctIdentity === true,
      },
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
