import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'

/**
 * GET /api/candidate/bgcheck-consent/:consentId
 * 
 * Fetches a specific signed consent for viewing/download.
 * Only the driver who signed it can access it.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ consentId: string }> }
) {
  const { consentId } = await params

  const userId = await getStormUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const supabase = await getAdminSupabaseClient()

    // Fetch consent: try by id first, then by request_id (in case frontend sent request id)
    const byId = await supabase
      .from('bgcheck_consents')
      .select('id, request_id, signed_name, signed_at, form_data, company_name, driver_user_id')
      .eq('id', consentId)
      .single()

    let consent = byId.data
    let consentError = byId.error

    if (consentError || !consent) {
      const byRequestId = await supabase
        .from('bgcheck_consents')
        .select('id, request_id, signed_name, signed_at, form_data, company_name, driver_user_id')
        .eq('request_id', consentId)
        .single()

      if (byRequestId.data) {
        consent = byRequestId.data
        consentError = null
      }
    }

    if (consentError || !consent) {
      return NextResponse.json({ error: 'Consent not found' }, { status: 404 })
    }

    // Verify the user owns this consent (driver_user_id on consent, or candidate on request)
    if (consent.driver_user_id !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const companyName = consent.company_name || 'Unknown Company'

    return NextResponse.json({
      success: true,
      consent: {
        id: consent.id,
        requestId: consent.request_id,
        signedName: consent.signed_name,
        signedAt: consent.signed_at,
        companyName,
        formData: consent.form_data,
      },
    })

  } catch (err) {
    console.error('[CONSENT GET] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
