import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { resolveEmployerCompanyForWallet } from '@/lib/employer-talent-auth'
import { loadDqMonitorList } from '@/lib/dq-file-load'

/**
 * GET /api/employer/dq-monitor
 *
 * Roster of engaged candidates with DQ completeness rollups (company lens).
 * Click-through detail: GET /api/employer/dq-monitor/[userId]
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()
    const ctx = await resolveEmployerCompanyForWallet(supabase, userId)
    if (!ctx) {
      return NextResponse.json({ error: 'No company access' }, { status: 403 })
    }

    const candidates = await loadDqMonitorList(supabase, ctx.companyId)

    return NextResponse.json({
      success: true,
      companyId: ctx.companyId,
      candidates,
    })
  } catch (error) {
    console.error('[DQ MONITOR] List error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
