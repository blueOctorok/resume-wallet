import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { sendCandidateRequestNotification } from '@/lib/send-admin-notification'
import { createNotification } from '@/lib/create-notification'

/**
 * POST /api/employer/talent/[userId]/request
 * 
 * Creates a request from an employer to a candidate.
 * Request types:
 *   - mvr_order: Employer will order MVR for candidate
 *   - document_upload: Request candidate upload a document
 *   - verification: Request employment verification
 *   - profile_completion: Request candidate complete profile section
 *   - custom: Custom request with message
 * 
 * Body:
 *   - requestType: One of the above types (required)
 *   - documentType: For document_upload - 'cdl', 'medical_card', 'resume', etc.
 *   - message: Optional message to candidate
 *   - expiresInDays: Optional expiration (default: 30)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    const { userId: candidateUserId } = await params
    const body = await request.json()

    const {
      requestType,
      documentType,
      message,
      expiresInDays = 30,
    } = body

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 401 }
      )
    }

    if (!candidateUserId) {
      return NextResponse.json(
        { error: 'Candidate user ID is required' },
        { status: 400 }
      )
    }

    const validTypes = ['mvr_order', 'document_upload', 'verification', 'profile_completion', 'custom']
    if (!requestType || !validTypes.includes(requestType)) {
      return NextResponse.json(
        { error: `requestType must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    if (requestType === 'document_upload' && !documentType) {
      return NextResponse.json(
        { error: 'documentType is required for document_upload requests' },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    // Verify employer and get company
    const { data: employer } = await supabase
      .from('users')
      .select('id')
      .ilike('wallet_address', walletAddress)
      .single()

    if (!employer) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Get company membership
    const { data: membership } = await supabase
      .from('company_members')
      .select('company_id, role')
      .eq('user_id', employer.id)
      .eq('is_active', true)
      .single()

    let companyId = membership?.company_id || null

    if (!companyId) {
      const { data: legacyCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('employer_user_id', employer.id)
        .single()

      companyId = legacyCompany?.id || null
    }

    if (!companyId) {
      return NextResponse.json(
        { error: 'No company access' },
        { status: 403 }
      )
    }

    // Get company name for email notification
    const { data: company } = await supabase
      .from('companies')
      .select('name')
      .eq('id', companyId)
      .single()

    const companyName = company?.name || 'A company'

    // Verify candidate exists
    const { data: candidate } = await supabase
      .from('users')
      .select('id, role, email')
      .eq('id', candidateUserId)
      .single()

    if (!candidate) {
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404 }
      )
    }

    // Check if user has driver or developer DATA (not just role column)
    // This handles the case where someone is testing with role='employer' but has driver data
    const { data: driverProfile } = await supabase
      .from('driver_profiles')
      .select('id, email')
      .eq('user_id', candidateUserId)
      .single()

    const { data: developerProfile } = await supabase
      .from('developer_profiles')
      .select('id, email')
      .eq('user_id', candidateUserId)
      .single()

    // Prefer users.email but fall back to profile-level email if wallet-only signup
    const candidateEmail = candidate.email
      || driverProfile?.email
      || developerProfile?.email
      || null

    const isCandidate = 
      ['driver', 'developer'].includes(candidate.role || '') ||
      !!driverProfile ||
      !!developerProfile

    if (!isCandidate) {
      return NextResponse.json(
        { error: 'User is not a candidate (driver or developer)' },
        { status: 400 }
      )
    }

    // Check for duplicate pending requests of the same type
    const { data: existingRequest } = await supabase
      .from('candidate_requests')
      .select('id')
      .eq('company_id', companyId)
      .eq('candidate_user_id', candidateUserId)
      .eq('request_type', requestType)
      .in('status', ['pending', 'viewed'])
      .single()

    if (existingRequest) {
      return NextResponse.json(
        { error: 'A pending request of this type already exists for this candidate' },
        { status: 409 }
      )
    }

    // Calculate expiration
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + expiresInDays)

    // Create the request
    const { data: newRequest, error: insertError } = await supabase
      .from('candidate_requests')
      .insert({
        company_id: companyId,
        requested_by_user_id: employer.id,
        candidate_user_id: candidateUserId,
        request_type: requestType,
        document_type: documentType || null,
        message: message || null,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single()

    if (insertError) {
      console.error('[CANDIDATE REQUEST] Insert error:', insertError)
      return NextResponse.json(
        { error: 'Failed to create request' },
        { status: 500 }
      )
    }

    console.log(`[CANDIDATE REQUEST] Created request ${newRequest.id} for candidate ${candidateUserId}`)

    const requestLabels: Record<string, string> = {
      mvr_order: 'Background Check & MVR Request',
      document_upload: 'Document Upload Request',
      verification: 'Employment Verification Request',
      profile_completion: 'Profile Completion Request',
      custom: 'New Request',
    }
    const notifTitle = requestLabels[requestType] || 'New Request'
    const notifBody = `${companyName} has sent you a ${requestLabels[requestType]?.toLowerCase() || 'request'}.${message ? ` Message: "${message}"` : ''}`

    // In-app notification (non-blocking, fire-and-forget)
    createNotification({
      userId: candidateUserId,
      type: 'candidate_request',
      title: notifTitle,
      body: notifBody,
      data: { companyName, requestType, requestId: newRequest.id },
    }).catch(err => console.error('[CANDIDATE REQUEST] Notification error:', err))

    // Resolve candidate name from user_profiles
    const { data: candidateProfile } = await supabase
      .from('user_profiles')
      .select('first_name, last_name')
      .eq('user_id', candidateUserId)
      .maybeSingle()

    const candidateName = [candidateProfile?.first_name, candidateProfile?.last_name].filter(Boolean).join(' ').trim() || 'Candidate'

    // Email notification (non-blocking)
    if (candidateEmail) {
      sendCandidateRequestNotification({
        candidateEmail,
        candidateName,
        companyName,
        requestType: requestType as 'mvr_order' | 'document_upload' | 'verification' | 'profile_completion' | 'custom',
        documentType: documentType || null,
        message: message || null,
      }).then(result => {
        if (result.ok) {
          console.log(`[CANDIDATE REQUEST] Email sent to ${candidateEmail}`)
        } else {
          console.warn(`[CANDIDATE REQUEST] Email failed: ${result.error}`)
        }
      }).catch(err => {
        console.error('[CANDIDATE REQUEST] Email error:', err)
      })
    } else {
      console.log('[CANDIDATE REQUEST] Candidate has no email, skipping email notification')
    }

    return NextResponse.json({
      success: true,
      request: {
        id: newRequest.id,
        requestType: newRequest.request_type,
        documentType: newRequest.document_type,
        message: newRequest.message,
        status: newRequest.status,
        expiresAt: newRequest.expires_at,
        createdAt: newRequest.created_at,
      },
    })

  } catch (error) {
    console.error('[CANDIDATE REQUEST] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/employer/talent/[userId]/request
 * 
 * Cancels a pending request by ID so the employer can resend it.
 * Body: { requestId: string }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    const { userId: candidateUserId } = await params
    const { requestId } = await request.json()

    if (!walletAddress || !requestId) {
      return NextResponse.json(
        { error: 'walletAddress and requestId are required' },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    // Verify employer identity
    const { data: employer } = await supabase
      .from('users')
      .select('id')
      .ilike('wallet_address', walletAddress)
      .single()

    if (!employer) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get company
    const { data: membership } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', employer.id)
      .eq('is_active', true)
      .single()

    let companyId = membership?.company_id || null
    if (!companyId) {
      const { data: legacyCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('employer_user_id', employer.id)
        .single()
      companyId = legacyCompany?.id || null
    }

    if (!companyId) {
      return NextResponse.json({ error: 'No company access' }, { status: 403 })
    }

    // Only allow cancelling requests that belong to this company + candidate
    const { error: updateError } = await supabase
      .from('candidate_requests')
      .update({ status: 'cancelled' })
      .eq('id', requestId)
      .eq('company_id', companyId)
      .eq('candidate_user_id', candidateUserId)
      .in('status', ['pending', 'viewed'])

    if (updateError) {
      console.error('[CANDIDATE REQUEST] Cancel error:', updateError)
      return NextResponse.json({ error: 'Failed to cancel request' }, { status: 500 })
    }

    console.log(`[CANDIDATE REQUEST] Cancelled request ${requestId}`)
    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('[CANDIDATE REQUEST] PATCH unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET /api/employer/talent/[userId]/request
 * 
 * Gets all requests from this company to a specific candidate.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    const { userId: candidateUserId } = await params

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 401 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    // Verify employer
    const { data: employer } = await supabase
      .from('users')
      .select('id')
      .ilike('wallet_address', walletAddress)
      .single()

    if (!employer) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get company
    const { data: membership } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', employer.id)
      .eq('is_active', true)
      .single()

    let companyId = membership?.company_id || null

    if (!companyId) {
      const { data: legacyCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('employer_user_id', employer.id)
        .single()

      companyId = legacyCompany?.id || null
    }

    if (!companyId) {
      return NextResponse.json({ error: 'No company access' }, { status: 403 })
    }

    // Get requests
    const { data: requests, error } = await supabase
      .from('candidate_requests')
      .select('*')
      .eq('company_id', companyId)
      .eq('candidate_user_id', candidateUserId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[CANDIDATE REQUEST] Fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      requests: (requests || []).map(r => ({
        id: r.id,
        requestType: r.request_type,
        documentType: r.document_type,
        message: r.message,
        status: r.status,
        completedAt: r.completed_at,
        expiresAt: r.expires_at,
        createdAt: r.created_at,
      })),
    })

  } catch (error) {
    console.error('[CANDIDATE REQUEST] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
