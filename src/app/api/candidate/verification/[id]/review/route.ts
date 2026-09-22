import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'

/**
 * PATCH /api/candidate/verification/[id]/review
 * Driver review / hide after a packet comes back.
 *
 * Sharing is NOT handled here anymore: per-employer Step 6 grants
 * (docs/EV_CONSENT_STACK.md) replaced the global share/hold toggle. The
 * legacy driver_share_consent column stays for history but no surface
 * reads it.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { id } = await params
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const body = (await request.json()) as {
      reviewed?: boolean
      hidden?: boolean
    }

    const patch: Record<string, unknown> = {}
    if (body.reviewed === true) patch.driver_reviewed_at = new Date().toISOString()
    if (typeof body.hidden === 'boolean') patch.driver_hidden = body.hidden

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()
    const { data, error } = await supabase
      .from('employment_verification_requests')
      .update(patch)
      .eq('id', id)
      .eq('driver_id', userId)
      .select('id, driver_reviewed_at, driver_hidden')
      .maybeSingle()

    if (error) {
      console.error('[EVR REVIEW]', error)
      return NextResponse.json({ error: 'Failed to save review' }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json({ error: 'Verification request not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, review: data })
  } catch (error) {
    console.error('[EVR REVIEW]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
