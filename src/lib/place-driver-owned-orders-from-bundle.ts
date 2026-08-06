import type { NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { decryptScreeningSsn } from '@/lib/screening-consent-crypto'
import { placeScreeningOrder } from '@/lib/place-screening-order'
import { resolveScreeningPayment } from '@/lib/resolve-waived-screening-payment'
import { notifyEmployerCandidateActionComplete } from '@/lib/notify-employer-candidate-action'
import { getScreeningOrderLocks } from '@/lib/driver-owned-screening'
import { validateScreeningOrderInput } from '@/lib/screening-validation'

export interface DriverOwnedOrderRetryInput {
  requestId: string
  /** Optional field overrides (e.g. corrected DOB after a typo). */
  formDataPatch?: Record<string, string>
}

function pickDob(formData: Record<string, unknown>): string {
  return String(formData.dob ?? formData.dateOfBirth ?? '').trim()
}

function buildOrderFormData(
  bundleFormData: Record<string, unknown>,
  ssn: string,
  patch?: Record<string, string>,
): Record<string, string> {
  const merged = { ...bundleFormData, ...(patch ?? {}) }
  return {
    firstName: String(merged.firstName ?? '').trim(),
    lastName: String(merged.lastName ?? '').trim(),
    middleName: String(merged.middleName ?? '').trim(),
    dob: pickDob(merged),
    ssn,
    dlNumber: String(merged.dlNumber ?? '').trim(),
    dlState: String(merged.dlState ?? '').trim(),
    address: String(merged.address ?? '').trim(),
    city: String(merged.city ?? '').trim(),
    state: String(merged.state ?? '').trim(),
    zip: String(merged.zip ?? '').trim(),
    email: String(merged.email ?? '').trim(),
    phone: String(merged.phone ?? '').trim(),
  }
}

/**
 * Place driver-owned MVR + PSP when consent bundle exists but orders failed or
 * were never submitted (e.g. DOB validation error after consent saved).
 */
export async function placeDriverOwnedOrdersFromConsentBundle(
  supabase: SupabaseClient,
  request: NextRequest,
  driverUserId: string,
  driverEmail: string | null,
  input: DriverOwnedOrderRetryInput,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { requestId, formDataPatch } = input

  const { data: candidateRequest } = await supabase
    .from('candidate_requests')
    .select('id, company_id, requested_by_user_id, candidate_user_id')
    .eq('id', requestId)
    .eq('candidate_user_id', driverUserId)
    .single()

  if (!candidateRequest) {
    return { ok: false, status: 404, error: 'Request not found' }
  }

  const { data: bundle } = await supabase
    .from('screening_consent_bundles')
    .select('id, form_data, ssn_encrypted, status')
    .eq('candidate_request_id', requestId)
    .eq('driver_user_id', driverUserId)
    .eq('status', 'complete')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!bundle) {
    return { ok: false, status: 404, error: 'Screening consent not found — complete the consent forms first' }
  }

  // Any active order (driver- OR employer-owned) locks its kind — matches the
  // duplicate guard in screening-validation.ts, so we skip legs that would 409.
  const locks = await getScreeningOrderLocks(supabase, driverUserId)
  if (locks.mvr.locked && locks.psp.locked) {
    return { ok: false, status: 409, error: 'MVR and PSP orders are already on file' }
  }

  let ssn: string
  try {
    ssn = decryptScreeningSsn(String(bundle.ssn_encrypted))
  } catch {
    return { ok: false, status: 500, error: 'Could not decrypt stored identity — contact support' }
  }

  const orderFormData = buildOrderFormData(
    (bundle.form_data ?? {}) as Record<string, unknown>,
    ssn,
    formDataPatch,
  )

  const validation = validateScreeningOrderInput({
    firstName: orderFormData.firstName,
    lastName: orderFormData.lastName,
    dob: orderFormData.dob,
    dlState: orderFormData.dlState,
    dlNumber: orderFormData.dlNumber,
    ssn: orderFormData.ssn,
  })
  if (!validation.ok) {
    return { ok: false, status: 400, error: validation.error }
  }

  if (formDataPatch && Object.keys(formDataPatch).length > 0) {
    const { ssn: _strip, ...patchSansSsn } = formDataPatch
    const updatedForm = {
      ...(bundle.form_data as Record<string, unknown>),
      ...patchSansSsn,
      dob: orderFormData.dob,
      dateOfBirth: orderFormData.dob,
    }
    await supabase
      .from('screening_consent_bundles')
      .update({ form_data: updatedForm })
      .eq('id', bundle.id)
  }

  const companyId = candidateRequest.company_id as string
  const employerUserId = (candidateRequest.requested_by_user_id as string | null) ?? null

  if (!locks.mvr.locked) {
    const paymentResult = await resolveScreeningPayment(supabase, {
      paymentType: 'MVR_ORDER',
      userId: employerUserId ?? driverUserId,
      companyId,
      candidateUserId: driverUserId,
    })
    if (!paymentResult.ok) {
      return { ok: false, status: paymentResult.status, error: paymentResult.error }
    }

    const placed = await placeScreeningOrder(supabase, request, {
      driverUserId,
      driverEmail,
      companyId,
      employerUserId,
      type: 'mvr',
      formData: orderFormData,
      ownership: 'driver',
      paymentId: paymentResult.paymentId,
      paymentTxHash: paymentResult.resolvedTxHash,
    })
    if (!placed.ok) {
      return { ok: false, status: placed.status, error: placed.error }
    }
  }

  if (!locks.psp.locked) {
    const paymentResult = await resolveScreeningPayment(supabase, {
      paymentType: 'PSP_ORDER',
      userId: employerUserId ?? driverUserId,
      companyId,
      candidateUserId: driverUserId,
    })
    if (!paymentResult.ok) {
      return { ok: false, status: paymentResult.status, error: paymentResult.error }
    }

    const placed = await placeScreeningOrder(supabase, request, {
      driverUserId,
      driverEmail,
      companyId,
      employerUserId,
      type: 'psp',
      formData: orderFormData,
      candidateRequestIdToComplete: requestId,
      ownership: 'driver',
      paymentId: paymentResult.paymentId,
      paymentTxHash: paymentResult.resolvedTxHash,
    })
    if (!placed.ok) {
      return { ok: false, status: placed.status, error: placed.error }
    }

    const { data: company } = await supabase
      .from('companies')
      .select('company_name')
      .eq('id', companyId)
      .maybeSingle()

    void notifyEmployerCandidateActionComplete(supabase, {
      kind: 'screening_consent',
      employerUserId,
      companyId,
      companyName: (company as { company_name?: string } | null)?.company_name?.trim() || 'Your company',
      candidateUserId: driverUserId,
      notificationTitle: 'Candidate ordered portable MVR + PSP',
      notificationBody: `${driverEmail ?? 'Your candidate'} submitted driver-owned MVR and PSP orders. Track progress in Talent Search or Applicants.`,
      ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'https://provven.com'}/?employer=applicants`,
      notificationData: { requestId, driverOwned: true },
    }).catch((err) => {
      console.error('[DRIVER-OWNED RETRY] employer notify failed:', err)
    })
  } else {
    await supabase
      .from('candidate_requests')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', requestId)
      .neq('status', 'completed')
  }

  return { ok: true }
}
