import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { saveCdlData } from '@/lib/block-data'

/**
 * POST /api/driver/profile/quick-setup
 *
 * Lightweight identity setup — called on first hub visit when the driver
 * has no name set. Establishes the minimum identity fields so the hub
 * shows the correct person and they appear in talent searches.
 *
 * Writes to:
 *   - block_driver_cdl (CDL class/state)
 *   - user_profiles (first_name, last_name, etc.)
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

    // Write CDL data to block table
    const cdlData: Record<string, string | null> = {}
    if (cdlClass?.trim()) cdlData.cdl_class = cdlClass.trim()
    if (cdlState?.trim()) cdlData.cdl_state = cdlState.trim()

    try {
      await saveCdlData(supabase, user.id, cdlData)
    } catch (err) {
      console.error('[DRIVER QUICK SETUP] CDL block save error:', err)
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
