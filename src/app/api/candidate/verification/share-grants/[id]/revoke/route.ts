import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'

/**
 * POST /api/candidate/verification/share-grants/[id]/revoke
 *
 * Forward-only in-platform revocation (v0.1 temporary rule — counsel has not
 * locked Option A/B). The employer view endpoint 403s from this moment on;
 * material they already viewed is outside platform control.
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
    const { id: grantId } = await params

    const supabase = await getAdminSupabaseClient()
    const { data: grant } = await supabase
      .from('ev_share_grants')
      .select('id, driver_user_id, share_request_id, revoked_at')
      .eq('id', grantId)
      .maybeSingle()

    if (!grant || grant.driver_user_id !== userId) {
      return NextResponse.json({ error: 'Share grant not found' }, { status: 404 })
    }
    if (grant.revoked_at) {
      return NextResponse.json({ success: true, status: 'revoked' })
    }

    const now = new Date().toISOString()
    await supabase.from('ev_share_grants').update({ revoked_at: now }).eq('id', grantId)
    await supabase
      .from('ev_share_requests')
      .update({ status: 'revoked', updated_at: now })
      .eq('id', grant.share_request_id)

    console.log(`[EV SHARE REVOKE] Grant ${grantId} revoked by driver ${userId}`)
    return NextResponse.json({ success: true, status: 'revoked' })
  } catch (error) {
    console.error('[EV SHARE REVOKE] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
