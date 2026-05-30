import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'

/**
 * GET /api/psp/consent/:consentId — view a signed PSP FMCSA consent (driver only).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ consentId: string }> },
) {
  const { consentId } = await params

  const userId = await getStormUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const supabase = await getAdminSupabaseClient()

    const { data: consent, error } = await supabase
      .from('psp_consents')
      .select('id, request_id, signed_name, signed_at, form_data, company_name, driver_user_id, form_version')
      .eq('id', consentId)
      .single()

    if (error || !consent) {
      return NextResponse.json({ error: 'Consent not found' }, { status: 404 })
    }

    if (consent.driver_user_id !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    return NextResponse.json({
      success: true,
      consent: {
        id: consent.id,
        requestId: consent.request_id,
        signedName: consent.signed_name,
        signedAt: consent.signed_at,
        companyName: consent.company_name || 'Self-Request',
        formData: consent.form_data,
        formVersion: consent.form_version,
      },
    })
  } catch (err) {
    console.error('[PSP CONSENT GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/psp/consent/:consentId — merge fields into `form_data` (driver only).
 * Used after FMCSA PSP consent is saved to append CDLIS written consent answers
 * before the Accio bundle is placed (`EmployerPspMvrBundleAttestationStep`).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ consentId: string }> },
) {
  const { consentId } = await params

  const userId = await getStormUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const body = (await request.json()) as { mergeFormData?: Record<string, unknown> }
    const mergeFormData = body.mergeFormData
    if (!mergeFormData || typeof mergeFormData !== 'object') {
      return NextResponse.json({ error: 'mergeFormData object is required' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()

    const { data: consent, error: fetchError } = await supabase
      .from('psp_consents')
      .select('id, driver_user_id, form_data')
      .eq('id', consentId)
      .single()

    if (fetchError || !consent) {
      return NextResponse.json({ error: 'Consent not found' }, { status: 404 })
    }

    if (consent.driver_user_id !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const prev = (consent.form_data && typeof consent.form_data === 'object' ? consent.form_data : {}) as Record<
      string,
      unknown
    >
    const next = { ...prev, ...mergeFormData }

    const { error: updateError } = await supabase
      .from('psp_consents')
      .update({ form_data: next })
      .eq('id', consentId)
      .eq('driver_user_id', userId)

    if (updateError) {
      console.error('[PSP CONSENT PATCH]', updateError)
      return NextResponse.json({ error: 'Failed to update consent' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[PSP CONSENT PATCH]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
