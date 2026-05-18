import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { encryptScreeningSsn } from '@/lib/screening-consent-crypto'
import { hasCdlisWrittenConsent } from '@/lib/screening-consent-bundle'
import { ensureHubBlocksForPspMvrBundle } from '@/lib/ensure-hub-blocks-psp-mvr-bundle'
import { notifyEmployerCandidateActionComplete } from '@/lib/notify-employer-candidate-action'

interface DeferredConsent {
  signedName: string
  formData: Record<string, unknown>
}

/**
 * POST /api/candidate/screening-consent
 *
 * Saves FCRA + FMCSA + CDLIS instruments and a screening_consent_bundles row in one shot.
 * Does not call Accio. Request must be block_request targeting driver-screening-consent.
 */
export async function POST(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 401 })
    }

    const body = await request.json() as {
      requestId?: string
      companyName?: string
      deferredBgConsent?: DeferredConsent
      deferredPspConsent?: DeferredConsent
      cdlisWrittenConsent?: Record<string, unknown>
      formData?: Record<string, string>
    }

    const { requestId, companyName, deferredBgConsent, deferredPspConsent, cdlisWrittenConsent, formData } = body

    if (!requestId || !deferredBgConsent || !deferredPspConsent || !formData) {
      return NextResponse.json(
        { error: 'requestId, deferredBgConsent, deferredPspConsent, and formData are required' },
        { status: 400 },
      )
    }

    if (!deferredBgConsent.signedName?.trim() || !deferredPspConsent.signedName?.trim()) {
      return NextResponse.json({ error: 'Both disclosure signatures are required' }, { status: 400 })
    }

    const mergedPspForm = {
      ...(deferredPspConsent.formData ?? {}),
      ...(cdlisWrittenConsent ? { cdlisWrittenConsent } : {}),
    }
    if (!hasCdlisWrittenConsent(mergedPspForm)) {
      return NextResponse.json({ error: 'CDLIS written consent is incomplete' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()
    const { data: user } = await supabase.from('users').select('id').ilike('wallet_address', walletAddress).single()
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { data: candidateRequest } = await supabase
      .from('candidate_requests')
      .select('id, company_id, candidate_user_id, request_type, target_block_type, status, requested_by_user_id')
      .eq('id', requestId)
      .eq('candidate_user_id', user.id)
      .single()

    if (!candidateRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    const isScreeningConsent =
      candidateRequest.request_type === 'block_request' &&
      candidateRequest.target_block_type === 'driver-screening-consent'

    if (!isScreeningConsent) {
      return NextResponse.json({ error: 'This endpoint only completes screening consent bundle requests' }, {
        status: 400,
      })
    }

    if (!['pending', 'viewed'].includes(candidateRequest.status as string)) {
      return NextResponse.json({ error: 'This request has already been actioned' }, { status: 409 })
    }

    const { data: company } = await supabase
      .from('companies')
      .select('company_name')
      .eq('id', candidateRequest.company_id)
      .maybeSingle()

    const resolvedCompanyName =
      (companyName || (company as { company_name?: string } | null)?.company_name || 'the employer').trim() || 'the employer'

    const { data: bgRow, error: bgErr } = await supabase
      .from('bgcheck_consents')
      .insert({
        request_id: requestId,
        company_id: candidateRequest.company_id,
        company_name: resolvedCompanyName,
        driver_user_id: user.id,
        signed_name: deferredBgConsent.signedName.trim(),
        form_data: deferredBgConsent.formData ?? {},
      })
      .select('id, signed_at')
      .single()

    if (bgErr || !bgRow) {
      console.error('[SCREENING CONSENT] bgcheck insert:', bgErr)
      return NextResponse.json({ error: 'Failed to save background check consent' }, { status: 500 })
    }

    const { data: pspRow, error: pspErr } = await supabase
      .from('psp_consents')
      .insert({
        request_id: requestId,
        company_id: candidateRequest.company_id,
        company_name: resolvedCompanyName,
        driver_user_id: user.id,
        signed_name: deferredPspConsent.signedName.trim(),
        form_data: mergedPspForm,
      })
      .select('id, signed_at, form_data')
      .single()

    if (pspErr || !pspRow) {
      console.error('[SCREENING CONSENT] psp insert:', pspErr)
      return NextResponse.json({ error: 'Failed to save PSP consent' }, { status: 500 })
    }

    const cdlis = mergedPspForm.cdlisWrittenConsent as Record<string, unknown>
    const cdlisSubmittedAt = String(cdlis.submittedAtUtc ?? new Date().toISOString())
    const cdlisSignedAt = new Date(cdlisSubmittedAt).toISOString()

    let ssnEncrypted: string
    try {
      ssnEncrypted = encryptScreeningSsn(String(formData.ssn ?? '').replace(/\D/g, ''))
    } catch (e) {
      console.error('[SCREENING CONSENT] SSN encrypt:', e)
      return NextResponse.json(
        { error: 'Server cannot store screening identity — SCREENING_CONSENT_ENCRYPTION_KEY misconfigured' },
        { status: 500 },
      )
    }

    // Never store plaintext SSN in form_data — ssn_encrypted is the only authorized
    // storage location. We do store the rest of the PII (name, DOB, DL, address)
    // so the order endpoint can reconstruct the Accio payload without re-asking the driver.
    const { ssn: _ssnStrip, ...formDataSansSsn } = formData

    const { data: bundleRow, error: bundleErr } = await supabase
      .from('screening_consent_bundles')
      .insert({
        driver_user_id: user.id,
        company_id: candidateRequest.company_id,
        candidate_request_id: requestId,
        bgcheck_consent_id: bgRow.id,
        psp_consent_id: pspRow.id,
        cdlis_signed_name: String(cdlis.typedSignature ?? '').trim() || null,
        cdlis_signed_at: cdlisSignedAt,
        cdlis_form_data: cdlis,
        form_data: formDataSansSsn,
        ssn_encrypted: ssnEncrypted,
        status: 'complete',
        completed_at: new Date().toISOString(),
      })
      .select('id, completed_at')
      .single()

    if (bundleErr || !bundleRow) {
      console.error('[SCREENING CONSENT] bundle insert:', bundleErr)
      return NextResponse.json({ error: 'Failed to save screening consent bundle' }, { status: 500 })
    }

    await supabase
      .from('candidate_requests')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', requestId)

    await ensureHubBlocksForPspMvrBundle(supabase, user.id)

    void notifyEmployerCandidateActionComplete(supabase, {
      kind: 'screening_consent',
      employerUserId: candidateRequest.requested_by_user_id as string | null,
      companyId: candidateRequest.company_id as string,
      companyName: resolvedCompanyName,
      candidateUserId: user.id,
      notificationData: { requestId, bundleId: bundleRow.id, kind: 'screening_consent_bundle' },
    })

    return NextResponse.json({
      success: true,
      bundleId: bundleRow.id as string,
      bgSignedAt: bgRow.signed_at as string,
      pspSignedAt: pspRow.signed_at as string,
      cdlisSubmittedAt: cdlisSubmittedAt,
      bundleCompletedAt: bundleRow.completed_at as string,
    })
  } catch (e) {
    console.error('[SCREENING CONSENT]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
