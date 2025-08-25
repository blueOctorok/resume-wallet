import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    // TODO: Get actual user ID from wallet authentication
    const walletAddress = 'temp-wallet-address'

    const user = await prisma.user.findUnique({
      where: { walletAddress },
      include: {
        resumes: {
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

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

    // Update user profile
    const user = await prisma.user.upsert({
      where: { walletAddress },
      update: {
        name,
        cdlNumber,
        cdlState,
        cdlClass,
      },
      create: {
        walletAddress,
        name,
        cdlNumber,
        cdlState,
        cdlClass,
      },
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
