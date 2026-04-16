import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getUserByWallet } from '@/lib/user-by-wallet'
import { getBlockDefinition } from '@/lib/block-registry'

/**
 * GET /api/hub/blocks
 *
 * Returns the authenticated user's installed hub blocks (sorted by position)
 * and their onboarding data (if completed).
 *
 * Response: { blocks: HubBlock[], onboarding: HubOnboarding | null }
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

    const [blocksResult, onboardingResult, profileResult] = await Promise.all([
      supabase
        .from('hub_blocks')
        .select('id, block_type, position, config, added_at')
        .eq('user_id', user.id)
        .order('position', { ascending: true }),
      supabase
        .from('hub_onboarding')
        .select('occupation, seeking_reason, suggested_categories, extra_context, completed_at, updated_at')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('user_profiles')
        .select('first_name, last_name, avatar_url, headline')
        .eq('user_id', user.id)
        .maybeSingle(),
    ])

    if (blocksResult.error) {
      console.error('[HUB BLOCKS] Fetch error:', blocksResult.error)
      return NextResponse.json({ error: 'Failed to fetch hub blocks' }, { status: 500 })
    }

    const u = user as {
      ava_auto_welcome_candidate_at?: string | null
      stormi_walkthrough_dismissed_at?: string | null
    }

    return NextResponse.json({
      blocks: blocksResult.data ?? [],
      onboarding: onboardingResult.data ?? null,
      profile: profileResult.data ?? null,
      avaAutoWelcomeCandidateDone: Boolean(u.ava_auto_welcome_candidate_at),
      walkthroughDismissed: Boolean(u.stormi_walkthrough_dismissed_at),
    })
  } catch (err) {
    console.error('[HUB BLOCKS] GET unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/hub/blocks
 *
 * Adds a block to the user's hub. Validates the block type exists in the
 * registry and that the user doesn't already have this block.
 *
 * Body: { blockType: string, position: number }
 * Response: { block: HubBlock }
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

    // Validate the block type exists in our registry — prevents junk data
    const definition = getBlockDefinition(blockType)
    if (!definition) {
      return NextResponse.json({ error: `Unknown block type: ${blockType}` }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()
    const user = await getUserByWallet(supabase, walletAddress)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { data: block, error } = await supabase
      .from('hub_blocks')
      .insert({
        user_id: user.id,
        block_type: blockType,
        position,
        config: {},
      })
      .select('id, block_type, position, config, added_at')
      .single()

    if (error) {
      // Unique constraint violation — block already installed
      if (error.code === '23505') {
        return NextResponse.json({ error: `Block '${blockType}' is already in your hub` }, { status: 409 })
      }
      console.error('[HUB BLOCKS] Insert error:', error)
      return NextResponse.json({ error: 'Failed to add block' }, { status: 500 })
    }

    return NextResponse.json({ block }, { status: 201 })
  } catch (err) {
    console.error('[HUB BLOCKS] POST unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
