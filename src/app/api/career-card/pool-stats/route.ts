import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { loadPoolStatsForShareToken } from '@/lib/pool-stats'

/**
 * GET /api/career-card/pool-stats?token=
 *
 * Aggregate counts for the public-card teaser. Open, but only with a valid
 * share token so it isn't a free talent-search API. Returns counts only.
 */
export async function GET(request: NextRequest) {
  try {
    const token = new URL(request.url).searchParams.get('token')?.trim()
    if (!token) {
      return NextResponse.json({ error: 'Share token is required' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()
    const stats = await loadPoolStatsForShareToken(supabase, token)
    if (!stats) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, stats })
  } catch (error) {
    console.error('[POOL STATS] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
