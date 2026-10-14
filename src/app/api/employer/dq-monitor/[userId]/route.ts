import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { resolveEmployerCompanyForWallet } from '@/lib/employer-talent-auth'
import { loadDriverFileDetail, loadDqMonitorCandidateIds } from '@/lib/dq-file-load'

/**
 * GET /api/employer/dq-monitor/[userId]
 *
 * Driver file for the status board: identity header + DQ snapshot + the
 * per-item detail (CDL, license read, DOT step, consent parts, screenings,
 * employment verifications, this company's invites). Company lens.
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

    // Same set the roster is built from, including an agency's self-serve
    // drivers. A member of some other company still cannot open a person
    // who is not on their list.
    const { ids } = await loadDqMonitorCandidateIds(supabase, ctx.companyId)
    if (!ids.includes(candidateUserId)) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('user_id, first_name, last_name, avatar_url, email, phone, headline')
      .eq('user_id', candidateUserId)
      .maybeSingle()

    if (!profile) {
      // Still allow DQ if they exist as a user without a profile row
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('id', candidateUserId)
        .maybeSingle()
      if (!user) {
        return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
      }
    }

    const hireDate = request.nextUrl.searchParams.get('hireDate')
    const { dqFile, detail } = await loadDriverFileDetail(supabase, ctx.companyId, candidateUserId, hireDate)

    const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim() || 'Unknown driver'

    return NextResponse.json({
      success: true,
      companyId: ctx.companyId,
      candidate: {
        userId: candidateUserId,
        name,
        avatarUrl: profile?.avatar_url ?? null,
        email: profile?.email ?? null,
        phone: profile?.phone ?? null,
        headline: profile?.headline ?? null,
      },
      dqFile,
      detail,
    })
  } catch (error) {
    console.error('[DQ MONITOR] Detail error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
