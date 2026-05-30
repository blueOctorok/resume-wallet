import { NextRequest, NextResponse } from 'next/server'
import { createResume, getUserResumes, upsertUser } from '@/lib/supabase-db'
import { getUserFromRequest } from '@/lib/base-auth-middleware'
import { getStormUserIdFromRequest } from '@/lib/auth-session'

export async function POST(request: NextRequest) {
  try {
    // Phase 1 dual-mode: prefer a Supabase session (or wallet header) via the
    // shared helper. When it resolves we already have the user, so skip the
    // legacy Base-signature + upsert path below. Mirrors the GET handler.
    const sessionUserId = await getStormUserIdFromRequest(request)
    if (sessionUserId) {
      const body = await request.json()
      const { title, filename, ipfsHash, isPublic } = body
      if (!title || !filename || !ipfsHash) {
        return NextResponse.json(
          { error: 'Missing required fields: title, filename, ipfsHash' },
          { status: 400 }
        )
      }
      const resume = await createResume({
        title,
        filename,
        ipfsHash,
        isPublic: isPublic || false,
        userId: sessionUserId,
      })
      return NextResponse.json(resume, { status: 201 })
    }

    console.log('📝 Resume API: Starting POST request')

    // Check Supabase environment variables
    console.log('🔍 Resume API: Checking environment variables...')
    console.log(
      '🔍 Resume API: NEXT_PUBLIC_SUPABASE_URL:',
      !!process.env.NEXT_PUBLIC_SUPABASE_URL
    )
    console.log(
      '🔍 Resume API: NEXT_PUBLIC_SUPABASE_ANON_KEY:',
      !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )

    // Authenticate the request using Base Account SDK
    console.log('🔐 Resume API: Authenticating user...')
    const user = await getUserFromRequest(request)
    console.log('✅ Resume API: User authenticated:', {
      address: user.address,
      method: user.method,
    })

    const body = await request.json()
    const { title, filename, ipfsHash, isPublic } = body
    console.log('📋 Resume API: Request body:', {
      title,
      filename,
      ipfsHash,
      isPublic,
    })

    // Validate required fields
    if (!title || !filename || !ipfsHash) {
      console.log('❌ Resume API: Missing required fields')
      return NextResponse.json(
        { error: 'Missing required fields: title, filename, ipfsHash' },
        { status: 400 }
      )
    }

    // Get wallet address from verified signature
    const walletAddress = user.address

    if (!walletAddress) {
      console.log('❌ Resume API: No wallet address found')
      return NextResponse.json(
        { error: 'No verified wallet address found' },
        { status: 400 }
      )
    }

    // Create or get user from verified wallet address
    console.log('👤 Resume API: Upserting user...')
    let dbUser
    try {
      dbUser = await upsertUser({
        walletAddress,
        name: `User ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`,
      })
      console.log('✅ Resume API: User upserted:', {
        id: dbUser.id,
        walletAddress,
      })
    } catch (userError) {
      console.error('❌ Resume API: User upsert failed:', userError)
      throw new Error(
        `Failed to create/update user: ${userError instanceof Error ? userError.message : 'Unknown error'}`
      )
    }

    // Create resume record using Supabase
    console.log('📄 Resume API: Creating resume...')
    let resume
    try {
      resume = await createResume({
        title,
        filename,
        ipfsHash,
        isPublic: isPublic || false,
        userId: dbUser.id,
      })
      console.log('✅ Resume API: Resume created:', { id: resume.id, title })
    } catch (resumeError) {
      console.error('❌ Resume API: Resume creation failed:', resumeError)
      throw new Error(
        `Failed to create resume: ${resumeError instanceof Error ? resumeError.message : 'Unknown error'}`
      )
    }

    return NextResponse.json(resume, { status: 201 })
  } catch (error) {
    console.error('❌ Resume API: Error creating resume:', error)
    console.error(
      '❌ Resume API: Error stack:',
      error instanceof Error ? error.stack : 'No stack trace'
    )

    // Handle authentication errors specifically
    if (error instanceof Error && error.message.includes('authorization')) {
      console.log('🔐 Resume API: Authentication error')
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    console.log('💥 Resume API: Generic error, returning 500')
    return NextResponse.json(
      { error: 'Failed to create resume' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // Phase 1 dual-mode: prefer a Supabase session (or wallet header) via the
    // shared helper. When it resolves we already have the user, so skip the
    // legacy Base-signature + upsert path below.
    const sessionUserId = await getStormUserIdFromRequest(request)
    if (sessionUserId) {
      const resumes = await getUserResumes(sessionUserId)
      return NextResponse.json(resumes)
    }

    // Try to authenticate via full Base auth first
    let walletAddress: string | null = null

    try {
      const user = await getUserFromRequest(request)
      walletAddress = user.address
    } catch (authError) {
      // Fall back to simple wallet header when signature isn't available
      const headerAddress = request.headers.get('x-wallet-address')
      if (!headerAddress) {
        throw authError
      }
      walletAddress = headerAddress
    }

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'No verified wallet address found' },
        { status: 400 }
      )
    }

    // Get or create user from verified wallet address
    const dbUser = await upsertUser({
      walletAddress,
      name: `User ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`,
    })

    const resumes = await getUserResumes(dbUser.id)
    return NextResponse.json(resumes)
  } catch (error) {
    console.error('Error fetching resumes:', error)

    // Handle authentication errors specifically
    if (
      error instanceof Error &&
      (error.message.includes('authorization') ||
        error.message.includes('Authentication failed'))
    ) {
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
