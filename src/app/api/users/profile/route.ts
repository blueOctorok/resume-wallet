import { NextRequest, NextResponse } from 'next/server'
import { getUserProfile, upsertUser } from '@/lib/supabase-db'

export async function GET() {
  try {
    // TODO: Get actual user ID from wallet authentication
    const walletAddress = 'temp-wallet-address'

    const user = await getUserProfile(walletAddress)
    return NextResponse.json(user)
  } catch (error) {
    console.error('Error fetching user profile:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user profile' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, cdlNumber, cdlState, cdlClass } = body

    // TODO: Get actual user ID from wallet authentication
    const walletAddress = 'temp-wallet-address'

    // Update user profile using Supabase
    const user = await upsertUser({
      walletAddress,
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
