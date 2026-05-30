import { NextRequest, NextResponse } from 'next/server'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { sendCandidateRequestNotification } from '@/lib/send-admin-notification'
import { createNotification } from '@/lib/create-notification'
import { getBlockDefinition } from '@/lib/block-registry'
import { ensureHubBlocksForPspMvrBundle } from '@/lib/ensure-hub-blocks-psp-mvr-bundle'

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
    const userId = await getStormUserIdFromRequest(request)
    const { userId: candidateUserId } = await params
    const body = await request.json()

    const {
      requestType,
      documentType,
      message,
      expiresInDays = 30,
      targetBlockType,
    } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    if (!candidateUserId) {
      return NextResponse.json(
        { error: 'Candidate user ID is required' },
        { status: 400 }
      )
    }

    const validTypes = ['mvr_order', 'psp_order', 'document_upload', 'verification', 'profile_completion', 'custom', 'block_request']
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

    // Get company membership
    const { data: membership } = await supabase
      .from('company_members')
      .select('company_id, role')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single()

    let companyId = membership?.company_id || null

    if (!companyId) {
      const { data: legacyCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('employer_user_id', userId)
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
      .select('company_name')
      .eq('id', companyId)
      .single()

    const companyName = company?.company_name || 'A company'

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

    // Get email from user_profiles (identity data) as fallback for wallet-only signups
    const { data: candidateIdentity } = await supabase
      .from('user_profiles')
      .select('email')
      .eq('user_id', candidateUserId)
      .maybeSingle()

    const candidateEmail = candidate.email
      || candidateIdentity?.email
      || null

    // Block employers; all other roles (driver, developer, candidate, null) are valid
    if (candidate.role === 'employer') {
      return NextResponse.json(
        { error: 'Cannot send requests to an employer account' },
        { status: 400 }
      )
    }

    // Check for duplicate pending requests of the same type/block
    let dupeQuery = supabase
      .from('candidate_requests')
      .select('id')
      .eq('company_id', companyId)
      .eq('candidate_user_id', candidateUserId)
      .in('status', ['pending', 'viewed'])

    /** Employer screening packages all resolve to the screening-consent block + 3-step flow. */
    const isEmployerScreeningConsentPipeline =
      requestType === 'mvr_order' ||
      requestType === 'psp_order' ||
      (requestType === 'block_request' &&
        ['driver-screening-consent', 'driver-mvr', 'driver-psp'].includes(String(targetBlockType || '')))

    if (isEmployerScreeningConsentPipeline) {
      dupeQuery = dupeQuery.or(
        'request_type.eq.mvr_order,request_type.eq.psp_order,and(request_type.eq.block_request,target_block_type.eq.driver-screening-consent),and(request_type.eq.block_request,target_block_type.eq.driver-mvr),and(request_type.eq.block_request,target_block_type.eq.driver-psp)',
      )
    } else if (requestType === 'block_request' && targetBlockType) {
      dupeQuery = dupeQuery.eq('target_block_type', targetBlockType)
    } else {
      dupeQuery = dupeQuery.eq('request_type', requestType)
    }

    const { data: existingRequest } = await dupeQuery.maybeSingle()

    if (existingRequest) {
      return NextResponse.json(
        { error: 'A pending request of this type already exists for this candidate' },
        { status: 409 }
      )
    }

    // Calculate expiration
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + expiresInDays)

    const effectiveTargetBlockType = isEmployerScreeningConsentPipeline
      ? 'driver-screening-consent'
      : targetBlockType || null

    // Create the request
    const { data: newRequest, error: insertError } = await supabase
      .from('candidate_requests')
      .insert({
        company_id: companyId,
        requested_by_user_id: userId,
        candidate_user_id: candidateUserId,
        request_type: requestType,
        document_type: documentType || null,
        target_block_type: effectiveTargetBlockType,
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

    // Auto-install the target block on the candidate's hub (if they don't have it yet)
    const blockDef = effectiveTargetBlockType ? getBlockDefinition(effectiveTargetBlockType) : null
    if (effectiveTargetBlockType && blockDef) {
      const { data: existingBlock } = await supabase
        .from('hub_blocks')
        .select('id')
        .eq('user_id', candidateUserId)
        .eq('block_type', effectiveTargetBlockType)
        .maybeSingle()

      if (!existingBlock) {
        const { data: maxPos } = await supabase
          .from('hub_blocks')
          .select('position')
          .eq('user_id', candidateUserId)
          .order('position', { ascending: false })
          .limit(1)
          .maybeSingle()

        await supabase.from('hub_blocks').insert({
          user_id: candidateUserId,
          block_type: effectiveTargetBlockType,
          position: (maxPos?.position ?? -1) + 1,
        })
        console.log(
          `[CANDIDATE REQUEST] Auto-installed block ${effectiveTargetBlockType} for candidate ${candidateUserId}`,
        )
      }
    }

    // Screening consent is the on-ramp to MVR + PSP tiles (My Files + career card sections).
    if (isEmployerScreeningConsentPipeline) {
      await ensureHubBlocksForPspMvrBundle(supabase, candidateUserId)
    }

    // Deep-link: route to the block's page so the candidate lands right on it
    const blockPageRoute = blockDef?.pageRoute
    const actionUrl = blockPageRoute ? `/?onboard=${blockPageRoute}` : null

    const requestLabels: Record<string, string> = {
      mvr_order: 'Background Check & MVR Request',
      psp_order: 'Background Check & PSP Request',
      document_upload: 'Document Upload Request',
      verification: 'Employment Verification Request',
      profile_completion: 'Profile Completion Request',
      custom: 'New Request',
      block_request: blockDef ? `${blockDef.label} Request` : 'New Request',
    }
    const notifTitle = requestLabels[requestType] || 'New Request'
    const notifBody = blockDef
      ? `${companyName} has requested your ${blockDef.label}.${message ? ` Message: "${message}"` : ''}`
      : `${companyName} has sent you a ${requestLabels[requestType]?.toLowerCase() || 'request'}.${message ? ` Message: "${message}"` : ''}`

    // In-app notification — includes deep-link so bell click routes to the block
    createNotification({
      userId: candidateUserId,
      type: 'candidate_request',
      title: notifTitle,
      body: notifBody,
      actionUrl: actionUrl ?? undefined,
      data: {
        companyName,
        requestType,
        requestId: newRequest.id,
        targetBlockType: effectiveTargetBlockType ?? targetBlockType ?? undefined,
      },
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
        requestType: requestType as 'mvr_order' | 'psp_order' | 'document_upload' | 'verification' | 'profile_completion' | 'custom' | 'block_request',
        documentType: documentType || null,
        message: message || null,
        blockLabel: blockDef?.label ?? null,
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
    const userId = await getStormUserIdFromRequest(request)
    const { userId: candidateUserId } = await params
    const { requestId } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    if (!requestId) {
      return NextResponse.json(
        { error: 'requestId is required' },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    // Get company
    const { data: membership } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single()

    let companyId = membership?.company_id || null
    if (!companyId) {
      const { data: legacyCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('employer_user_id', userId)
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
    const userId = await getStormUserIdFromRequest(request)
    const { userId: candidateUserId } = await params

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    // Get company
    const { data: membership } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single()

    let companyId = membership?.company_id || null

    if (!companyId) {
      const { data: legacyCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('employer_user_id', userId)
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
        targetBlockType: r.target_block_type ?? null,
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
