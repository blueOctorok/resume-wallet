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
    const { data: user } = await supabase
      .from('users')
      .select('wallet_address, email, name')
      .eq('id', resume.user_id)
      .single()

    return NextResponse.json({
      success: true,
      resume: {
        ...resume,
        walletAddress: user?.wallet_address,
        email: user?.email,
        userName: user?.name,
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

    // Delete the resume
    const { error: deleteError } = await supabase
      .from('resumes')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('[ADMIN RESUME DELETE] Error:', deleteError)
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
