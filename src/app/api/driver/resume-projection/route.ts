import { NextRequest, NextResponse } from 'next/server'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { buildResumeProjection } from '@/lib/resume-projection'

/**
 * GET /api/driver/resume-projection
 *
 * Live resume assembled from DOT application_data + block_* + MVR summary.
 * Used by the Construct career-card Resume chrome chip.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()
    const projection = await buildResumeProjection(supabase, userId)

    return NextResponse.json({ success: true, projection })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[RESUME PROJECTION]', error)
    return NextResponse.json(
      { error: 'Failed to build resume projection', details: message },
      { status: 500 },
    )
  }
}
