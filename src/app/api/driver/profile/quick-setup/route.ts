import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

/**
 * POST /api/driver/profile/quick-setup
 *
 * Lightweight identity setup — called on first hub visit when the driver
 * has no name set. Establishes the minimum identity fields so the hub
 * shows the correct person and they appear in talent searches.
 *
 * Writes to both:
 *   - driver_profiles (upsert by user_id)
 *   - user_profiles (first_name, last_name)
 */
export async function POST(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 401 })
    }

    const body = await request.json()
    const { firstName, lastName, email, phone, city, state, cdlClass, cdlState } = body

    if (!firstName?.trim() || !lastName?.trim()) {
      return NextResponse.json({ error: 'First and last name are required' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()

    // Resolve wallet → user
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .ilike('wallet_address', walletAddress)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const fullName = `${firstName.trim()} ${lastName.trim()}`

    // Upsert driver_profiles with role-specific data only
    const profileData: Record<string, string | null> = {}
    if (cdlClass?.trim()) profileData.cdl_class = cdlClass.trim()
    if (cdlState?.trim()) profileData.cdl_state = cdlState.trim()

    const { error: profileError } = await supabase
      .from('driver_profiles')
      .upsert({ user_id: user.id, ...profileData }, { onConflict: 'user_id' })

    if (profileError) {
      console.error('[DRIVER QUICK SETUP] Profile upsert error:', profileError)
      return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 })
    }

    // Write all identity data to user_profiles
    const identityData: Record<string, string | null> = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
    }
    if (email?.trim()) identityData.email = email.trim()
    if (phone?.trim()) identityData.phone = phone.trim()
    if (city?.trim()) identityData.city = city.trim()
    if (state?.trim()) identityData.state = state.trim()

    await supabase
      .from('user_profiles')
      .upsert(
        { user_id: user.id, ...identityData },
        { onConflict: 'user_id' }
      )

    return NextResponse.json({ success: true, name: fullName })
  } catch (error) {
    console.error('[DRIVER QUICK SETUP] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
