import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getUserByWallet } from '@/lib/user-by-wallet'
import { getEmployerBlockDefinition } from '@/lib/employer-block-registry'

/**
 * Resolve the caller's company_id via company_members (or legacy employer_user_id).
 * Returns { companyId, userRole } or null if no company membership found.
 */
async function resolveCompany(supabase: Awaited<ReturnType<typeof getAdminSupabaseClient>>, userId: string) {
  // Team-based lookup first
  const { data: membership } = await supabase
    .from('company_members')
    .select('role, company_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()

  if (membership) {
    return { companyId: membership.company_id as string, userRole: membership.role as string }
  }

  // Legacy single-owner fallback
  const { data: legacyCompany } = await supabase
    .from('companies')
    .select('id')
    .eq('employer_user_id', userId)
    .maybeSingle()

  if (legacyCompany) {
    return { companyId: legacyCompany.id as string, userRole: 'owner' }
  }

  return null
}

/**
 * GET /api/employer/blocks
 *
 * Returns the employer's installed composable blocks (sorted by position)
 * plus the resolved companyId for the store.
 */
export async function GET(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()
    const user = await getUserByWallet(supabase, walletAddress)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const company = await resolveCompany(supabase, user.id)
    if (!company) {
      return NextResponse.json({ blocks: [], companyId: null })
    }

    const { data: blocks, error } = await supabase
      .from('employer_hub_blocks')
      .select('id, block_type, position, config, added_at')
      .eq('company_id', company.companyId)
      .order('position', { ascending: true })

    if (error) {
      // PGRST205 = table not found — migration hasn't been run yet. Gracefully return empty.
      if (error.code === 'PGRST205') {
        return NextResponse.json({ blocks: [], companyId: company.companyId })
      }
      console.error('[EMPLOYER BLOCKS] Fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch employer blocks' }, { status: 500 })
    }

    return NextResponse.json({
      blocks: blocks ?? [],
      companyId: company.companyId,
    })
  } catch (err) {
    console.error('[EMPLOYER BLOCKS] GET unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/employer/blocks
 *
 * Adds a composable block to the employer hub. Validates the block type exists
 * in the employer registry and that the company doesn't already have it.
 *
 * Body: { blockType: string, position?: number }
 */
export async function POST(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 401 })
    }

    const body = await request.json()
    const { blockType, position = 0 } = body

    if (!blockType || typeof blockType !== 'string') {
      return NextResponse.json({ error: 'blockType is required' }, { status: 400 })
    }

    const definition = getEmployerBlockDefinition(blockType)
    if (!definition) {
      return NextResponse.json({ error: `Unknown employer block type: ${blockType}` }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()
    const user = await getUserByWallet(supabase, walletAddress)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const company = await resolveCompany(supabase, user.id)
    if (!company) {
      return NextResponse.json({ error: 'No company found for this user' }, { status: 403 })
    }

    const { data: block, error } = await supabase
      .from('employer_hub_blocks')
      .insert({
        company_id: company.companyId,
        block_type: blockType,
        position,
        config: {},
      })
      .select('id, block_type, position, config, added_at')
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: `Block '${blockType}' is already installed` }, { status: 409 })
      }
      console.error('[EMPLOYER BLOCKS] Insert error:', error)
      return NextResponse.json({ error: 'Failed to add block' }, { status: 500 })
    }

    return NextResponse.json({ block }, { status: 201 })
  } catch (err) {
    console.error('[EMPLOYER BLOCKS] POST unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
