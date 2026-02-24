import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getOrCreateUserByWallet } from '@/lib/user-by-wallet'

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

    const supabase = await createClient()
    const supabaseAdmin = await getAdminSupabaseClient()

    // Get or create user (single place — avoids duplicate user rows)
    let user: { id: string }
    try {
      const { user: u } = await getOrCreateUserByWallet(supabaseAdmin, userAddress)
      user = { id: u.id }
    } catch (err) {
      console.error('❌ Resume API: Error get/create user:', err)
      return NextResponse.json(
        {
          error: 'Failed to get or create user',
          details: err instanceof Error ? err.message : String(err),
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
