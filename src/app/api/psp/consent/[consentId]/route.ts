import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

/**
 * GET /api/psp/consent/:consentId — view a signed PSP FMCSA consent (driver only).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ consentId: string }> },
) {
  const { consentId } = await params
  const walletAddress = request.headers.get('x-wallet-address')

  if (!walletAddress) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const supabase = await getAdminSupabaseClient()
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .ilike('wallet_address', walletAddress)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { data: consent, error } = await supabase
      .from('psp_consents')
      .select('id, request_id, signed_name, signed_at, form_data, company_name, driver_user_id, form_version')
      .eq('id', consentId)
      .single()

    if (error || !consent) {
      return NextResponse.json({ error: 'Consent not found' }, { status: 404 })
    }

    if (consent.driver_user_id !== user.id) {
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
