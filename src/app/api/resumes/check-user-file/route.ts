import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

// Check if user has already uploaded this specific file (by IPFS hash)
export async function POST(request: NextRequest) {
  try {
    console.log('🔍 Check User File API: Starting POST request')

    const body = await request.json()
    const { userAddress, ipfsHash } = body

    console.log('📋 Check User File API: Request body:', {
      userAddress,
      ipfsHash,
    })

    // Validate required fields
    if (!userAddress || !ipfsHash) {
      console.log('❌ Check User File API: Missing required fields')
      return NextResponse.json(
        {
          error: 'Missing required fields: userAddress, ipfsHash',
        },
        { status: 400 }
      )
    }

    // Create Supabase client
    const supabase = await createClient()
    console.log('🗄️ Check User File API: Connected to Supabase database')

    // Query for existing resume with this user and IPFS hash
    console.log(
      `🔍 Check User File API: Querying database for user ${userAddress} with hash ${ipfsHash}`
    )

    const { data: existingResume, error: queryError } = await supabase
      .from('resumes')
      .select(
        `
        id,
        created_at,
        title,
        filename,
        users!inner(wallet_address)
      `
      )
      .eq('users.wallet_address', userAddress)
      .eq('ipfs_hash', ipfsHash)
      .single()

    console.log(`🔍 Check User File API: Database query result:`, {
      found: !!existingResume,
      error: queryError?.code,
      data: existingResume,
    })

    if (queryError && queryError.code !== 'PGRST116') {
      // PGRST116 is "not found" - that's expected for new files
      console.error('❌ Check User File API: Database query error:', queryError)
      return NextResponse.json(
        {
          error: 'Failed to check for duplicates',
          details: queryError.message,
        },
        { status: 500 }
      )
    }

    const exists = !!existingResume

    const checkResult = {
      exists: exists,
      resumeId: exists ? existingResume.id : null,
      uploadedAt: exists ? existingResume.created_at : null,
      title: exists ? existingResume.title : null,
      filename: exists ? existingResume.filename : null,
      source: 'SUPABASE_DATABASE', // This proves it's coming from the database
    }

    if (exists) {
      console.log(
        `🔍 Check User File API: Found duplicate for user ${userAddress}`
      )
      console.log(
        `📄 Existing resume: ${existingResume.title} (${existingResume.filename})`
      )
    } else {
      console.log(
        `🔍 Check User File API: No duplicate found for user ${userAddress}`
      )
    }

    console.log('✅ Check User File API: Check result:', checkResult)

    return NextResponse.json(checkResult, { status: 200 })
  } catch (error) {
    console.error('❌ Check User File API: Error checking file:', error)

    return NextResponse.json(
      {
        error: 'Failed to check file',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
