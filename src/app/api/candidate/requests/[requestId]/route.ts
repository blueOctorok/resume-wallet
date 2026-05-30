import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { getBlockDefinition } from '@/lib/block-registry'
import { notifyEmployerCandidateActionComplete } from '@/lib/notify-employer-candidate-action'

/**
 * PATCH /api/candidate/requests/[requestId]
 * 
 * Updates a request status. Candidates can:
 *   - Mark as 'viewed' (automatically done when viewing)
 *   - Mark as 'completed' (when they've fulfilled the request)
 *   - Mark as 'declined' (if they don't want to fulfill)
 * 
 * Body:
 *   - status: 'viewed' | 'completed' | 'declined'
 *   - completedReferenceId: Optional UUID reference to the created item (e.g., uploaded doc ID)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const { requestId } = await params
    const body = await request.json()

    const { status, completedReferenceId } = body

    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    if (!requestId) {
      return NextResponse.json(
        { error: 'Request ID is required' },
        { status: 400 }
      )
    }

    const validStatuses = ['viewed', 'completed', 'declined']
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `status must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    // Verify the request belongs to this candidate
    const { data: existingRequest } = await supabase
      .from('candidate_requests')
      .select(
        'id, status, candidate_user_id, company_id, requested_by_user_id, request_type, target_block_type',
      )
      .eq('id', requestId)
      .single()

    if (!existingRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    if (existingRequest.candidate_user_id !== userId) {
      return NextResponse.json(
        { error: 'You can only update your own requests' },
        { status: 403 }
      )
    }

    // Don't allow updating already completed/declined/cancelled requests
    if (['completed', 'declined', 'cancelled', 'expired'].includes(existingRequest.status)) {
      return NextResponse.json(
        { error: `Cannot update a request that is already ${existingRequest.status}` },
        { status: 400 }
      )
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    }

    if (status === 'completed') {
      updateData.completed_at = new Date().toISOString()
      if (completedReferenceId) {
        updateData.completed_reference_id = completedReferenceId
      }
    }

    // Update the request
    const { data: updatedRequest, error: updateError } = await supabase
      .from('candidate_requests')
      .update(updateData)
      .eq('id', requestId)
      .select()
      .single()

    if (updateError) {
      console.error('[CANDIDATE REQUEST UPDATE] Error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update request' },
        { status: 500 }
      )
    }

    console.log(`[CANDIDATE REQUEST] Updated request ${requestId} to status: ${status}`)

    if (
      status === 'completed' &&
      existingRequest.status !== 'completed' &&
      existingRequest.requested_by_user_id
    ) {
      const skipEmailForDedicatedHandlers =
        existingRequest.request_type === 'block_request' &&
        existingRequest.target_block_type === 'driver-screening-consent'

      if (!skipEmailForDedicatedHandlers) {
        const blockDef = existingRequest.target_block_type
          ? getBlockDefinition(existingRequest.target_block_type as string)
          : undefined
        const { data: company } = await supabase
          .from('companies')
          .select('company_name')
          .eq('id', existingRequest.company_id)
          .maybeSingle()
        const companyName =
          (company as { company_name?: string } | null)?.company_name?.trim() || 'Your company'

        void notifyEmployerCandidateActionComplete(supabase, {
          kind: 'block_completed',
          employerUserId: existingRequest.requested_by_user_id as string,
          companyId: existingRequest.company_id as string,
          companyName,
          candidateUserId: userId,
          blockLabel: blockDef?.label ?? null,
          notificationData: {
            requestId,
            requestType: existingRequest.request_type,
            targetBlockType: existingRequest.target_block_type,
          },
        })
      }
    }

    return NextResponse.json({
      success: true,
      request: {
        id: updatedRequest.id,
        requestType: updatedRequest.request_type,
        documentType: updatedRequest.document_type,
        message: updatedRequest.message,
        status: updatedRequest.status,
        completedAt: updatedRequest.completed_at,
        expiresAt: updatedRequest.expires_at,
        createdAt: updatedRequest.created_at,
      },
    })

  } catch (error) {
    console.error('[CANDIDATE REQUEST UPDATE] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET /api/candidate/requests/[requestId]
 * 
 * Gets a single request with full details.
 * Also marks it as 'viewed' if currently 'pending'.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const { requestId } = await params

    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()

    // Get the request with company info
    const { data: req, error } = await supabase
      .from('candidate_requests')
      .select(`
        *,
        company:companies(id, name, logo_url, website)
      `)
      .eq('id', requestId)
      .single()

    if (error || !req) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    if (req.candidate_user_id !== userId) {
      return NextResponse.json(
        { error: 'You can only view your own requests' },
        { status: 403 }
      )
    }

    // Auto-mark as viewed if pending
    if (req.status === 'pending') {
      await supabase
        .from('candidate_requests')
        .update({ status: 'viewed', updated_at: new Date().toISOString() })
        .eq('id', requestId)
      
      req.status = 'viewed'
    }

    return NextResponse.json({
      success: true,
      request: {
        id: req.id,
        requestType: req.request_type,
        documentType: req.document_type,
        message: req.message,
        status: req.status,
        completedAt: req.completed_at,
        completedReferenceId: req.completed_reference_id,
        expiresAt: req.expires_at,
        createdAt: req.created_at,
        company: req.company,
      },
    })

  } catch (error) {
    console.error('[CANDIDATE REQUEST GET] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
