import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'

/**
 * GET /api/admin/resumes/[id]
 * Get detailed resume information
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

    const { data: resume, error } = await supabase
      .from('resumes')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !resume) {
      return NextResponse.json({ error: 'Resume not found' }, { status: 404 })
    }

    // Get user info
    const [{ data: user }, { data: up }] = await Promise.all([
      supabase.from('users').select('wallet_address, email').eq('id', resume.user_id).single(),
      supabase.from('user_profiles').select('first_name, last_name').eq('user_id', resume.user_id).maybeSingle(),
    ])

    const profileName = [up?.first_name, up?.last_name].filter(Boolean).join(' ').trim() || null

    return NextResponse.json({
      success: true,
      resume: {
        ...resume,
        walletAddress: user?.wallet_address,
        email: user?.email,
        userName: profileName,
      },
    })

  } catch (error) {
    console.error('[ADMIN RESUME DETAIL] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/resumes/[id]
 * Delete a specific resume
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

    // Verify resume exists and get user_id for developer employment recompute
    const { data: resume, error: findError } = await supabase
      .from('resumes')
      .select('id, user_id, title, filename, resume_type')
      .eq('id', id)
      .single()

    if (findError || !resume) {
      return NextResponse.json({ error: 'Resume not found' }, { status: 404 })
    }

    const wasDeveloperBuilt = resume.resume_type === 'developer_built'
    const resumeUserId = resume.user_id

    // Check if any applications reference this resume - block deletion if so
    const { data: linkedApps, error: appCheckError } = await supabase
      .from('applications')
      .select('id, job_postings(title, companies(company_name))')
      .eq('resume_id', id)

    if (appCheckError) {
      console.error('[ADMIN RESUME DELETE] Error checking applications:', appCheckError)
    }

    if (linkedApps && linkedApps.length > 0) {
      // Build a helpful message showing which applications are linked
      const appDetails = linkedApps.map((app: any) => {
        const jobTitle = app.job_postings?.title || 'Unknown Job'
        const companyName = app.job_postings?.companies?.company_name || 'Unknown Company'
        return `${jobTitle} at ${companyName}`
      }).join(', ')

      return NextResponse.json({ 
        error: `Cannot delete: resume is linked to ${linkedApps.length} job application(s)`,
        details: `Linked applications: ${appDetails}. Delete these applications first, or remove the resume from them.`,
        linkedApplicationCount: linkedApps.length,
      }, { status: 409 })
    }

    // Safe to delete - no linked applications
    const { error: deleteError } = await supabase
      .from('resumes')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('[ADMIN RESUME DELETE] Error:', deleteError)
      // Check if it's a foreign key violation from another table
      if (deleteError.code === '23503') {
        return NextResponse.json({ 
          error: 'Cannot delete: resume is still referenced by other records',
          details: deleteError.details 
        }, { status: 409 })
      }
      return NextResponse.json({ error: 'Failed to delete resume' }, { status: 500 })
    }

    if (wasDeveloperBuilt && resumeUserId) {
      const { getEmploymentFromResumes } = await import('@/lib/developer-employment-from-resumes')
      const employmentHistory = await getEmploymentFromResumes(supabase, resumeUserId)
      await supabase
        .from('developer_profiles')
        .update({
          employment_history: employmentHistory,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', resumeUserId)
    }

    console.log(`[ADMIN] Resume deleted: ${id} (${resume.title || resume.filename}) by admin: ${auth.walletAddress}`)

    return NextResponse.json({
      success: true,
      message: `Resume "${resume.title || resume.filename}" deleted`,
    })

  } catch (error) {
    console.error('[ADMIN RESUME DELETE] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
