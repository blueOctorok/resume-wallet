import { NextRequest, NextResponse } from 'next/server'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { companyCanReadDriverResume, getEmployerCompanyAccess } from '@/lib/employer-company-access'
import { buildResumeProjection } from '@/lib/resume-projection'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

/**
 * GET /api/employer/talent/[userId]/resume
 *
 * The same live resume the driver opens from their career card. Only a company
 * that already has this driver on the status board (or a real relationship)
 * can read it.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const employerUserId = await getStormUserIdFromRequest(request)
    const { userId } = await params

    if (!employerUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()
    const access = await getEmployerCompanyAccess(supabase, employerUserId)
    if (!access) {
      return NextResponse.json({ error: 'No company access' }, { status: 403 })
    }

    const allowed = await companyCanReadDriverResume(supabase, access, userId)
    if (!allowed) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
    }

    const projection = await buildResumeProjection(supabase, userId)
    return NextResponse.json({ success: true, projection })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[EMPLOYER RESUME]', error)
    return NextResponse.json({ error: 'Failed to build resume projection', details: message }, { status: 500 })
  }
}
