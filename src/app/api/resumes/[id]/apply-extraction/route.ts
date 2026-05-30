import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { saveExtractedResumeData } from '@/lib/block-data'
import type { ParsedResumeExtraction } from '@/types/resume-extraction'

/**
 * POST /api/resumes/[id]/apply-extraction
 * Body: { extraction: ParsedResumeExtraction } — same shape returned by /api/ai/parse-resume.
 * No AI cost; merges into blocks + user_profiles + resumes.structured_data.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const extraction = body.extraction as ParsedResumeExtraction | undefined
    if (!extraction || typeof extraction !== 'object') {
      return NextResponse.json({ error: 'extraction object is required' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()

    const { data: resume, error: resErr } = await supabase
      .from('resumes')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle()

    if (resErr || !resume) {
      return NextResponse.json({ error: 'Resume not found' }, { status: 404 })
    }

    const result = await saveExtractedResumeData(supabase, userId, resume.id, extraction)

    return NextResponse.json({
      success: true,
      newlyInstalledBlocks: result.newlyInstalledBlocks,
      updated: result.updated,
    })
  } catch (e) {
    console.error('[APPLY EXTRACTION]', e)
    return NextResponse.json({ error: 'Failed to apply extraction' }, { status: 500 })
  }
}
