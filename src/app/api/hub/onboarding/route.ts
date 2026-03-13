import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getUserByWallet } from '@/lib/user-by-wallet'
import { suggestCategories } from '@/lib/block-registry'

/**
 * POST /api/hub/onboarding
 *
 * Saves (or updates) the candidate's context answers from the mandatory
 * onboarding form. Runs the block registry's keyword matcher to populate
 * suggested_categories so the block picker can pre-filter on first open.
 *
 * Body:    { occupation: string, seekingReason: string }
 * Response: { onboarding: HubOnboarding }
 */
export async function POST(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 401 })
    }

    const body = await request.json()
    const { occupation, seekingReason } = body

    if (!occupation?.trim() || !seekingReason?.trim()) {
      return NextResponse.json(
        { error: 'occupation and seekingReason are required' },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()
    const user = await getUserByWallet(supabase, walletAddress)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Derive suggested categories from free-text answers using the block registry
    // keyword matcher. Stored so the picker can pre-filter without re-running logic.
    const suggested = suggestCategories(occupation.trim(), seekingReason.trim())

    const { data: onboarding, error } = await supabase
      .from('hub_onboarding')
      .upsert(
        {
          user_id: user.id,
          occupation: occupation.trim(),
          seeking_reason: seekingReason.trim(),
          suggested_categories: suggested,
          completed_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      .select('occupation, seeking_reason, suggested_categories, completed_at, updated_at')
      .single()

    if (error) {
      console.error('[HUB ONBOARDING] Upsert error:', error)
      return NextResponse.json({ error: 'Failed to save onboarding' }, { status: 500 })
    }

    return NextResponse.json({ onboarding })
  } catch (err) {
    console.error('[HUB ONBOARDING] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
