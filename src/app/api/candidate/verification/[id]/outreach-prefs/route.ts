import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'

/**
 * PATCH /api/candidate/verification/[id]/outreach-prefs
 * Body: { voiceOptOut: boolean, smsOptOut: boolean }
 *
 * Driver turns the day-5 call and text off (or back on) for one packet.
 * Email cadence is untouched.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    const { id } = await params
    const body = (await request.json()) as { voiceOptOut?: boolean; smsOptOut?: boolean }
    if (typeof body.voiceOptOut !== 'boolean' || typeof body.smsOptOut !== 'boolean') {
      return NextResponse.json({ error: 'voiceOptOut and smsOptOut must be true or false.' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()
    const { data, error } = await supabase
      .from('employment_verification_requests')
      .update({
        voice_opt_out: body.voiceOptOut,
        sms_opt_out: body.smsOptOut,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('driver_id', userId)
      .select('id')
      .maybeSingle()

    if (error || !data) {
      return NextResponse.json({ error: 'Verification request not found' }, { status: 404 })
    }
    return NextResponse.json({
      success: true,
      message: body.voiceOptOut && body.smsOptOut
        ? 'Calls and texts are off for this employer. Emails continue.'
        : 'Calls and texts are back on for this employer.',
    })
  } catch (error) {
    console.error('[EVR OUTREACH PREFS]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
