import { NextRequest, NextResponse } from 'next/server'
import { createResume, getUserResumes, upsertUser } from '@/lib/supabase-db'
import { getUserFromRequest } from '@/lib/auth-middleware'

export async function POST(request: NextRequest) {
  try {
    // Authenticate the request using Dynamic JWT
    const user = await getUserFromRequest(request)

    const body = await request.json()
    const { title, filename, ipfsHash, isPublic } = body

    // Validate required fields
    if (!title || !filename || !ipfsHash) {
      return NextResponse.json(
        { error: 'Missing required fields: title, filename, ipfsHash' },
        { status: 400 }
      )
    }

    // Get wallet address from verified JWT
    const walletAddress =
      user.verified_account?.address || user.verified_credentials?.[0]?.address

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'No verified wallet address found in token' },
        { status: 400 }
      )
    }

    // Create or get user from verified wallet address
    const dbUser = await upsertUser({
      walletAddress,
      name:
        user.given_name && user.family_name
          ? `${user.given_name} ${user.family_name}`
          : user.alias || 'User',
    })

    // Create resume record using Supabase
    const resume = await createResume({
      title,
      filename,
      ipfsHash,
      isPublic: isPublic || false,
      userId: dbUser.id,
    })

    return NextResponse.json(resume, { status: 201 })
  } catch (error) {
    console.error('Error creating resume:', error)

    // Handle authentication errors specifically
    if (error instanceof Error && error.message.includes('authorization')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create resume' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // Authenticate the request using Dynamic JWT
    const user = await getUserFromRequest(request)

    // Get wallet address from verified JWT
    const walletAddress =
      user.verified_account?.address || user.verified_credentials?.[0]?.address

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'No verified wallet address found in token' },
        { status: 400 }
      )
    }

    // Get or create user from verified wallet address
    const dbUser = await upsertUser({
      walletAddress,
      name:
        user.given_name && user.family_name
          ? `${user.given_name} ${user.family_name}`
          : user.alias || 'User',
    })

    const resumes = await getUserResumes(dbUser.id)
    return NextResponse.json(resumes)
  } catch (error) {
    console.error('Error fetching resumes:', error)

    // Handle authentication errors specifically
    if (error instanceof Error && error.message.includes('authorization')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to fetch resumes' },
      { status: 500 }
    )
  }
}
