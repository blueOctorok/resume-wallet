import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getStormUserIdFromRequest } from '@/lib/auth-session'

/**
 * PATCH /api/applications/status
 *
 * Candidate self-reports the outcome of an external application.
 * Separate from the employer-controlled `status` column — this is the
 * candidate's own record of what happened after they applied.
 */

const VALID_STATUSES = ['waiting', 'interview', 'rejected', 'offer', 'no_response'] as const
type CandidateStatus = (typeof VALID_STATUSES)[number]

export async function PATCH(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { applicationId, candidateStatus } = (await request.json()) as {
      applicationId?: string
      candidateStatus?: string
    }

    if (!applicationId || !candidateStatus) {
      return NextResponse.json({ error: 'applicationId and candidateStatus are required' }, { status: 400 })
    }

    if (!VALID_STATUSES.includes(candidateStatus as CandidateStatus)) {
      return NextResponse.json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 })
    }

    const supabase = await createClient()

    const { error: updateError } = await supabase
      .from('applications')
      .update({ candidate_status: candidateStatus })
      .eq('id', applicationId)
      .eq('applicant_user_id', userId)

    if (updateError) {
      console.error('[APPLICATION STATUS] Update error:', updateError)
      return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[APPLICATION STATUS] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
