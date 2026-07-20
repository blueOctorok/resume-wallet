import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { getScreeningOrderLocks } from '@/lib/driver-owned-screening'

/**
 * GET /api/candidate/screening-lock
 *
 * Whether the signed-in driver can place a new MVR / PSP order. Mirrors the
 * server-side duplicate guard (`checkRecentDuplicateOrder`): any active order
 * of a kind — regardless of who ordered it — locks that kind until the report
 * expires (30 days) or the order fails. The UI uses this to show a "report on
 * file" card instead of an order form the guard would reject anyway.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()
    const locks = await getScreeningOrderLocks(supabase, userId)

    return NextResponse.json(locks)
  } catch (e) {
    console.error('[SCREENING LOCK]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
