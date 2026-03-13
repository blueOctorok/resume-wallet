import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getUserByWallet } from '@/lib/user-by-wallet'

interface ReorderItem {
  id: string
  position: number
}

/**
 * PATCH /api/hub/blocks/reorder
 *
 * Updates the position of multiple blocks after a drag-and-drop reorder.
 * Only updates blocks that belong to the authenticated user.
 *
 * Body: { order: Array<{ id: string, position: number }> }
 * Response: { success: true }
 */
export async function PATCH(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 401 })
    }

    const body = await request.json()
    const { order } = body as { order: ReorderItem[] }

    if (!Array.isArray(order) || order.length === 0) {
      return NextResponse.json({ error: 'order array is required' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()
    const user = await getUserByWallet(supabase, walletAddress)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Verify all block IDs belong to this user before updating anything.
    // This prevents a user from reordering another user's blocks via crafted IDs.
    const ids = order.map((item) => item.id)
    const { data: ownedBlocks, error: checkError } = await supabase
      .from('hub_blocks')
      .select('id')
      .eq('user_id', user.id)
      .in('id', ids)

    if (checkError) {
      console.error('[HUB REORDER] Ownership check error:', checkError)
      return NextResponse.json({ error: 'Failed to verify block ownership' }, { status: 500 })
    }

    if ((ownedBlocks?.length ?? 0) !== ids.length) {
      return NextResponse.json({ error: 'One or more blocks not found' }, { status: 404 })
    }

    // Update each block's position. Supabase doesn't support batching different
    // values per row in one call, so we run updates in parallel. The number of
    // blocks per user is small (typically < 15) so this is safe.
    const updates = order.map(({ id, position }) =>
      supabase
        .from('hub_blocks')
        .update({ position })
        .eq('id', id)
        .eq('user_id', user.id)
    )

    const results = await Promise.all(updates)
    const failed = results.find((r) => r.error)
    if (failed?.error) {
      console.error('[HUB REORDER] Update error:', failed.error)
      return NextResponse.json({ error: 'Failed to reorder blocks' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[HUB REORDER] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
