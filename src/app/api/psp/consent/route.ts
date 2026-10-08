import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { createNotification } from '@/lib/create-notification'

/**
 * POST /api/psp/consent
 * Stores FMCSA PSP Disclosure & Authorization for an employer's screening request.
 * PSP is employer-ordered only (DEC-2026-10-001) — `requestId` is required.
 */
export async function POST(request: NextRequest) {
  const userId = await getStormUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { requestId, companyName, signedName, formData } = body as {
      requestId?: string | null
      companyName?: string
      signedName?: string
      formData?: Record<string, unknown>
    }

    if (!signedName?.trim()) {
      return NextResponse.json({ error: 'signedName is required' }, { status: 400 })
    }
    if (!requestId) {
      return NextResponse.json(
        { error: 'PSP reports are ordered by employers. A screening request is required.' },
        { status: 400 },
      )
    }

    const supabase = await getAdminSupabaseClient()

    const { data: candidateRequest } = await supabase
      .from('candidate_requests')
      .select('id, company_id, candidate_user_id, request_type, target_block_type, status')
      .eq('id', requestId)
      .eq('candidate_user_id', userId)
      .single()

    if (!candidateRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    const isPspConsentRequest =
      candidateRequest.request_type === 'psp_order' ||
      (candidateRequest.request_type === 'block_request' && candidateRequest.target_block_type === 'driver-psp')

    if (!isPspConsentRequest) {
      return NextResponse.json(
        { error: 'This PSP consent endpoint only applies to PSP / driver-psp requests' },
        { status: 400 },
      )
    }

    if (!['pending', 'viewed'].includes(candidateRequest.status)) {
      return NextResponse.json({ error: 'This request has already been actioned' }, { status: 409 })
    }

    const insertPayload = {
      request_id: requestId,
      company_id: candidateRequest.company_id,
      company_name: (companyName || 'the employer').trim() || 'the employer',
      driver_user_id: userId,
      signed_name: signedName.trim(),
      form_data: formData || {},
    }

    const { data: inserted, error: insertError } = await supabase
      .from('psp_consents')
      .insert(insertPayload)
      .select('id')
      .single()

    if (insertError) {
      console.error('[PSP CONSENT] Insert error:', insertError)
      return NextResponse.json({ error: 'Failed to store PSP consent' }, { status: 500 })
    }

    // Do NOT mark `completed` here — the Accio order hasn't been placed yet.
    // Step 3 (CDLIS + fulfill-screening) is the one that marks it `completed`.
    // We only advance from `pending` → `viewed` so `usePendingScreeningRequest`
    // still finds the row and keeps the wizard alive on page reload.
    const { error: updateError } = await supabase
      .from('candidate_requests')
      .update({ status: 'viewed' })
      .eq('id', requestId)
      .in('status', ['pending', 'viewed'])

    if (updateError) {
      console.error('[PSP CONSENT] Status update error:', updateError)
    }

    const { data: requestingUser } = await supabase
      .from('candidate_requests')
      .select('requested_by_user_id, candidate_user_id')
      .eq('id', requestId)
      .single()

    if (requestingUser?.requested_by_user_id) {
      const { data: driverProfile } = await supabase
        .from('user_profiles')
        .select('first_name, last_name')
        .eq('user_id', requestingUser.candidate_user_id)
        .maybeSingle()

      const driverName =
        [driverProfile?.first_name, driverProfile?.last_name].filter(Boolean).join(' ').trim() || 'A candidate'

      createNotification({
        userId: requestingUser.requested_by_user_id,
        type: 'consent_signed',
        title: 'PSP disclosure signed — CDLIS step remaining',
        body: `${driverName} signed the FMCSA PSP Disclosure & Authorization for ${insertPayload.company_name}. The order will be submitted after the CDLIS consent step.`,
        data: { requestId, driverUserId: userId, companyName: insertPayload.company_name, kind: 'psp_fmcsa' },
      }).catch(err => console.error('[PSP CONSENT] Employer notification error:', err))
    }

    createNotification({
      userId: userId,
      type: 'consent_signed',
      title: 'PSP disclosure signed — one step left',
      body: `Your FMCSA PSP Disclosure for ${insertPayload.company_name} was recorded. Complete the CDLIS consent to submit the order.`,
      data: { requestId, companyName: insertPayload.company_name, kind: 'psp_fmcsa' },
    }).catch(err => console.error('[PSP CONSENT] Driver notification error:', err))

    return NextResponse.json({ success: true, consentId: inserted.id })
  } catch (e) {
    console.error('[PSP CONSENT POST]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
