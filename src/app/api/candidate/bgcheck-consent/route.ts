import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { createNotification } from '@/lib/create-notification'
import { notifyEmployerCandidateActionComplete } from '@/lib/notify-employer-candidate-action'

/**
 * POST /api/candidate/bgcheck-consent
 *
 * Records a driver's signed authorization for the general FCRA / MVR disclosure.
 * - Stores the consent record in bgcheck_consents
 * - Marks the corresponding candidate_requests entry as 'completed'
 * PSP / driver-psp requests use POST /api/psp/consent (FMCSA stand-alone form), not this route.
 *
 * Body: {
 *   requestId: string     — candidate_requests.id being fulfilled
 *   companyName: string   — display name for the PDF record
 *   signedName: string    — typed signature
 *   formData: object      — pre-filled personal info shown on the form
 * }
 */
export async function POST(request: NextRequest) {
  const userId = await getStormUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const { requestId, companyName, signedName, formData } = await request.json()

  if (!requestId || !signedName?.trim()) {
    return NextResponse.json(
      { error: 'requestId and signedName are required' },
      { status: 400 }
    )
  }

  const supabase = await getAdminSupabaseClient()

  // Verify the candidate owns this request
  const { data: candidateRequest } = await supabase
    .from('candidate_requests')
    .select('id, company_id, candidate_user_id, request_type, target_block_type, status')
    .eq('id', requestId)
    .eq('candidate_user_id', userId)
    .single()

  if (!candidateRequest) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 })
  }

  // Both MVR and PSP orders require the general background check disclosure.
  // PSP additionally requires the FMCSA PSP form (via /api/psp/consent), but the
  // general BG disclosure is a prerequisite for both.
  const isBgcheckConsentRequest =
    candidateRequest.request_type === 'mvr_order' ||
    candidateRequest.request_type === 'psp_order' ||
    (candidateRequest.request_type === 'block_request' &&
      (candidateRequest.target_block_type === 'driver-mvr' || candidateRequest.target_block_type === 'driver-psp'))

  if (!isBgcheckConsentRequest) {
    return NextResponse.json(
      { error: 'This disclosure applies to MVR / PSP screening requests only.' },
      { status: 400 },
    )
  }

  if (!['pending', 'viewed'].includes(candidateRequest.status)) {
    return NextResponse.json({ error: 'This request has already been actioned' }, { status: 409 })
  }

  // Store consent record
  const { error: insertError } = await supabase
    .from('bgcheck_consents')
    .insert({
      request_id: requestId,
      company_id: candidateRequest.company_id,
      company_name: companyName,
      driver_user_id: userId,
      signed_name: signedName.trim(),
      form_data: formData || {},
    })

  if (insertError) {
    console.error('[BGCHECK CONSENT] Insert error:', insertError)
    return NextResponse.json({ error: 'Failed to store consent' }, { status: 500 })
  }

  // For MVR-only requests, mark completed immediately since this is the only disclosure.
  // For PSP requests, the FMCSA PSP form (Step 2) still needs to be signed, so just mark as 'viewed'.
  const isPspRequest = candidateRequest.request_type === 'psp_order' ||
    (candidateRequest.request_type === 'block_request' && candidateRequest.target_block_type === 'driver-psp')

  const newStatus = isPspRequest ? 'viewed' : 'completed'
  const updatePayload: Record<string, string> = { status: newStatus }
  if (newStatus === 'completed') {
    updatePayload.completed_at = new Date().toISOString()
  }

  const { error: updateError } = await supabase
    .from('candidate_requests')
    .update(updatePayload)
    .eq('id', requestId)

  if (updateError) {
    console.error('[BGCHECK CONSENT] Status update error:', updateError)
  }

  // Notify the employer who requested the background check
  const { data: requestingUser } = await supabase
    .from('candidate_requests')
    .select('requested_by_user_id, candidate_user_id')
    .eq('id', requestId)
    .single()

  if (requestingUser?.requested_by_user_id && newStatus === 'completed') {
    void notifyEmployerCandidateActionComplete(supabase, {
      kind: 'bgcheck_consent',
      employerUserId: requestingUser.requested_by_user_id as string,
      companyId: candidateRequest.company_id as string,
      companyName: companyName || 'your company',
      candidateUserId: userId,
      notificationData: { requestId, driverUserId: userId, companyName },
    })
  } else if (requestingUser?.requested_by_user_id && isPspRequest) {
    // PSP path: only in-app nudge — full email goes out when the bundle or order completes
    const { data: driverProfile } = await supabase
      .from('user_profiles')
      .select('first_name, last_name')
      .eq('user_id', requestingUser.candidate_user_id)
      .maybeSingle()
    const driverName =
      [driverProfile?.first_name, driverProfile?.last_name].filter(Boolean).join(' ').trim() || 'A candidate'
    createNotification({
      userId: requestingUser.requested_by_user_id as string,
      type: 'consent_signed',
      title: 'Background check consent signed',
      body: `${driverName} signed step 1 of the screening flow for ${companyName || 'your company'}. FMCSA/CDLIS steps may still be pending.`,
      data: { requestId, driverUserId: user.id, companyName },
    }).catch(err => console.error('[BGCHECK CONSENT] Employer notification error:', err))
  }

  // Notify the driver that their consent was recorded
  createNotification({
    userId: userId,
    type: 'consent_signed',
    title: 'Background check authorization sent',
    body: `Your signed authorization for ${companyName || 'the employer'} has been submitted successfully.`,
    data: { requestId, companyName },
  }).catch(err => console.error('[BGCHECK CONSENT] Driver notification error:', err))

  return NextResponse.json({ success: true })
}
