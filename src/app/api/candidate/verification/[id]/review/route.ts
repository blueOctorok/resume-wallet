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
      onResume?: boolean
    }

    const supabase = await getAdminSupabaseClient()
    const patch: Record<string, unknown> = {}
    if (body.reviewed === true) patch.driver_reviewed_at = new Date().toISOString()
    if (typeof body.hidden === 'boolean') patch.driver_hidden = body.hidden

    if (typeof body.onResume === 'boolean') {
      if (!body.onResume) {
        patch.resume_accepted_at = null
      } else {
        const { data: current, error: readError } = await supabase
          .from('employment_verification_requests')
          .select('dkim_valid, dkim_domain, status, driver_hidden')
          .eq('id', id)
          .eq('driver_id', userId)
          .maybeSingle()
        if (readError) {
          console.error('[EVR REVIEW]', readError)
          return NextResponse.json({ error: 'Failed to save review' }, { status: 500 })
        }
        if (!current) {
          return NextResponse.json({ error: 'Verification request not found' }, { status: 404 })
        }
        const signed =
          current.dkim_valid === true &&
          Boolean(String(current.dkim_domain ?? '').trim()) &&
          (current.status === 'VERIFIED' || current.status === 'PARTIALLY_VERIFIED') &&
          current.driver_hidden !== true
        if (!signed) {
          return NextResponse.json(
            { error: 'A resume proof needs a DKIM-signed reply from the employer domain' },
            { status: 400 },
          )
        }
        patch.resume_accepted_at = new Date().toISOString()
      }
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('employment_verification_requests')
      .update(patch)
      .eq('id', id)
      .eq('driver_id', userId)
      .select('id, driver_reviewed_at, driver_hidden, resume_accepted_at')
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
