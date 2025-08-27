import { NextRequest, NextResponse } from 'next/server'
import { createResume, getUserResumes, upsertUser } from '@/lib/supabase-db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, filename, ipfsHash, isPublic } = body

    // Validate required fields
    if (!title || !filename || !ipfsHash) {
      return NextResponse.json(
        { error: 'Missing required fields: title, filename, ipfsHash' },
        { status: 400 }
      )
    }

    // TODO: Get actual user ID from wallet authentication
    // For now, create a placeholder user with a proper UUID
    const tempWalletAddress = 'temp-wallet-' + Date.now()

    // Create or get a temporary user
    const tempUser = await upsertUser({
      walletAddress: tempWalletAddress,
      name: 'Temporary User',
    })

    // Create resume record using Supabase
    const resume = await createResume({
      title,
      filename,
      ipfsHash,
      isPublic: isPublic || false,
      userId: tempUser.id, // Use the actual UUID from the created user
    })

    return NextResponse.json(resume, { status: 201 })
  } catch (error) {
    console.error('Error creating resume:', error)
    return NextResponse.json(
      { error: 'Failed to create resume' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    // TODO: Get actual user ID from wallet authentication
    // For now, use a placeholder wallet address
    const tempWalletAddress = 'temp-wallet-' + Date.now()

    // Get or create a temporary user
    const tempUser = await upsertUser({
      walletAddress: tempWalletAddress,
      name: 'Temporary User',
    })

    const resumes = await getUserResumes(tempUser.id)
    return NextResponse.json(resumes)
  } catch (error) {
    console.error('Error fetching resumes:', error)
    return NextResponse.json(
      { error: 'Failed to fetch resumes' },
      { status: 500 }
    )
  }
}
