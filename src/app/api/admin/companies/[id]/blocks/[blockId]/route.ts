import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'
import { logEmployerBlockAudit } from '@/lib/employer-block-audit'

/**
 * DELETE /api/admin/companies/[id]/blocks/[blockId]
 * blockId = employer_hub_blocks.id (UUID). Reason required for audit trail.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; blockId: string }> },
) {
  const auth = await requireAdmin(request)
  if (!auth.authorized) return auth.error!

  try {
    const { id: companyId, blockId: rowId } = await params
    if (!companyId || !rowId) {
      return NextResponse.json({ error: 'Company ID and block id are required' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
    if (reason.length < 3) {
      return NextResponse.json(
        { error: 'A short reason is required (at least 3 characters) for the audit log.' },
        { status: 400 },
      )
    }

    const supabase = await getAdminSupabaseClient()

    const { data: row, error: fetchErr } = await supabase
      .from('employer_hub_blocks')
      .select('id, company_id, block_type')
      .eq('id', rowId)
      .maybeSingle()

    if (fetchErr || !row) {
      return NextResponse.json({ error: 'Block not found' }, { status: 404 })
    }

    if (row.company_id !== companyId) {
      return NextResponse.json({ error: 'Block does not belong to this company' }, { status: 400 })
    }

    const { error: delErr } = await supabase.from('employer_hub_blocks').delete().eq('id', rowId)

    if (delErr) {
      console.error('[ADMIN COMPANY BLOCKS] DELETE:', delErr.message)
      return NextResponse.json({ error: 'Failed to remove block' }, { status: 500 })
    }

    await logEmployerBlockAudit(supabase, {
      companyId,
      blockType: row.block_type,
      action: 'removed',
      actorUserId: auth.userId,
      actorKind: 'storm_admin',
      reason,
    })

    return NextResponse.json({ success: true, dataPreserved: true })
  } catch (e) {
    console.error('[ADMIN COMPANY BLOCKS] DELETE:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
