// app/api/resumes/create/route.ts
// Create or update a built resume (structured data storage)

import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getOrCreateUserByWallet, getUserByWallet } from '@/lib/user-by-wallet'

export async function POST(req: NextRequest) {
  try {
    console.log('📝 Resume Builder API: Creating new built resume')

    const walletAddress = req.headers.get('x-wallet-address')
    if (!walletAddress) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { title, structuredData, resumeType } = body

    if (!title || !structuredData || !resumeType) {
      return NextResponse.json(
        { error: 'Missing required fields: title, structuredData, resumeType' },
        { status: 400 }
      )
    }

    // Use admin client to bypass RLS (we validate wallet address manually)
    const adminClient = await getAdminSupabaseClient()

    // Get or create user (uses case-insensitive lookup, handles duplicates)
    const { user } = await getOrCreateUserByWallet(adminClient, walletAddress)

    // Create built resume
    const { data: resume, error: resumeError } = await adminClient
      .from('resumes')
      .insert({
        user_id: user.id,
        title,
        filename: `${title.replace(/[^a-z0-9]/gi, '_')}.json`, // Placeholder filename
        file_size: JSON.stringify(structuredData).length, // Approximate size
        mime_type: 'application/json',
        ipfs_hash: `built_${Date.now()}`, // Placeholder hash (will be replaced if exported to PDF)
        resume_type: resumeType || 'built',
        source_role: 'driver',
        structured_data: structuredData,
        verification_status: 'PENDING',
        is_paid: false,
        is_public: false,
      })
      .select('id, created_at, title, filename, ipfs_hash, verification_status, resume_type, is_paid, file_size')
      .single()

    if (resumeError) {
      console.error('❌ Resume Builder API: Failed to create resume', resumeError)
      console.error('❌ Resume Builder API: Error details:', JSON.stringify(resumeError, null, 2))
      return NextResponse.json(
        { error: `Failed to create resume: ${resumeError.message || 'Unknown error'}` },
        { status: 500 }
      )
    }

    console.log('✅ Resume Builder API: Built resume created successfully', resume.id)

    return NextResponse.json({
      success: true,
      resumeId: resume.id,
      message: 'Resume saved successfully',
      // Full resume data so clients can update their local store without a refetch
      resume: {
        id: resume.id,
        title: resume.title,
        filename: resume.filename,
        ipfsHash: resume.ipfs_hash,
        verificationStatus: resume.verification_status,
        blockchainTxHash: null,
        createdAt: resume.created_at,
        fileSize: resume.file_size,
        resumeType: resume.resume_type,
        isPaid: resume.is_paid,
      },
    })
  } catch (error) {
    console.error('❌ Resume Builder API: Unexpected error', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(req: NextRequest) {
  try {
    console.log('📝 Resume Builder API: Updating built resume')

    const walletAddress = req.headers.get('x-wallet-address')
    if (!walletAddress) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { resumeId, title, structuredData } = body

    if (!resumeId || !title || !structuredData) {
      return NextResponse.json(
        { error: 'Missing required fields: resumeId, title, structuredData' },
        { status: 400 }
      )
    }

    // Use admin client to bypass RLS (we validate wallet address manually)
    const adminClient = await getAdminSupabaseClient()

    // Verify user exists (case-insensitive lookup)
    const user = await getUserByWallet(adminClient, walletAddress)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Verify resume belongs to user
    const { data: existingResume } = await adminClient
      .from('resumes')
      .select('id, user_id, resume_type')
      .eq('id', resumeId)
      .single()

    if (!existingResume) {
      return NextResponse.json({ error: 'Resume not found' }, { status: 404 })
    }

    if (existingResume.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Update resume
    const { data: resume, error: resumeError } = await adminClient
      .from('resumes')
      .update({
        title,
        filename: `${title.replace(/[^a-z0-9]/gi, '_')}.json`,
        file_size: JSON.stringify(structuredData).length,
        structured_data: structuredData,
        // Note: resumes table doesn't have updated_at column, only created_at
      })
      .eq('id', resumeId)
      .select('id, created_at')
      .single()

    if (resumeError) {
      console.error('❌ Resume Builder API: Failed to update resume', resumeError)
      console.error('❌ Resume Builder API: Error details:', JSON.stringify(resumeError, null, 2))
      return NextResponse.json(
        { error: `Failed to update resume: ${resumeError.message || 'Unknown error'}` },
        { status: 500 }
      )
    }

    console.log('✅ Resume Builder API: Built resume updated successfully', resume.id)

    return NextResponse.json({
      success: true,
      resumeId: resume.id,
      message: 'Resume updated successfully',
    })
  } catch (error) {
    console.error('❌ Resume Builder API: Unexpected error', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
