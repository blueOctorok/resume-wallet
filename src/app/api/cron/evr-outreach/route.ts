import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getAppBaseUrl } from '@/lib/app-url'
import { runOutreachCadence } from '@/lib/evr-outreach'

/**
 * GET /api/cron/evr-outreach
 *
 * Vercel cron — hourly. Sends due EV follow-ups (day 3, day 7) inside the
 * weekday send window and marks packets exhausted 7 days after the last send.
 * Replaces "the driver remembers to click Send again" with a real cadence.
 *
 * Auth mirrors reconcile-screenings: `?secret=$CRON_SECRET` or Bearer header.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const provided =
    request.nextUrl.searchParams.get('secret') ??
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    null
  if (secret && provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = await getAdminSupabaseClient()
    const summary = await runOutreachCadence(supabase, getAppBaseUrl(request))
    console.log('[EVR OUTREACH CRON]', JSON.stringify(summary))
    return NextResponse.json({ success: true, ...summary })
  } catch (error) {
    console.error('[EVR OUTREACH CRON]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
