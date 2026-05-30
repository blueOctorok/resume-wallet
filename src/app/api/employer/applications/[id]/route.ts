import { NextRequest, NextResponse } from 'next/server'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

/**
 * DELETE /api/employer/applications/[id]
 * Removes a candidate from the employer's pipeline (deletes the application row).
 * Same company-access rules as PATCH status.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    const { id: applicationId } = await params

    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    if (!applicationId) {
      return NextResponse.json({ error: 'Application ID is required' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()

    const { data: application } = await supabase
      .from('applications')
      .select('id, job_posting_id')
      .eq('id', applicationId)
      .single()

    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    const { data: jobPosting } = await supabase
      .from('job_postings')
      .select('id, company_id')
      .eq('id', application.job_posting_id)
      .single()

    if (!jobPosting) {
      return NextResponse.json({ error: 'Job posting not found' }, { status: 404 })
    }

    const companyId = jobPosting.company_id

    const { data: membership } = await supabase
      .from('company_members')
      .select('role')
      .eq('user_id', userId)
      .eq('company_id', companyId)
      .eq('is_active', true)
      .single()

    let hasAccess = !!membership

    if (!hasAccess) {
      const { data: legacyCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('id', companyId)
        .eq('employer_user_id', userId)
        .single()
      hasAccess = !!legacyCompany
    }

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'You do not have access to this application' },
        { status: 403 }
      )
    }

    const { error: delErr } = await supabase.from('applications').delete().eq('id', applicationId)

    if (delErr) {
      console.error('[APPLICATION DELETE]', delErr)
      return NextResponse.json({ error: 'Failed to remove from pipeline' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[APPLICATION DELETE]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
