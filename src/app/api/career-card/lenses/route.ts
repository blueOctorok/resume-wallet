import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getUserByWallet } from '@/lib/user-by-wallet'
import {
  FULL_PROFILE_LENS_NAME,
  HARD_LENS_LIMIT,
  listLensesForUser,
  rowToLens,
} from '@/lib/career-card-lenses'

/**
 * GET /api/career-card/lenses
 * Returns every lens the wallet-authenticated user owns. Default-first.
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

    const rows = await listLensesForUser(supabase, user.id)
    return NextResponse.json({ lenses: rows.map(rowToLens) })
  } catch (err) {
    console.error('[LENSES] GET unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/career-card/lenses
 *
 * Creates a new user-defined lens. Default lens ("Full profile") is never
 * created here — it's provisioned by the DB trigger. Enforces the hard 10-lens
 * cap to match the product's anti-AIApply stance (see plan).
 *
 * Body: {
 *   name: string,
 *   visibleBlockTypes?: string[] | null,
 *   emphasizedBlockTypes?: string[],
 *   customSummary?: string | null,
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Body must be JSON' }, { status: 400 })
    }

    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }
    if (name.length > 48) {
      return NextResponse.json({ error: 'Name must be 48 characters or fewer' }, { status: 400 })
    }
    if (name.toLowerCase() === FULL_PROFILE_LENS_NAME.toLowerCase()) {
      return NextResponse.json(
        { error: `"${FULL_PROFILE_LENS_NAME}" is reserved for your default lens` },
        { status: 400 },
      )
    }

    const visibleBlockTypes =
      body.visibleBlockTypes === null
        ? null
        : Array.isArray(body.visibleBlockTypes)
        ? body.visibleBlockTypes.filter((b: unknown): b is string => typeof b === 'string')
        : undefined
    const emphasizedBlockTypes = Array.isArray(body.emphasizedBlockTypes)
      ? body.emphasizedBlockTypes.filter((b: unknown): b is string => typeof b === 'string')
      : []
    const customSummary =
      typeof body.customSummary === 'string' && body.customSummary.trim().length > 0
        ? body.customSummary.trim()
        : null

    const supabase = await getAdminSupabaseClient()
    const user = await getUserByWallet(supabase, walletAddress)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const existing = await listLensesForUser(supabase, user.id)
    if (existing.length >= HARD_LENS_LIMIT) {
      return NextResponse.json(
        {
          error: `You've hit the ${HARD_LENS_LIMIT}-lens limit. Delete one before creating another.`,
        },
        { status: 409 },
      )
    }

    const { data: inserted, error } = await supabase
      .from('career_card_lenses')
      .insert({
        user_id: user.id,
        name,
        is_default: false,
        visible_block_types: visibleBlockTypes === undefined ? null : visibleBlockTypes,
        emphasized_block_types: emphasizedBlockTypes.length > 0 ? emphasizedBlockTypes : null,
        custom_summary: customSummary,
      })
      .select('*')
      .single()

    if (error || !inserted) {
      console.error('[LENSES] Insert error:', error)
      return NextResponse.json({ error: 'Failed to create lens' }, { status: 500 })
    }

    return NextResponse.json({ lens: rowToLens(inserted) }, { status: 201 })
  } catch (err) {
    console.error('[LENSES] POST unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
