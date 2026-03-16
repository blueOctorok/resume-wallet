import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getOrCreateUserByWallet } from '@/lib/user-by-wallet'

/**
 * POST /api/user/profile-setup
 *
 * Upserts the user's identity into user_profiles and syncs users.name.
 * Called by ProfileSetupModal for ALL roles — user_profiles is the hub's
 * single source of truth for name display and the checkAndShowProfileSetup check.
 *
 * Headers: x-wallet-address
 * Body: { firstName, lastName, email?, phone?, city?, state? }
 */
export async function POST(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 401 })
    }

    const body = await request.json()
    const { firstName, lastName, email, phone, city, state, headline } = body

    if (!firstName?.trim() || !lastName?.trim()) {
      return NextResponse.json({ error: 'First and last name are required' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()
    const { user } = await getOrCreateUserByWallet(supabase, walletAddress)

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
      .upsert({ user_id: user.id, ...profileData }, { onConflict: 'user_id' })

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
