import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'
import { getInstallableEmployerBlockDefinitions, getEmployerBlockDefinition } from '@/lib/employer-block-registry'
import { logEmployerBlockAudit } from '@/lib/employer-block-audit'

async function resolveActorUserId(
  supabase: Awaited<ReturnType<typeof getAdminSupabaseClient>>,
  walletAddress: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('users')
    .select('id')
    .ilike('wallet_address', walletAddress)
    .maybeSingle()
  return data?.id ?? null
}

/**
 * GET /api/admin/companies/[id]/blocks — installed blocks + recent audit (Storm admin)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireAdmin(request)
  if (!auth.authorized) return auth.error!

  try {
    const { id: companyId } = await params
    if (!companyId) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()

    const { data: company, error: cErr } = await supabase
      .from('companies')
      .select('id')
      .eq('id', companyId)
      .maybeSingle()

    if (cErr || !company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const [{ data: blocks }, { data: auditRows }] = await Promise.all([
      supabase
        .from('employer_hub_blocks')
        .select('id, block_type, position, config, added_at')
        .eq('company_id', companyId)
        .order('position', { ascending: true }),
      supabase
        .from('employer_block_audit')
        .select('id, block_type, action, actor_kind, actor_user_id, reason, created_at')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(50),
    ])

    const actorIds = [...new Set((auditRows ?? []).map((r) => r.actor_user_id).filter(Boolean))] as string[]
    let emailMap = new Map<string, string>()
    if (actorIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, email')
        .in('id', actorIds)
      emailMap = new Map((users ?? []).map((u) => [u.id, u.email ?? '']))
    }

    const recentAudit = (auditRows ?? []).map((row) => ({
      ...row,
      actorEmail: row.actor_user_id ? emailMap.get(row.actor_user_id) ?? null : null,
    }))

    return NextResponse.json({
      success: true,
      blocks: blocks ?? [],
      recentAudit,
    })
  } catch (e) {
    console.error('[ADMIN COMPANY BLOCKS] GET:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/admin/companies/[id]/blocks — install block for company (Storm admin)
 * Body: { blockType: string, reason?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireAdmin(request)
  if (!auth.authorized) return auth.error!

  try {
    const { id: companyId } = await params
    if (!companyId) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 })
    }

    const body = await request.json()
    const blockType = typeof body.blockType === 'string' ? body.blockType.trim() : ''
    const reason = typeof body.reason === 'string' ? body.reason : null

    const allowedIds = new Set(getInstallableEmployerBlockDefinitions().map((b) => b.id))
    if (!blockType || !allowedIds.has(blockType)) {
      return NextResponse.json({ error: 'Invalid or non-installable block type' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()

    const { data: company, error: cErr } = await supabase
      .from('companies')
      .select('id')
      .eq('id', companyId)
      .maybeSingle()

    if (cErr || !company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const { count } = await supabase
      .from('employer_hub_blocks')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)

    const position = count ?? 0

    const { data: inserted, error: insErr } = await supabase
      .from('employer_hub_blocks')
      .insert({
        company_id: companyId,
        block_type: blockType,
        position,
        config: {},
      })
      .select('id, block_type, position, config, added_at')
      .single()

    if (insErr) {
      if (insErr.code === '23505') {
        return NextResponse.json({ error: 'This block is already installed' }, { status: 409 })
      }
      console.error('[ADMIN COMPANY BLOCKS] POST:', insErr.message)
      return NextResponse.json({ error: 'Failed to install block' }, { status: 500 })
    }

    const actorUserId = auth.walletAddress
      ? await resolveActorUserId(supabase, auth.walletAddress)
      : null

    await logEmployerBlockAudit(supabase, {
      companyId,
      blockType,
      action: 'installed',
      actorUserId,
      actorKind: 'storm_admin',
      reason,
    })

    return NextResponse.json({
      success: true,
      block: inserted,
      definition: getEmployerBlockDefinition(blockType) ?? null,
    })
  } catch (e) {
    console.error('[ADMIN COMPANY BLOCKS] POST:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
