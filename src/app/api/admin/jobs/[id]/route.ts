import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'

/**
 * DELETE /api/admin/jobs/[id]
 * Hard deletes a job posting (admin only).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request)
  if (!auth.authorized) return auth.error!

  try {
    const { id: jobId } = await params
    const supabase = await getAdminSupabaseClient()

    // Get job info for logging
    const { data: job } = await supabase
      .from('job_postings')
      .select('title, company_id')
      .eq('id', jobId)
      .single()

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Check for linked applications
    const { count: appCount } = await supabase
      .from('applications')
      .select('id', { count: 'exact', head: true })
      .eq('job_posting_id', jobId)

    // Check for linked invites
    const { count: inviteCount } = await supabase
      .from('application_invites')
      .select('id', { count: 'exact', head: true })
      .eq('job_posting_id', jobId)

    // Delete linked applications first (cascade)
    if (appCount && appCount > 0) {
      const { error: appDeleteError } = await supabase
        .from('applications')
        .delete()
        .eq('job_posting_id', jobId)

      if (appDeleteError) {
        console.error('[ADMIN JOBS DELETE] Failed to delete linked applications:', appDeleteError)
        return NextResponse.json({ 
          error: `Cannot delete: ${appCount} application(s) linked. Failed to remove them.` 
        }, { status: 500 })
      }
      console.log(`[ADMIN JOBS DELETE] Deleted ${appCount} linked applications`)
    }

    // Unlink invites (set job_posting_id to null rather than delete)
    if (inviteCount && inviteCount > 0) {
      const { error: inviteUpdateError } = await supabase
        .from('application_invites')
        .update({ job_posting_id: null })
        .eq('job_posting_id', jobId)

      if (inviteUpdateError) {
        console.error('[ADMIN JOBS DELETE] Failed to unlink invites:', inviteUpdateError)
      } else {
        console.log(`[ADMIN JOBS DELETE] Unlinked ${inviteCount} invites`)
      }
    }

    // Now delete the job
    const { error } = await supabase
      .from('job_postings')
      .delete()
      .eq('id', jobId)

    if (error) {
      console.error('[ADMIN JOBS DELETE] Error:', error)
      // Check for foreign key violation
      if (error.code === '23503') {
        return NextResponse.json({ 
          error: 'Cannot delete: Other records are still linked to this job.' 
        }, { status: 400 })
      }
      return NextResponse.json({ error: 'Failed to delete job' }, { status: 500 })
    }

    console.log(`[ADMIN JOBS DELETE] Deleted job "${job.title}" (${jobId}) by admin ${auth.email}`)

    return NextResponse.json({ success: true, message: 'Job deleted permanently' })
  } catch (error) {
    console.error('[ADMIN JOBS DELETE] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/jobs/[id]
 * Updates a job posting (admin can toggle active, etc.).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request)
  if (!auth.authorized) return auth.error!

  try {
    const { id: jobId } = await params
    const body = await request.json()
    const { isActive } = body

    const supabase = await getAdminSupabaseClient()

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (typeof isActive === 'boolean') {
      updates.is_active = isActive
    }

    const { data: job, error } = await supabase
      .from('job_postings')
      .update(updates)
      .eq('id', jobId)
      .select()
      .single()

    if (error) {
      console.error('[ADMIN JOBS PATCH] Error:', error)
      return NextResponse.json({ error: 'Failed to update job' }, { status: 500 })
    }

    console.log(`[ADMIN JOBS PATCH] Updated job "${job.title}" (${jobId}) by admin ${auth.email}`)

    return NextResponse.json({ success: true, job })
  } catch (error) {
    console.error('[ADMIN JOBS PATCH] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
