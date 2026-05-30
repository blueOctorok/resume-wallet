import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'

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
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Block ID is required' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()

    // Delete only if the block belongs to this user (ownership check).
    // .delete() returns nothing by default; chain .select() to get deleted rows and detect 0 matches.
    const { data: deleted, error } = await supabase
      .from('hub_blocks')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select('id')

    if (error) {
      console.error('[HUB BLOCKS] Delete error:', error)
      return NextResponse.json({ error: 'Failed to remove block' }, { status: 500 })
    }

    // 0 rows: block already removed or stale id (e.g. removed in another tab). Return success
    // so the client keeps the optimistic removal and doesn't show "Failed to remove block".
    if (!deleted?.length) {
      return NextResponse.json({ success: true, alreadyRemoved: true })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[HUB BLOCKS] DELETE unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
