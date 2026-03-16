import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

/**
 * POST /api/developer/profile/quick-setup
 *
 * Lightweight identity setup for developers — same purpose as the driver
 * equivalent: establishes the minimum fields to make this hub "belong" to
 * a real person and appear in employer talent searches.
 *
 * Writes to both:
 *   - developer_profiles (upsert by user_id)
 *   - user_profiles (first_name, last_name)
 */
export async function POST(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 401 })
    }

    const body = await request.json()
    const { firstName, lastName, email, headline, githubUsername, location } = body

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

    // Upsert developer_profiles with role-specific data only
    const profileData: Record<string, string | null> = {}
    if (headline?.trim()) profileData.headline = headline.trim()
    if (githubUsername?.trim()) profileData.github_username = githubUsername.trim().replace(/^@/, '')
    if (location?.trim()) profileData.location = location.trim()

    const { error: profileError } = await supabase
      .from('developer_profiles')
      .upsert({ user_id: user.id, ...profileData }, { onConflict: 'user_id' })

    if (profileError) {
      console.error('[DEV QUICK SETUP] Profile upsert error:', profileError)
      return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 })
    }

    // Write all identity data to user_profiles
    const identityData: Record<string, string | null> = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
    }
    if (email?.trim()) identityData.email = email.trim()

    await supabase
      .from('user_profiles')
      .upsert(
        { user_id: user.id, ...identityData },
        { onConflict: 'user_id' }
      )

    return NextResponse.json({ success: true, name: fullName })
  } catch (error) {
    console.error('[DEV QUICK SETUP] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
