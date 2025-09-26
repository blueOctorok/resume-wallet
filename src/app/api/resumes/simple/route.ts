import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

// Real API endpoint for resume uploads using Supabase
export async function POST(request: NextRequest) {
  try {
    console.log('📄 Resume API: Starting POST request')

    const body = await request.json()
    const {
      ipfsHash,
      title,
      filename,
      userAddress,
      isPublic = false,
      fileSize,
      mimeType,
    } = body

    console.log('📋 Resume API: Request body:', {
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
      console.log('❌ Resume API: Missing required fields')
      return NextResponse.json(
        {
          error:
            'Missing required fields: ipfsHash, title, filename, userAddress',
        },
        { status: 400 }
      )
    }

    // Create Supabase client
    const supabase = await createClient()

    // First, get or create the user
    let { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('wallet_address', userAddress)
      .single()

    if (userError && userError.code === 'PGRST116') {
      // User doesn't exist, create them
      console.log('👤 Resume API: Creating new user for wallet:', userAddress)

      const { data: newUser, error: createUserError } = await supabase
        .from('users')
        .insert({
          wallet_address: userAddress,
          is_active: true,
        })
        .select('id')
        .single()

      if (createUserError) {
        console.error('❌ Resume API: Error creating user:', createUserError)
        return NextResponse.json(
          {
            error: 'Failed to create user',
            details: createUserError.message,
          },
          { status: 500 }
        )
      }

      user = newUser
    } else if (userError) {
      console.error('❌ Resume API: Error fetching user:', userError)
      return NextResponse.json(
        {
          error: 'Failed to fetch user',
          details: userError.message,
        },
        { status: 500 }
      )
    }

    // Now save the resume
    if (!user) {
      console.error('❌ Resume API: User is null after creation/fetch')
      return NextResponse.json(
        {
          error: 'User not found or created',
        },
        { status: 500 }
      )
    }

    const { data: resume, error: resumeError } = await supabase
      .from('resumes')
      .insert({
        user_id: user.id,
        title,
        filename,
        ipfs_hash: ipfsHash,
        is_public: isPublic,
      })
      .select('id, created_at')
      .single()

    if (resumeError) {
      console.error('❌ Resume API: Error saving resume:', resumeError)
      return NextResponse.json(
        {
          error: 'Failed to save resume',
          details: resumeError.message,
        },
        { status: 500 }
      )
    }

    const result = {
      id: resume.id,
      ipfsHash,
      title,
      filename,
      userAddress,
      isPublic,
      fileSize,
      mimeType,
      created_at: resume.created_at,
      table: 'resumes',
    }

    console.log('✅ Resume API: Save successful:', result)

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('❌ Resume API: Error saving resume:', error)

    return NextResponse.json(
      {
        error: 'Failed to save resume',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
