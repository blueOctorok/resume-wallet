import { NextRequest, NextResponse } from 'next/server'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getEmployerCompanyAccess } from '@/lib/employer-company-access'
import { redactDotAppForEmployer } from '@/lib/redact-dot-app'

/**
 * GET /api/employer/talent/[userId]/dot-app
 *
 * A candidate's DOT application, as { form1, form2, form3 }.
 *
 * Two defects fixed here (2026-08-11):
 *   - It authorized on `users.role === 'employer'` with no company scoping. That
 *     is the wrong primitive — every other employer route uses active company
 *     membership — and it composed with the set-role ordering bug into a chain
 *     where a rejected employer request still granted a read on any driver's
 *     SSN and DOB. It also had an inverse failure: a legitimate team member
 *     whose `users.role` wasn't 'employer' was blocked from a file they should
 *     see.
 *   - It returned raw `application_data`, so SSN, DOB, and street address were
 *     echoed to the browser. Employers now get a redacted projection; the driver
 *     still gets everything on the `isSelf` branch, because they own it.
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

    const isSelf = requesterUserId === userId
    const companyAccess = isSelf ? null : await getEmployerCompanyAccess(supabase, requesterUserId)

    if (!isSelf && !companyAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const applicationId = request.nextUrl.searchParams.get('applicationId')

    let appQuery = supabase
      .from('driver_applications')
      .select('id, is_complete, current_step, application_data, created_at, updated_at')
      .eq('user_id', userId)

    if (applicationId) {
      appQuery = appQuery.eq('id', applicationId)
    } else {
      appQuery = appQuery.order('created_at', { ascending: false }).limit(1)
    }

    const { data: app, error } = await appQuery.maybeSingle()

    if (error) {
      console.error('[DOT APP PREVIEW] Query error:', error)
      return NextResponse.json({ error: 'Failed to fetch DOT application' }, { status: 500 })
    }

    if (!app) {
      return NextResponse.json({ error: 'No DOT application found' }, { status: 404 })
    }

    const appData = (app.application_data ?? {}) as Record<string, unknown>

    if (isSelf) {
      return NextResponse.json({
        id: app.id,
        isComplete: app.is_complete,
        currentStep: app.current_step,
        createdAt: app.created_at,
        updatedAt: app.updated_at,
        form1: appData.form1 ?? null,
        form2: appData.form2 ?? null,
        form3: appData.form3 ?? null,
        redactedFields: [],
      })
    }

    // Log the view so the driver can see which carriers opened their DQ file.
    // This is a candidate-ownership feature, not just an audit control — so a
    // failure to log must not silently hide the access; it's logged loudly and
    // the read still proceeds (mirrors talent/[userId]).
    const { error: viewLogError } = await supabase.from('career_card_views').insert({
      candidate_user_id: userId,
      viewer_user_id: companyAccess!.employerUserId,
      source: 'dot_app',
    })
    if (viewLogError) {
      console.error('[DOT APP PREVIEW] View log failed:', viewLogError)
    }

    const redacted = redactDotAppForEmployer(appData)

    return NextResponse.json({
      id: app.id,
      isComplete: app.is_complete,
      currentStep: app.current_step,
      createdAt: app.created_at,
      updatedAt: app.updated_at,
      ...redacted,
    })
  } catch (err) {
    console.error('[DOT APP PREVIEW] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
