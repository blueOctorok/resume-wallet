import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { getEmployerCompanyAccess } from '@/lib/employer-company-access'
import { logEmployerBlockAudit } from '@/lib/employer-block-audit'

/**
 * DELETE /api/employer/hub/blocks/[id] — uninstall row by id (owner/admin only).
 * Paid / historical data in mvr_orders, psp_orders, consents, etc. is NOT deleted.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { id: rowId } = await params
    if (!rowId) {
      return NextResponse.json({ error: 'Block id is required' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()
    const { data: authUser } = await supabase
      .from('users')
      .select('wallet_address')
      .eq('id', userId)
      .maybeSingle()
    if (!authUser?.wallet_address) {
      return NextResponse.json({ error: 'Only active company members can remove blocks' }, { status: 403 })
    }
    const access = await getEmployerCompanyAccess(supabase, authUser.wallet_address)
    if (!access?.canManageEmployerBlocks) {
      return NextResponse.json({ error: 'Only active company members can remove blocks' }, { status: 403 })
    }

    const { data: row, error: fetchErr } = await supabase
      .from('employer_hub_blocks')
      .select('id, company_id, block_type')
      .eq('id', rowId)
      .maybeSingle()

    if (fetchErr || !row) {
      return NextResponse.json({ error: 'Block not found' }, { status: 404 })
    }

    if (row.company_id !== access.companyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const reason = typeof body.reason === 'string' ? body.reason : null

    const { error: delErr } = await supabase.from('employer_hub_blocks').delete().eq('id', rowId)

    if (delErr) {
      console.error('[EMPLOYER HUB BLOCKS] DELETE:', delErr.message)
      return NextResponse.json({ error: 'Failed to remove block' }, { status: 500 })
    }

    const actorKind = access.companyRole === 'owner' ? 'company_owner' : 'company_admin'

    await logEmployerBlockAudit(supabase, {
      companyId: access.companyId,
      blockType: row.block_type,
      action: 'removed',
      actorUserId: access.employerUserId,
      actorKind,
      reason,
    })

    return NextResponse.json({ success: true, dataPreserved: true })
  } catch (e) {
    console.error('[EMPLOYER HUB BLOCKS] DELETE unexpected:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
