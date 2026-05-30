// app/api/resumes/[id]/route.ts
// Get, update, or delete a single resume by ID

import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getEmploymentFromResumes } from '@/lib/developer-employment-from-resumes'
import { getStormUserIdFromRequest } from '@/lib/auth-session'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const userId = await getStormUserIdFromRequest(req)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()

    // Get resume and verify ownership
    const { data: resume, error: resumeError } = await supabase
      .from('resumes')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (resumeError || !resume) {
      return NextResponse.json({ error: 'Resume not found' }, { status: 404 })
    }

    return NextResponse.json(resume)
  } catch (error) {
    console.error('❌ Resume API: Error fetching resume', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const userId = await getStormUserIdFromRequest(req)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()

    // Verify ownership before deleting
    const { data: resume, error: resumeError } = await supabase
      .from('resumes')
      .select('id, user_id, title, resume_type')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (resumeError || !resume) {
      return NextResponse.json({ error: 'Resume not found or access denied' }, { status: 404 })
    }

    const wasDeveloperBuilt = resume.resume_type === 'developer_built'

    // Delete the resume
    const { error: deleteError } = await supabase
      .from('resumes')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (deleteError) {
      console.error('❌ Resume API: Error deleting resume', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete resume' },
        { status: 500 }
      )
    }

    // If it was a developer resume, recompute employment_history from remaining resumes
    // so Employment Verification section no longer shows jobs from the deleted resume
    if (wasDeveloperBuilt) {
      const employmentHistory = await getEmploymentFromResumes(supabase, userId)
      const { saveDevProfile } = await import('@/lib/block-data')
      await saveDevProfile(supabase, userId, { employment_history: employmentHistory })
    }

    return NextResponse.json({ success: true, message: 'Resume deleted successfully' })
  } catch (error) {
    console.error('❌ Resume API: Error deleting resume', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
