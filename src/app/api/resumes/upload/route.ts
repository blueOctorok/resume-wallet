// app/api/resumes/upload/route.ts
// Hash-first resume upload with comprehensive validation (FREE operations first)

import { NextRequest, NextResponse } from 'next/server'
import { uploadRateLimiter, RATE_LIMITS } from '@/lib/rate-limit'
import { checkUploadEligibility, recordPaidUpload } from '@/lib/pricing'
import { createClient } from '@/utils/supabase/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { uploadToIPFS } from '@/lib/ipfs'

export async function POST(req: NextRequest) {
  try {
    console.log('📝 Resume Upload API: Starting hash-first validation')

    // 1. Get user from wallet address
    const walletAddress = req.headers.get('x-wallet-address')
    if (!walletAddress) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('👤 Resume Upload API: Wallet address:', walletAddress)

    // 2. Get or create user in database
    const supabase = await createClient()
    let { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('wallet_address', walletAddress)
      .single()

    if (userError && userError.code === 'PGRST116') {
      // User doesn't exist, create them
      console.log('👤 Resume Upload API: Creating new user')
      const { data: newUser, error: createUserError } = await supabase
        .from('users')
        .insert({
          wallet_address: walletAddress,
          is_active: true,
        })
        .select('id')
        .single()

      if (createUserError) {
        console.error(
          '❌ Resume Upload API: Error creating user:',
          createUserError
        )
        return NextResponse.json(
          { error: 'Failed to create user' },
          { status: 500 }
        )
      }
      user = newUser
    } else if (userError) {
      console.error('❌ Resume Upload API: Error fetching user:', userError)
      return NextResponse.json(
        { error: 'Failed to fetch user' },
        { status: 500 }
      )
    }

    if (!user) {
      return NextResponse.json(
        { error: 'User not found or created' },
        { status: 500 }
      )
    }

    console.log('✅ Resume Upload API: User authenticated:', user.id)

    // 3. Rate limiting (20 uploads per hour - resource protection)
    const rateLimitKey = `upload:${user.id}`
    const allowed = uploadRateLimiter.check(
      rateLimitKey,
      RATE_LIMITS.UPLOAD.maxRequests,
      RATE_LIMITS.UPLOAD.windowMs
    )

    if (!allowed) {
      const remainingMs = uploadRateLimiter.getRemainingTime(rateLimitKey)
      const remainingMinutes = Math.ceil(remainingMs / 60000)

      console.log('🚫 Resume Upload API: Rate limit exceeded')
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: `Too many uploads this hour (${RATE_LIMITS.UPLOAD.maxRequests} max). Try again in ${remainingMinutes} minutes.`,
        },
        { status: 429 }
      )
    }

    console.log('✅ Resume Upload API: Rate limit passed')

    // 4. Check pricing eligibility
    console.log('💰 Resume Upload API: Checking pricing eligibility')
    const eligibility = await checkUploadEligibility(user.id)
    console.log('💰 Resume Upload API: Eligibility:', eligibility)

    // 5. Parse form data (expecting file hash from client)
    const formData = await req.formData()
    const file = formData.get('file') as File
    const title = formData.get('title') as string
    const fileHash = formData.get('fileHash') as string
    const paymentTxHash = formData.get('paymentTxHash') as string | null

    if (!file || !fileHash) {
      return NextResponse.json(
        {
          error: 'No file or file hash provided',
        },
        { status: 400 }
      )
    }

    console.log(
      '📄 Resume Upload API: File hash received:',
      fileHash.substring(0, 16) + '...'
    )

    // 6. Validate file (simple checks)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        {
          error: 'File too large. Maximum 5MB.',
        },
        { status: 400 }
      )
    }

    if (
      ![
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ].includes(file.type)
    ) {
      return NextResponse.json(
        {
          error: 'Invalid file type. PDF or DOC only.',
        },
        { status: 400 }
      )
    }

    console.log('✅ Resume Upload API: File validation passed')

    // 7. Check for duplicates using file hash BEFORE expensive operations (FREE operation)
    // NOTE: Using admin client to bypass RLS and check across ALL users for duplicates
    // This prevents IPFS upload costs for duplicate files
    console.log('🔍 Resume Upload API: Checking for duplicate file hash (before IPFS)')

    // Use admin client for duplicate check (bypasses RLS to check across all users)
    const adminSupabase = await getAdminSupabaseClient()
    const { data: existingResume } = await adminSupabase
      .from('resumes')
      .select('id, user_id')
      .eq('file_hash', fileHash)
      .maybeSingle()

    if (existingResume) {
      // Check if it's the same user (allowed to re-upload) or different user (block)
      if (existingResume.user_id === user.id) {
        console.log('⚠️ Resume Upload API: User re-uploading same file (rejected before IPFS)')
        return NextResponse.json(
          {
            error: 'Duplicate file',
            message:
              'You have already uploaded this exact file. Please select a different file or update your existing resume.',
          },
          { status: 409 }
        )
      } else {
        console.log(
          '🚫 Resume Upload API: File already uploaded by different user (rejected before IPFS)'
        )
        return NextResponse.json(
          {
            error: 'Duplicate file',
            message:
              'This file has already been uploaded by another user. Please select a different file or rename your current file.',
          },
          { status: 409 }
        )
      }
    }

    console.log('✅ Resume Upload API: No duplicate file hash found - proceeding with IPFS upload')

    // 8. Check payment requirement (only check if not duplicate)
    if (eligibility.requiresPayment && !paymentTxHash) {
      console.log('💳 Resume Upload API: Payment required')
      return NextResponse.json(
        {
          error: 'Payment required',
          message: 'You have used your free upload this week.',
          costUSDC: eligibility.costUSDC,
          uploadsThisWeek: eligibility.uploadsThisWeek,
          nextFreeUpload: eligibility.nextFreeUpload,
        },
        { status: 402 }
      )
    }

    // 9. Verify payment if required (TODO: Add Base Pay verification)
    if (eligibility.requiresPayment && paymentTxHash) {
      console.log('💳 Resume Upload API: Verifying payment')
      // TODO: Verify the transaction on Base network
      // For now, trust the txHash (add verification later)
      await recordPaidUpload(user.id, paymentTxHash, eligibility.costUSDC)
      console.log('✅ Resume Upload API: Payment recorded')
    }

    // 10. Upload to IPFS (only reached if not duplicate and payment verified)
    console.log('📁 Resume Upload API: Uploading to IPFS')
    const ipfsResult = await uploadToIPFS(file)

    if (!ipfsResult || !ipfsResult.ipfsHash) {
      throw new Error('IPFS upload failed')
    }

    console.log(
      '✅ Resume Upload API: IPFS upload complete:',
      ipfsResult.ipfsHash
    )

    // 11. Save to database (WITH FILE HASH + IPFS HASH) - only reached if IPFS upload succeeded
    console.log('💾 Resume Upload API: Saving to database')

    const { data: resume, error: resumeError } = await supabase
      .from('resumes')
      .insert({
        user_id: user.id,
        title:
          title ||
          file.name
            .replace('.pdf', '')
            .replace('.doc', '')
            .replace('.docx', ''),
        filename: file.name,
        file_hash: fileHash, // SHA-256 hash for duplicate detection
        ipfs_hash: ipfsResult.ipfsHash,
        ipfs_url: ipfsResult.url,
        file_size: file.size,
        mime_type: file.type,
        is_public: false,
        verification_status: 'PENDING',
        is_paid: eligibility.requiresPayment,
      })
      .select('id, created_at')
      .single()

    if (resumeError) {
      console.error('❌ Resume Upload API: Database save failed:', resumeError)
      console.error(
        '❌ Resume Upload API: Error details:',
        JSON.stringify(resumeError, null, 2)
      )
      throw new Error(
        `Failed to save resume to database: ${resumeError.message}`
      )
    }

    console.log('✅ Resume Upload API: Database save complete:', resume.id)

    // 12. Return success with all data needed for blockchain step
    return NextResponse.json({
      success: true,
      resume: {
        id: resume.id,
        title:
          title ||
          file.name
            .replace('.pdf', '')
            .replace('.doc', '')
            .replace('.docx', ''),
        ipfsHash: ipfsResult.ipfsHash,
        ipfsUrl: ipfsResult.url,
        createdAt: resume.created_at,
        wasPaid: eligibility.requiresPayment,
        costUSDC: eligibility.requiresPayment ? eligibility.costUSDC : 0,
      },
      eligibility: {
        uploadsThisWeek: eligibility.uploadsThisWeek + 1,
        nextFreeUpload: eligibility.nextFreeUpload,
      },
      // Data needed for blockchain verification step
      blockchainData: {
        ipfsHash: ipfsResult.ipfsHash,
        title:
          title ||
          file.name
            .replace('.pdf', '')
            .replace('.doc', '')
            .replace('.docx', ''),
        filename: file.name,
        userAddress: walletAddress,
        isPublic: false,
      },
    })
  } catch (error) {
    console.error('❌ Resume Upload API: Error:', error)
    return NextResponse.json(
      {
        error: 'Upload failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// GET endpoint to check upload eligibility
export async function GET(req: NextRequest) {
  try {
    const walletAddress = req.headers.get('x-wallet-address')
    if (!walletAddress) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('wallet_address', walletAddress)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const eligibility = await checkUploadEligibility(user.id)
    return NextResponse.json(eligibility)
  } catch (error) {
    console.error('❌ Resume Upload API: Eligibility check error:', error)
    return NextResponse.json(
      { error: 'Failed to check eligibility' },
      { status: 500 }
    )
  }
}
