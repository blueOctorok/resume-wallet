import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { resolveEmployerCompanyForWallet } from '@/lib/employer-talent-auth'
import { loadDqMonitorCandidateIds } from '@/lib/dq-file-load'
import { presentLicenseScan } from '@/lib/license-scan-view'

/**
 * GET /api/employer/dq-monitor/[userId]/license
 *
 * The same license scan the driver confirms on their license block: both
 * photos and the barcode read. Only for a driver already on this company's
 * status board. On file — not a verified record.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const employerUserId = await getStormUserIdFromRequest(request)
    const { userId: candidateUserId } = await params

    if (!employerUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    if (!candidateUserId) {
      return NextResponse.json({ error: 'Candidate user ID is required' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()
    const ctx = await resolveEmployerCompanyForWallet(supabase, employerUserId)
    if (!ctx) {
      return NextResponse.json({ error: 'No company access' }, { status: 403 })
    }

    const { ids } = await loadDqMonitorCandidateIds(supabase, ctx.companyId)
    if (!ids.includes(candidateUserId)) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
    }

    const scan = await presentLicenseScan(supabase, candidateUserId)
    return NextResponse.json({ success: true, scan })
  } catch (error) {
    console.error('[DQ LICENSE] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
