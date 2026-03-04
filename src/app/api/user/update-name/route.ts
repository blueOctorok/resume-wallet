import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

/**
 * POST /api/user/update-name
 * Updates the user's display name in the users table.
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

    const { error } = await supabase
      .from('users')
      .update({ name: name.trim() })
      .ilike('wallet_address', walletAddress)

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
