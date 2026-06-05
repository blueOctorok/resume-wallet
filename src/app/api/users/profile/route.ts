import { NextRequest, NextResponse } from 'next/server'
import { getUserProfile, upsertUser } from '@/lib/supabase-db'

export async function GET(request: NextRequest) {
  try {
    console.log('👤 User Profile API: Starting GET request')

    // Get wallet address from query parameters
    const { searchParams } = new URL(request.url)
    const sessionUserId = searchParams.get('sessionUserId')

    if (!sessionUserId) {
      console.log('❌ User Profile API: No wallet address provided')
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      )
    }

    console.log(
      '👤 User Profile API: Fetching profile for wallet:',
      sessionUserId
    )

    const user = await getUserProfile(sessionUserId)
    console.log('✅ User Profile API: Profile fetched successfully')

    return NextResponse.json(user)
  } catch (error) {
    console.error('❌ User Profile API: Error fetching user profile:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch user profile',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, cdlNumber, cdlState, cdlClass } = body

    // TODO: Get actual user ID from wallet authentication
    const sessionUserId = 'temp-wallet-address'

    // Update user profile using Supabase
    const user = await upsertUser({
      sessionUserId,
      name,
      cdlNumber,
      cdlState,
      cdlClass,
    })

    return NextResponse.json(user)
  } catch (error) {
    console.error('Error updating user profile:', error)
    return NextResponse.json(
      { error: 'Failed to update user profile' },
      { status: 500 }
    )
  }
}
