// app/api/resumes/upload/route.ts
// Save a resume PDF to storage. No chain write and no client-supplied file hash.

import { NextRequest, NextResponse } from 'next/server'
import { uploadRateLimiter, RATE_LIMITS } from '@/lib/rate-limit'
import { createClient } from '@/utils/supabase/server'
import { uploadDocument, getSignedDocumentUrl } from '@/lib/document-storage'
import { getStormUserIdFromRequest } from '@/lib/auth-session'

export async function POST(req: NextRequest) {
  try {
    console.log('[RESUME UPLOAD] Starting')

    let user: { id: string }
    const sessionUserId = await getStormUserIdFromRequest(req)
    if (sessionUserId) {
      user = { id: sessionUserId }
    } else {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const supabase = await createClient()
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

    const formData = await req.formData()
    const file = formData.get('file') as File
    const title = formData.get('title') as string

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

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

    console.log('[RESUME UPLOAD] File validation passed')

    // 8. Upload to Supabase Storage
    console.log('[RESUME UPLOAD] Uploading to Supabase Storage')
    const { storagePath } = await uploadDocument(user.id, 'resumes', file, file.name, file.type)
    const documentUrl = await getSignedDocumentUrl('resumes', storagePath)

    console.log('[RESUME UPLOAD] Storage upload complete:', storagePath)

    // 9. Save to database (with file hash) - only reached if storage upload succeeded
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
        file_hash: null,
        storage_path: storagePath,
        ipfs_hash: null,
        ipfs_url: null,
        file_size: file.size,
        mime_type: file.type,
        is_public: false,
        verification_status: 'PENDING',
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

    // 10. Return success
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
        storagePath,
        documentUrl,
        createdAt: resume.created_at,
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