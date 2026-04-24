import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getUserByWallet } from '@/lib/user-by-wallet'
import { FULL_PROFILE_LENS_NAME, rowToLens } from '@/lib/career-card-lenses'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * PATCH /api/career-card/lenses/[id]
 *
 * Updates a user's lens. The default lens can be renamed (to a non-reserved
 * name) and have its summary/emphasis updated, but NOT have its `is_default`
 * flag flipped or its `visible_block_types` narrowed — that would leave the
 * user without a "show everything" fallback.
 *
 * Body: Partial<{ name, visibleBlockTypes, emphasizedBlockTypes, customSummary }>
 */
export async function PATCH(request: NextRequest, ctx: RouteContext) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 401 })
    }

    const { id } = await ctx.params
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Body must be JSON' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()
    const user = await getUserByWallet(supabase, walletAddress)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { data: current } = await supabase
      .from('career_card_lenses')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!current) {
      return NextResponse.json({ error: 'Lens not found' }, { status: 404 })
    }

    const update: Record<string, unknown> = {}

    if (typeof body.name === 'string') {
      const name = body.name.trim()
      if (!name) {
        return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
      }
      if (name.length > 48) {
        return NextResponse.json({ error: 'Name must be 48 characters or fewer' }, { status: 400 })
      }
      // Reserved name is only valid for the default lens (which already has it).
      if (
        name.toLowerCase() === FULL_PROFILE_LENS_NAME.toLowerCase() &&
        !current.is_default
      ) {
        return NextResponse.json(
          { error: `"${FULL_PROFILE_LENS_NAME}" is reserved for your default lens` },
          { status: 400 },
        )
      }
      update.name = name
    }

    if ('visibleBlockTypes' in body) {
      if (current.is_default) {
        return NextResponse.json(
          { error: 'Default lens always shows every block' },
          { status: 400 },
        )
      }
      if (body.visibleBlockTypes === null) {
        update.visible_block_types = null
      } else if (Array.isArray(body.visibleBlockTypes)) {
        update.visible_block_types = body.visibleBlockTypes.filter(
          (b: unknown): b is string => typeof b === 'string',
        )
      }
    }

    if ('emphasizedBlockTypes' in body) {
      const arr = Array.isArray(body.emphasizedBlockTypes)
        ? body.emphasizedBlockTypes.filter((b: unknown): b is string => typeof b === 'string')
        : []
      update.emphasized_block_types = arr.length > 0 ? arr : null
    }

    if ('customSummary' in body) {
      const s = typeof body.customSummary === 'string' ? body.customSummary.trim() : ''
      update.custom_summary = s.length > 0 ? s : null
    }

    // is_default is intentionally NOT editable via API — ensures the default
    // stays stable and avoids a race where two rows are both default briefly.

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ lens: rowToLens(current) })
    }

    const { data: updated, error } = await supabase
      .from('career_card_lenses')
      .update(update)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .single()

    if (error || !updated) {
      console.error('[LENSES] Update error:', error)
      return NextResponse.json({ error: 'Failed to update lens' }, { status: 500 })
    }

    return NextResponse.json({ lens: rowToLens(updated) })
  } catch (err) {
    console.error('[LENSES] PATCH unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/career-card/lenses/[id]
 *
 * Deletes a non-default lens. The default lens can never be deleted — it's the
 * "Full profile" fallback that every downstream fetch needs.
 */
export async function DELETE(request: NextRequest, ctx: RouteContext) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 401 })
    }

    const { id } = await ctx.params
    const supabase = await getAdminSupabaseClient()
    const user = await getUserByWallet(supabase, walletAddress)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { data: current } = await supabase
      .from('career_card_lenses')
      .select('id, is_default')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!current) {
      return NextResponse.json({ error: 'Lens not found' }, { status: 404 })
    }

    if (current.is_default) {
      return NextResponse.json(
        { error: 'The default "Full profile" lens cannot be deleted' },
        { status: 400 },
      )
    }

    const { error } = await supabase
      .from('career_card_lenses')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('[LENSES] Delete error:', error)
      return NextResponse.json({ error: 'Failed to delete lens' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[LENSES] DELETE unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
