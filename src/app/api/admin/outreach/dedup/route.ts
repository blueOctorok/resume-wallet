import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'

/**
 * POST /api/admin/outreach/dedup
 *
 * Cancels stale per-block invites (driver-psp, driver-mvr) where the SAME
 * candidate already has a driver-screening-consent invite from the same company.
 *
 * The unified consent flow supersedes the old per-block invites. These duplicates
 * show as two separate cards on the kanban board.
 *
 * Query param:
 *   ?dry=true — returns what would be cancelled without changing anything
 */
export async function POST(request: NextRequest) {
  const auth = requireAdmin(request)
  if (!auth.authorized) return auth.error!

  const { searchParams } = new URL(request.url)
  const dryRun = searchParams.get('dry') === 'true'

  try {
    const supabase = await getAdminSupabaseClient()

    // Find all screening-consent invites (new flow)
    const { data: consentInvites, error: fetchErr } = await supabase
      .from('application_invites')
      .select('id, candidate_email, company_id, used_by_user_id')
      .eq('target_block_type', 'driver-screening-consent')
      .in('status', ['pending', 'in_progress', 'viewed', 'completed'])

    if (fetchErr || !consentInvites) {
      return NextResponse.json({ error: 'Failed to query consent invites' }, { status: 500 })
    }

    // Build a set of (email+company) or (user_id+company) for candidates who have consent invites
    const consentKeys = new Set<string>()
    for (const inv of consentInvites) {
      const email = (inv.candidate_email ?? '').trim().toLowerCase()
      if (email) consentKeys.add(`email:${email}:${inv.company_id}`)
      if (inv.used_by_user_id) consentKeys.add(`uid:${inv.used_by_user_id}:${inv.company_id}`)
    }

    // Find old-style driver-psp/driver-mvr invites that overlap
    const { data: oldInvites, error: oldErr } = await supabase
      .from('application_invites')
      .select('id, candidate_name, candidate_email, company_id, target_block_type, status, used_by_user_id')
      .in('target_block_type', ['driver-psp', 'driver-mvr'])
      .in('status', ['pending', 'in_progress', 'viewed'])

    if (oldErr || !oldInvites) {
      return NextResponse.json({ error: 'Failed to query old invites' }, { status: 500 })
    }

    const toCancel: Array<{ id: string; candidateName: string; email: string; blockType: string }> = []
    for (const inv of oldInvites) {
      const email = (inv.candidate_email ?? '').trim().toLowerCase()
      const matchByEmail = email && consentKeys.has(`email:${email}:${inv.company_id}`)
      const matchByUid = inv.used_by_user_id && consentKeys.has(`uid:${inv.used_by_user_id}:${inv.company_id}`)

      if (matchByEmail || matchByUid) {
        toCancel.push({
          id: inv.id as string,
          candidateName: inv.candidate_name as string,
          email: inv.candidate_email as string,
          blockType: inv.target_block_type as string,
        })
      }
    }

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        wouldCancel: toCancel.length,
        invites: toCancel,
      })
    }

    if (toCancel.length === 0) {
      return NextResponse.json({ cancelled: 0, message: 'No duplicates found' })
    }

    const ids = toCancel.map((i) => i.id)
    const { error: updateErr } = await supabase
      .from('application_invites')
      .update({ status: 'cancelled' })
      .in('id', ids)

    if (updateErr) {
      console.error('[ADMIN DEDUP] Update error:', updateErr)
      return NextResponse.json({ error: 'Failed to cancel duplicates' }, { status: 500 })
    }

    console.log(`[ADMIN DEDUP] Cancelled ${toCancel.length} stale per-block invites`)
    return NextResponse.json({
      cancelled: toCancel.length,
      invites: toCancel,
    })
  } catch (e) {
    console.error('[ADMIN DEDUP]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
