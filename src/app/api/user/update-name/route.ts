import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

/**
 * POST /api/user/update-name
 * Updates the user's display name in user_profiles.
 * 
 * Body: { walletAddress: string, name: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { walletAddress, name } = await request.json()

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      )
    }

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    const { data: user } = await supabase
      .from('users')
      .select('id')
      .ilike('wallet_address', walletAddress)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const trimmed = name.trim()
    const parts = trimmed.split(/\s+/)
    const firstName = parts[0] || null
    const lastName = parts.length > 1 ? parts.slice(1).join(' ') : null

    const { error } = await supabase
      .from('user_profiles')
      .upsert(
        { user_id: user.id, first_name: firstName, last_name: lastName, display_name: trimmed },
        { onConflict: 'user_id' }
      )

    if (error) {
      console.error('[UPDATE NAME] Error:', error)
      return NextResponse.json(
        { error: 'Failed to update name' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[UPDATE NAME] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
