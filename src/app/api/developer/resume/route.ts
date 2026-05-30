import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import type { SupabaseClient } from '@supabase/supabase-js'
import { saveDevProfile } from '@/lib/block-data'

/**
 * Map developer resume "experience" to block_dev_profile.employment_history
 * so the Employment Verification section can show and verify these jobs.
 */
async function syncStructuredDataToDevProfile(
  supabase: SupabaseClient,
  userId: string,
  structuredData: {
    personalInfo?: { summary?: string }
    experience?: Array<{
      id: string
      company: string
      title: string
      location?: string
      startDate?: string
      endDate?: string
      isCurrent?: boolean
      description?: string
    }>
  },
) {
  const experience = structuredData?.experience
  const summary = structuredData?.personalInfo?.summary?.trim()

  const employmentHistory =
    experience?.map((exp) => ({
      id: exp.id,
      companyName: exp.company || '',
      position: exp.title || '',
      location: exp.location || '',
      startDate: exp.startDate || '',
      endDate: exp.isCurrent ? '' : (exp.endDate || ''),
      description: exp.description || undefined,
    })) ?? null

  const payload: Parameters<typeof saveDevProfile>[2] = {}
  if (summary) payload.bio = summary
  if (employmentHistory?.length) payload.employment_history = employmentHistory

  if (Object.keys(payload).length === 0) return

  try {
    await saveDevProfile(supabase, userId, payload)
  } catch (err) {
    console.warn('[DEVELOPER RESUME] Failed to sync to block_dev_profile:', err)
  }
}

/**
 * POST /api/developer/resume
 * Create a new developer resume
 *
 * PUT /api/developer/resume
 * Update an existing developer resume
 */

export async function POST(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const { structuredData, title } = body

    if (!structuredData) {
      return NextResponse.json(
        { error: 'Structured data is required' },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    // Create new resume
    const { data: resume, error: createError } = await supabase
      .from('resumes')
      .insert({
        user_id: userId,
        title: title || 'Developer Resume',
        filename: `${structuredData.personalInfo?.firstName || 'Developer'}_${structuredData.personalInfo?.lastName || 'Resume'}.pdf`,
        resume_type: 'developer_built',
        source_role: 'developer',
        structured_data: structuredData,
        ipfs_hash: 'pending', // Will be set during verification
        verification_status: 'PENDING',
      })
      .select('id')
      .single()

    if (createError) {
      console.error('[DEVELOPER RESUME] Create error:', createError)
      return NextResponse.json(
        { error: 'Failed to create resume' },
        { status: 500 }
      )
    }

    await syncStructuredDataToDevProfile(supabase, userId, structuredData)

    return NextResponse.json({
      success: true,
      resumeId: resume.id,
      message: 'Resume created successfully',
    })
  } catch (error) {
    console.error('[DEVELOPER RESUME] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const { resumeId, structuredData, title } = body

    if (!resumeId || !structuredData) {
      return NextResponse.json(
        { error: 'Resume ID and structured data are required' },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    // Verify ownership
    const { data: existing, error: checkError } = await supabase
      .from('resumes')
      .select('id, user_id')
      .eq('id', resumeId)
      .single()

    if (checkError || !existing) {
      return NextResponse.json({ error: 'Resume not found' }, { status: 404 })
    }

    if (existing.user_id !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Update resume
    const updateData: Record<string, unknown> = {
      structured_data: structuredData,
      filename: `${structuredData.personalInfo?.firstName || 'Developer'}_${structuredData.personalInfo?.lastName || 'Resume'}.pdf`,
    }

    if (title) {
      updateData.title = title
    }

    const { error: updateError } = await supabase
      .from('resumes')
      .update(updateData)
      .eq('id', resumeId)

    if (updateError) {
      console.error('[DEVELOPER RESUME] Update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update resume' },
        { status: 500 }
      )
    }

    await syncStructuredDataToDevProfile(supabase, userId, structuredData)

    return NextResponse.json({
      success: true,
      resumeId,
      message: 'Resume updated successfully',
    })
  } catch (error) {
    console.error('[DEVELOPER RESUME] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/developer/resume
 * Get all developer resumes for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    // Get developer resumes
    const { data: resumes, error: resumesError } = await supabase
      .from('resumes')
      .select('*')
      .eq('user_id', userId)
      .eq('source_role', 'developer')
      .order('created_at', { ascending: false })

    if (resumesError) {
      console.error('[DEVELOPER RESUME] Fetch error:', resumesError)
      return NextResponse.json(
        { error: 'Failed to fetch resumes' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      resumes: resumes || [],
    })
  } catch (error) {
    console.error('[DEVELOPER RESUME] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
