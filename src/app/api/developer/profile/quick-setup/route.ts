import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { saveDevGithub, saveDevProfile } from '@/lib/block-data'

/**
 * POST /api/developer/profile/quick-setup
 *
 * Lightweight identity setup for developers — same purpose as the driver
 * equivalent: establishes the minimum fields to make this hub "belong" to
 * a real person and appear in employer talent searches.
 *
 * Writes to:
 *   - block_dev_profile / block_dev_github (role-specific data)
 *   - user_profiles (first_name, last_name, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const { firstName, lastName, email, headline, githubUsername, location } = body

    if (!firstName?.trim() || !lastName?.trim()) {
      return NextResponse.json({ error: 'First and last name are required' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()

    const fullName = `${firstName.trim()} ${lastName.trim()}`

    const cleanGithub = githubUsername?.trim()?.replace(/^@/, '') || null

    // Write to block tables
    const writes: Promise<void>[] = []
    if (cleanGithub) {
      writes.push(saveDevGithub(supabase, userId, { username: cleanGithub }))
    }
    // Ensure dev profile row exists
    writes.push(saveDevProfile(supabase, userId, {}))

    try {
      await Promise.all(writes)
    } catch (err) {
      console.error('[DEV QUICK SETUP] Block save error:', err)
      return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 })
    }

    // Write identity data to user_profiles
    const identityData: Record<string, string | null> = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
    }
    if (email?.trim()) identityData.email = email.trim()
    if (headline?.trim()) identityData.headline = headline.trim()

    await supabase
      .from('user_profiles')
      .upsert(
        { user_id: userId, ...identityData },
        { onConflict: 'user_id' }
      )

    return NextResponse.json({ success: true, name: fullName })
  } catch (error) {
    console.error('[DEV QUICK SETUP] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
