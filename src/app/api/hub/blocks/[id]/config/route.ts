import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getUserByWallet } from '@/lib/user-by-wallet'

/**
 * PATCH /api/hub/blocks/[id]/config
 *
 * Merges `body.config` into `hub_blocks.config` JSONB for the row owned by the wallet user.
 * Used for card pagination (`cardPage`) and other minimal block-level display flags.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 401 })
    }

    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Block ID is required' }, { status: 400 })
    }

    const body = (await request.json()) as { config?: Record<string, unknown> }
    const patch = body.config
    if (!patch || typeof patch !== 'object') {
      return NextResponse.json({ error: 'config object is required' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()
    const user = await getUserByWallet(supabase, walletAddress)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { data: row, error: fetchErr } = await supabase
      .from('hub_blocks')
      .select('id, config')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (fetchErr) {
      console.error('[HUB BLOCK CONFIG] Fetch error:', fetchErr)
      return NextResponse.json({ error: 'Failed to read block' }, { status: 500 })
    }
    if (!row) {
      return NextResponse.json({ error: 'Block not found' }, { status: 404 })
    }

    const prev = (row.config as Record<string, unknown> | null) ?? {}
    const next = { ...prev, ...patch }

    const { error: updateErr } = await supabase
      .from('hub_blocks')
      .update({ config: next })
      .eq('id', id)
      .eq('user_id', user.id)

    if (updateErr) {
      console.error('[HUB BLOCK CONFIG] Update error:', updateErr)
      return NextResponse.json({ error: 'Failed to update config' }, { status: 500 })
    }

    return NextResponse.json({ success: true, config: next })
  } catch (err) {
    console.error('[HUB BLOCK CONFIG] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
