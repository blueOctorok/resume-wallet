import { NextRequest, NextResponse } from 'next/server'

// Simple resume creation endpoint that works with Alchemy Smart Wallets
export async function POST(request: NextRequest) {
  try {
    console.log('📝 Simple Resume API: Starting POST request')

    const body = await request.json()
    const {
      ipfsHash,
      title,
      filename,
      userAddress,
      isPublic,
      fileSize,
      mimeType,
    } = body

    console.log('📋 Simple Resume API: Request body:', {
      ipfsHash,
      title,
      filename,
      userAddress,
      isPublic,
      fileSize,
      mimeType,
    })

    // Validate required fields
    if (!ipfsHash || !title || !filename || !userAddress) {
      console.log('❌ Simple Resume API: Missing required fields')
      return NextResponse.json(
        {
          error:
            'Missing required fields: ipfsHash, title, filename, userAddress',
        },
        { status: 400 }
      )
    }

    // For now, just return a mock response since we're focusing on blockchain integration
    // In a real app, you'd save to Supabase here
    const mockResume = {
      id: Date.now().toString(),
      title,
      filename,
      ipfsHash,
      userAddress,
      isPublic: isPublic || false,
      fileSize: fileSize || 0,
      mimeType: mimeType || 'application/pdf',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    console.log('✅ Simple Resume API: Mock resume created:', mockResume)

    return NextResponse.json(mockResume, { status: 201 })
  } catch (error) {
    console.error('❌ Simple Resume API: Error creating resume:', error)

    return NextResponse.json(
      {
        error: 'Failed to create resume',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
