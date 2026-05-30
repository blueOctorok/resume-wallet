import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getOrCreateUserByWallet } from '@/lib/user-by-wallet'
import { getStormUserIdFromRequest } from '@/lib/auth-session'

/**
 * POST /api/user/profile-setup
 *
 * Upserts the user's identity into user_profiles and syncs users.name.
 * Called by ProfileSetupModal for ALL roles — user_profiles is the hub's
 * single source of truth for name display and the checkAndShowProfileSetup check.
 *
 * Auth: Supabase session cookie (falls back to x-wallet-address until T1.12).
 * Body: { firstName, lastName, email?, phone?, city?, state? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { firstName, lastName, email, phone, city, state, headline } = body

    if (!firstName?.trim() || !lastName?.trim()) {
      return NextResponse.json({ error: 'First and last name are required' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()

    let userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      const walletAddress = request.headers.get('x-wallet-address')
      if (!walletAddress) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
      }
      const { user } = await getOrCreateUserByWallet(supabase, walletAddress)
      userId = user.id
    }

    const fullName = `${firstName.trim()} ${lastName.trim()}`

    const profileData: Record<string, string | null> = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
    }
    if (email?.trim()) profileData.email = email.trim()
    if (phone?.trim()) profileData.phone = phone.trim()
    if (city?.trim()) profileData.city = city.trim()
    if (state?.trim()) profileData.state = state.trim()
    // headline can be explicitly set to null (to clear it) or a string
    if (headline !== undefined) profileData.headline = headline?.trim() || null

    const { error: upsertError } = await supabase
      .from('user_profiles')
      .upsert({ user_id: userId, ...profileData }, { onConflict: 'user_id' })

    if (upsertError) {
      console.error('[PROFILE SETUP] Upsert error:', upsertError)
      return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 })
    }

    return NextResponse.json({ success: true, name: fullName })
  } catch (err) {
    console.error('[PROFILE SETUP] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
