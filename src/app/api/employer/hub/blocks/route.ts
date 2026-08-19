import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { getEmployerCompanyAccess } from '@/lib/employer-company-access'
import { getInstallableEmployerBlockDefinitions, getEmployerBlockDefinition } from '@/lib/employer-block-registry'
import { logEmployerBlockAudit } from '@/lib/employer-block-audit'
import { capabilityDeniedMessage } from '@/lib/employer-permissions'

/**
 * GET /api/employer/hub/blocks — installed employer blocks.
 *
 * Employer blocks are preinstalled: every installable block is auto-provisioned
 * for the company on first load (idempotent — only missing rows are inserted).
 * Real DB rows are required because order-time API guards (companyCanOrderMvr,
 * companyCanOrderPsp, …) read employer_hub_blocks.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()
    const access = await getEmployerCompanyAccess(supabase, userId)
    if (!access) {
      return NextResponse.json({ error: 'No company access' }, { status: 403 })
    }

    const { data: existing, error: blocksErr } = await supabase
      .from('employer_hub_blocks')
      .select('id, block_type, position, config, added_at')
      .eq('company_id', access.companyId)
      .order('position', { ascending: true })

    if (blocksErr) {
      console.error('[EMPLOYER HUB BLOCKS] GET:', blocksErr.message)
      return NextResponse.json({ error: 'Failed to load blocks' }, { status: 500 })
    }

    let blocks = existing ?? []
    const installedTypes = new Set(blocks.map((b) => b.block_type))
    const missing = getInstallableEmployerBlockDefinitions().filter(
      (def) => !installedTypes.has(def.id),
    )

    if (missing.length > 0) {
      const basePosition = blocks.length
      const { error: seedErr } = await supabase.from('employer_hub_blocks').insert(
        missing.map((def, i) => ({
          company_id: access.companyId,
          block_type: def.id,
          position: basePosition + i,
          config: {},
        })),
      )
      if (seedErr) {
        // 23505 = another request seeded concurrently — safe to ignore and refetch
        if (seedErr.code !== '23505') {
          console.error('[EMPLOYER HUB BLOCKS] auto-provision:', seedErr.message)
        }
      } else {
        for (const def of missing) {
          await logEmployerBlockAudit(supabase, {
            companyId: access.companyId,
            blockType: def.id,
            action: 'installed',
            actorUserId: null,
            actorKind: 'storm_admin',
            reason: 'Auto-provisioned — employer blocks are preinstalled by default',
          })
        }
      }

      const { data: refreshed } = await supabase
        .from('employer_hub_blocks')
        .select('id, block_type, position, config, added_at')
        .eq('company_id', access.companyId)
        .order('position', { ascending: true })
      blocks = refreshed ?? blocks
    }

    return NextResponse.json({
      success: true,
      blocks,
    })
  } catch (e) {
    console.error('[EMPLOYER HUB BLOCKS] GET unexpected:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/employer/hub/blocks — install (owner/admin only)
 * Body: { blockType: string, reason?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const blockType = typeof body.blockType === 'string' ? body.blockType.trim() : ''
    const reason = typeof body.reason === 'string' ? body.reason : null

    const allowedIds = new Set(getInstallableEmployerBlockDefinitions().map((b) => b.id))
    if (!blockType || !allowedIds.has(blockType)) {
      return NextResponse.json({ error: 'Invalid or non-installable block type' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()
    const access = await getEmployerCompanyAccess(supabase, userId)
    if (!access) {
      return NextResponse.json({ error: 'No company access' }, { status: 403 })
    }
    // canManageEmployerBlocks was hardcoded true until 2026-08-11, so this
    // owner/admin restriction is newly real rather than newly written.
    if (!access.canManageEmployerBlocks) {
      return NextResponse.json(
        { error: capabilityDeniedMessage('manageCompany') },
        { status: 403 }
      )
    }

    const { count } = await supabase
      .from('employer_hub_blocks')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', access.companyId)

    const position = count ?? 0

    const { data: inserted, error: insErr } = await supabase
      .from('employer_hub_blocks')
      .insert({
        company_id: access.companyId,
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
      console.error('[EMPLOYER HUB BLOCKS] POST insert:', insErr.message)
      return NextResponse.json({ error: 'Failed to install block' }, { status: 500 })
    }

    const actorKind = access.companyRole === 'owner' ? 'company_owner' : 'company_admin'

    await logEmployerBlockAudit(supabase, {
      companyId: access.companyId,
      blockType,
      action: 'installed',
      actorUserId: access.employerUserId,
      actorKind,
      reason,
    })

    return NextResponse.json({
      success: true,
      block: inserted,
      definition: getEmployerBlockDefinition(blockType) ?? null,
    })
  } catch (e) {
    console.error('[EMPLOYER HUB BLOCKS] POST unexpected:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
