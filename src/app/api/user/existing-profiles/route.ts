import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

/**
 * GET /api/user/existing-profiles
 *
 * Returns any existing driver or developer profiles for the authenticated
 * wallet. Used by ProfileSetup to detect cross-role identity conflicts —
 * e.g. a driver setting up their dev hub who already has a driver profile,
 * so we can surface: "We see you already have a driver profile as Leon Kennedy.
 * Is that you?"
 */
export async function GET(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()

    const { data: user } = await supabase
      .from('users')
      .select('id')
      .ilike('wallet_address', walletAddress)
      .single()

    if (!user) {
      return NextResponse.json({ driverProfile: null, devProfile: null })
    }

    const [{ data: userProfile }, { data: driverProfile }, { data: devProfile }] = await Promise.all([
      supabase.from('user_profiles').select('first_name, last_name').eq('user_id', user.id).maybeSingle(),
      supabase.from('driver_profiles').select('user_id').eq('user_id', user.id).maybeSingle(),
      supabase.from('developer_profiles').select('user_id').eq('user_id', user.id).maybeSingle(),
    ])

    const profileName = [userProfile?.first_name, userProfile?.last_name].filter(Boolean).join(' ') || null

    return NextResponse.json({
      driverProfile: driverProfile ? { name: profileName } : null,
      devProfile: devProfile ? { name: profileName } : null,
    })
  } catch (error) {
    console.error('[EXISTING PROFILES] Error:', error)
    return NextResponse.json({ driverProfile: null, devProfile: null })
  }
}
