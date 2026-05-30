import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { suggestCategories } from '@/lib/block-registry'

/**
 * POST /api/hub/onboarding
 *
 * Saves (or updates) the candidate's context answers from the mandatory
 * onboarding form. Runs the block registry's keyword matcher to populate
 * suggested_categories so the block picker can pre-filter on first open.
 *
 * Body:    { occupation: string, seekingReason: string, extraContext?: string }
 * Response: { onboarding: HubOnboarding }
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const { occupation, seekingReason, extraContext } = body

    if (!occupation?.trim() || !seekingReason?.trim()) {
      return NextResponse.json(
        { error: 'occupation and seekingReason are required' },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    // Derive suggested categories from free-text answers using the block registry
    // keyword matcher. Stored so the picker can pre-filter without re-running logic.
    const suggested = suggestCategories(occupation.trim(), seekingReason.trim())

    const payload: Record<string, unknown> = {
      user_id: userId,
      occupation: occupation.trim(),
      seeking_reason: seekingReason.trim(),
      suggested_categories: suggested,
      completed_at: new Date().toISOString(),
    }
    if (extraContext !== undefined) {
      payload.extra_context = extraContext?.trim() || null
    }

    const { data: onboarding, error } = await supabase
      .from('hub_onboarding')
      .upsert(payload, { onConflict: 'user_id' })
      .select('occupation, seeking_reason, suggested_categories, extra_context, completed_at, updated_at')
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
