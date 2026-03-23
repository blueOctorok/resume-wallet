import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'

/**
 * GET /api/admin/applications/[id]
 * Get detailed application information
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAdmin(request)
  if (!auth.authorized) return auth.error!

  const { id } = await params

  try {
    const supabase = await getAdminSupabaseClient()

    const { data: application, error } = await supabase
      .from('applications')
      .select(`
        *,
        job_postings(*, companies(*)),
        users!applications_driver_user_id_fkey(*),
        resumes(*),
        driver_applications(*)
      `)
      .eq('id', id)
      .single()

    if (error || !application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      application,
    })

  } catch (error) {
    console.error('[ADMIN APPLICATION DETAIL] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/applications/[id]
 * Update application status
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAdmin(request)
  if (!auth.authorized) return auth.error!

  const { id } = await params

  try {
    const supabase = await getAdminSupabaseClient()
    const body = await request.json()
    const { status } = body

    const validStatuses = ['submitted', 'contacted', 'archived']
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const { data: application, error } = await supabase
      .from('applications')
      .update({ 
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[ADMIN APPLICATION UPDATE] Error:', error)
      return NextResponse.json({ error: 'Failed to update application' }, { status: 500 })
    }

    console.log(`[ADMIN] Application ${id} status updated to ${status} by admin: ${auth.walletAddress}`)

    return NextResponse.json({
      success: true,
      application,
    })

  } catch (error) {
    console.error('[ADMIN APPLICATION UPDATE] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/applications/[id]
 * Delete a job application
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAdmin(request)
  if (!auth.authorized) return auth.error!

  const { id } = await params

  try {
    const supabase = await getAdminSupabaseClient()

    // Get application details for logging
    // Note: Column renamed from driver_user_id to applicant_user_id in migration 016
    const { data: application, error: findError } = await supabase
      .from('applications')
      .select(`
        id, status, applicant_user_id,
        job_postings(title)
      `)
      .eq('id', id)
      .single()

    if (findError || !application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    // Get user info separately
    let userName = 'Unknown'
    if (application.applicant_user_id) {
      const [{ data: user }, { data: up }] = await Promise.all([
        supabase.from('users').select('email').eq('id', application.applicant_user_id).single(),
        supabase.from('user_profiles').select('first_name, last_name').eq('user_id', application.applicant_user_id).maybeSingle(),
      ])
      const profileName = [up?.first_name, up?.last_name].filter(Boolean).join(' ').trim() || null
      userName = profileName || user?.email || 'Unknown'
    }

    // Delete the application
    const { error: deleteError } = await supabase
      .from('applications')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('[ADMIN APPLICATION DELETE] Error:', deleteError)
      return NextResponse.json({ error: 'Failed to delete application' }, { status: 500 })
    }

    const jobTitle = (application as any).job_postings?.title || 'Unknown Job'

    console.log(`[ADMIN] Application deleted: ${id} (${userName} -> ${jobTitle}) by admin: ${auth.walletAddress}`)

    return NextResponse.json({
      success: true,
      message: `Application from ${userName} to "${jobTitle}" deleted`,
    })

  } catch (error) {
    console.error('[ADMIN APPLICATION DELETE] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
