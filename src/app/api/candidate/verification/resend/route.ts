import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { getAppBaseUrl } from '@/lib/app-url'
import {
  EVR_MAX_ATTEMPTS,
  OUTREACH_REQUEST_COLUMNS,
  sendOutreachAttempt,
  type OutreachRequestRow,
} from '@/lib/evr-outreach'

/**
 * POST /api/candidate/verification/resend
 *
 * Manual "send now" — the cron handles the scheduled cadence, but a driver
 * can pull the next attempt forward. Same sender, same attempt bookkeeping.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = (await request.json()) as { requestId?: string }
    if (!body.requestId) {
      return NextResponse.json({ error: 'requestId is required' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()
    const { data: row, error } = await supabase
      .from('employment_verification_requests')
      .select(OUTREACH_REQUEST_COLUMNS)
      .eq('id', body.requestId)
      .eq('driver_id', userId)
      .maybeSingle()

    if (error || !row) {
      return NextResponse.json({ error: 'Verification request not found' }, { status: 404 })
    }

    const result = await sendOutreachAttempt(supabase, row as OutreachRequestRow, {
      baseUrl: getAppBaseUrl(request),
      triggeredBy: 'driver',
    })

    if (!result.ok) {
      const status = result.code === 'no_contact' ? 400 : 409
      return NextResponse.json({ error: result.error }, { status })
    }

    return NextResponse.json({
      success: true,
      attemptNumber: result.attemptNumber,
      remainingAttempts: Math.max(0, EVR_MAX_ATTEMPTS - result.attemptNumber),
    })
  } catch (error) {
    console.error('[EVR RESEND]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
