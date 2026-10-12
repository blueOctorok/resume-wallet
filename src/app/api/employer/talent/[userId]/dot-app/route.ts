import { NextRequest, NextResponse } from 'next/server'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { loadDotAppForViewer } from '@/lib/load-dot-app-for-viewer'

/**
 * GET /api/employer/talent/[userId]/dot-app
 *
 * A candidate's DOT application, as { form1, form2, form3 }.
 *
 * Access, redaction, view logging, and the company stamp all live in
 * `loadDotAppForViewer` and are shared with the PDF export at `./pdf`.
 *
 * History (2026-08-11): this route once authorized on `users.role === 'employer'`
 * with no company scoping and returned raw `application_data` (SSN, DOB, street).
 * Employers now get a redacted projection; the driver still gets everything on
 * the self branch, because they own it.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const requesterUserId = await getStormUserIdFromRequest(request)
    if (!requesterUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()
    const { userId } = await params
    const applicationId = request.nextUrl.searchParams.get('applicationId')

    const result = await loadDotAppForViewer(supabase, requesterUserId, userId, applicationId)
    // `=== false` (not `!ok`): with `strict: false` only an explicit literal
    // comparison narrows the discriminated union.
    if (result.ok === false) {
      const { status, error, requestRequired } = result
      return NextResponse.json(requestRequired ? { error, requestRequired } : { error }, { status })
    }

    return NextResponse.json(result.app)
  } catch (err) {
    console.error('[DOT APP PREVIEW] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
