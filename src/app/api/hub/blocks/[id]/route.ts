import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getUserByWallet } from '@/lib/user-by-wallet'

/**
 * DELETE /api/hub/blocks/[id]
 *
 * Removes a block from the user's hub. Verifies ownership before deleting —
 * a user cannot delete another user's block even if they know the UUID.
 *
 * Response: { success: true }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const supabase = await getAdminSupabaseClient()
    const user = await getUserByWallet(supabase, walletAddress)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Delete only if the block belongs to this user (ownership check)
    const { error, count } = await supabase
      .from('hub_blocks')
      .delete({ count: 'exact' })
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('[HUB BLOCKS] Delete error:', error)
      return NextResponse.json({ error: 'Failed to remove block' }, { status: 500 })
    }

    if (count === 0) {
      return NextResponse.json({ error: 'Block not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[HUB BLOCKS] DELETE unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
