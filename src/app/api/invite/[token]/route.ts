import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getBlockDefinition } from '@/lib/block-registry'
import { ensureHubBlocksForPspMvrBundle } from '@/lib/ensure-hub-blocks-psp-mvr-bundle'
import { notifyEmployerCandidateActionComplete } from '@/lib/notify-employer-candidate-action'

/**
 * GET /api/invite/[token]
 * Public route to validate an application invite and get context
 * 
 * Returns:
 *   - Company name (for display)
 *   - Job title (if invite is tied to a job)
 *   - Welcome message (if set)
 *   - Status (to show appropriate UI)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()

    // Fetch invite with company and job info
    const { data: invite, error } = await supabase
      .from('application_invites')
      .select(`
        id, token, status, type, target_block_type, candidate_email, candidate_name,
        welcome_message, job_posting_id, expires_at, created_at, view_count,
        companies(id, company_name),
        job_postings(id, title, description, location_city, location_state)
      `)
      .eq('token', token)
      .single()

    if (error) {
      console.error('[INVITE VALIDATION] Database error:', error)
      return NextResponse.json({ 
        error: 'Database error',
        details: error.message,
        valid: false 
      }, { status: 500 })
    }

    if (!invite) {
      console.log('[INVITE VALIDATION] No invite found for token:', token)
      return NextResponse.json({ 
        error: 'Invite not found',
        valid: false 
      }, { status: 404 })
    }

    // Check if expired
    const isExpired = invite.expires_at && new Date(invite.expires_at) < new Date()
    
    // Check if already completed
    const isCompleted = invite.status === 'completed'
    
    // Check if cancelled
    const isCancelled = invite.status === 'cancelled'

    // Determine if invite is usable
    const isValid = !isExpired && !isCompleted && !isCancelled

    // Update view count and last_viewed_at (only if valid and not already in use)
    if (isValid && invite.status === 'pending') {
      await supabase
        .from('application_invites')
        .update({ 
          view_count: (invite.view_count || 0) + 1,
          last_viewed_at: new Date().toISOString(),
          status: 'viewed'
        })
        .eq('id', invite.id)
    }

    const company = invite.companies as any
    const job = invite.job_postings as any

    return NextResponse.json({
      valid: isValid,
      invite: {
        id: invite.id,
        status: isExpired ? 'expired' : invite.status,
        type: (invite as any).type || 'general',
        targetBlockType: (invite as any).target_block_type || null,
        candidateEmail: invite.candidate_email,
        candidateName: invite.candidate_name,
        welcomeMessage: invite.welcome_message,
        expiresAt: invite.expires_at,
      },
      company: company ? {
        id: company.id,
        name: company.company_name,
      } : null,
      job: job ? {
        id: job.id,
        title: job.title,
        description: job.description,
        location: job.location_city && job.location_state 
          ? `${job.location_city}, ${job.location_state}`
          : job.location_city || job.location_state || null,
      } : null,
      // Reason why not valid (for UI)
      invalidReason: !isValid 
        ? isExpired ? 'expired' 
          : isCompleted ? 'completed' 
          : isCancelled ? 'cancelled' 
          : null
        : null,
    })

  } catch (error) {
    console.error('[INVITE VALIDATION] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/invite/[token]
 * Mark invite as in_progress when candidate starts the application
 * 
 * Body:
 *   walletAddress - The candidate's wallet address
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await request.json()
    const { walletAddress } = body

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()

    // Get the invite (include company + block info for screening request creation)
    const { data: invite, error: fetchError } = await supabase
      .from('application_invites')
      .select('id, status, expires_at, company_id, created_by_user_id, target_block_type')
      .eq('token', token)
      .single()

    if (fetchError || !invite) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
    }

    // Check if expired or already used
    const isExpired = invite.expires_at && new Date(invite.expires_at) < new Date()
    if (isExpired || invite.status === 'completed' || invite.status === 'cancelled') {
      return NextResponse.json({ error: 'Invite is no longer valid' }, { status: 400 })
    }

    // Get user ID from wallet address (if logged in)
    let userId = null
    if (walletAddress) {
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .ilike('wallet_address', walletAddress)
        .single()
      
      userId = user?.id || null
    }

    // Starting onboarding ≠ consent signed. We record who claimed the invite
    // and mark it `viewed` (engaged), but NOT `in_progress` — that status is
    // reserved for "consent bundle fully filled out + signed" and is set by
    // sync-outreach-invite-status once the bundle is complete. Never downgrade
    // an invite that already advanced (in_progress / completed handled above).
    const updateData: Record<string, unknown> = {}
    if (userId) {
      updateData.used_by_user_id = userId
      updateData.used_at = new Date().toISOString()
    }
    if (invite.status === 'pending') {
      updateData.status = 'viewed'
    }

    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from('application_invites')
        .update(updateData)
        .eq('id', invite.id)

      if (updateError) {
        console.error('[INVITE START] Update error:', updateError)
        return NextResponse.json({ error: 'Failed to update invite' }, { status: 500 })
      }
    }

    // For screening blocks (MVR, PSP, unified consent), create a candidate_requests
    // record so the disclosure/consent gate fires when the candidate lands on the form.
    // Without this, invite-based deep-links bypass disclosure entirely.
    const screeningBlocks = ['driver-mvr', 'driver-psp', 'driver-screening-consent']
    const targetBlock = invite.target_block_type
    if (userId && targetBlock && screeningBlocks.includes(targetBlock)) {
      const requestType =
        targetBlock === 'driver-mvr' ? 'mvr_order'
        : targetBlock === 'driver-psp' ? 'psp_order'
        : 'block_request'

      const blockDef = getBlockDefinition(targetBlock)
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 30)

      // Only create if no pending screening request already exists (idempotent).
      // Use broad OR filter: any of the screening pipeline types count as a dupe.
      const { data: existing } = await supabase
        .from('candidate_requests')
        .select('id')
        .eq('candidate_user_id', userId)
        .eq('company_id', invite.company_id)
        .in('status', ['pending', 'viewed'])
        .or(
          'request_type.eq.mvr_order,request_type.eq.psp_order,and(request_type.eq.block_request,target_block_type.eq.driver-screening-consent)',
        )
        .maybeSingle()

      if (!existing) {
        const { error: reqError } = await supabase
          .from('candidate_requests')
          .insert({
            company_id: invite.company_id,
            requested_by_user_id: invite.created_by_user_id,
            candidate_user_id: userId,
            request_type: requestType,
            target_block_type: targetBlock,
            message: `Invited via outreach to complete ${blockDef?.label ?? targetBlock}`,
            status: 'pending',
            expires_at: expiresAt.toISOString(),
          })

        if (reqError) {
          console.error('[INVITE START] Failed to create screening request:', reqError)
        } else {
          console.log(`[INVITE START] Created ${requestType} candidate_request for invite ${invite.id}`)
        }
      }

      // Screening consent and PSP both need the full MVR + PSP hub block set
      // so My Files and career card sections appear correctly.
      if (targetBlock === 'driver-psp' || targetBlock === 'driver-screening-consent') {
        await ensureHubBlocksForPspMvrBundle(supabase, userId)
      }
    }

    return NextResponse.json({ 
      success: true,
      inviteId: invite.id,
    })

  } catch (error) {
    console.error('[INVITE START] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/invite/[token]
 * Mark invite as completed when candidate finishes the application
 * 
 * Body:
 *   driverApplicationId - The completed application ID
 *   walletAddress - The candidate's wallet address
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await request.json()
    const { driverApplicationId, walletAddress } = body

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    const supabase = await getAdminSupabaseClient()

    // Get the invite
    const { data: invite, error: fetchError } = await supabase
      .from('application_invites')
      .select(
        'id, status, company_id, created_by_user_id, target_block_type, used_by_user_id, candidate_name',
      )
      .eq('token', token)
      .single()

    if (fetchError || !invite) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
    }

    if (invite.status === 'completed') {
      return NextResponse.json({ success: true, inviteId: invite.id, alreadyCompleted: true })
    }

    // Get user ID from wallet address
    let userId: string | null = null
    if (walletAddress) {
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .ilike('wallet_address', walletAddress)
        .single()

      userId = user?.id || null
    }

    const candidateUserId = userId ?? (invite.used_by_user_id as string | null)

    // Update invite to completed
    const updateData: Record<string, unknown> = {
      status: 'completed',
    }
    if (driverApplicationId) {
      updateData.driver_application_id = driverApplicationId
    }
    if (userId && !invite.used_by_user_id) {
      updateData.used_by_user_id = userId
      updateData.used_at = new Date().toISOString()
    }

    const { error: updateError } = await supabase
      .from('application_invites')
      .update(updateData)
      .eq('id', invite.id)

    if (updateError) {
      console.error('[INVITE COMPLETE] Update error:', updateError)
      return NextResponse.json({ error: 'Failed to update invite' }, { status: 500 })
    }

    if (candidateUserId && invite.created_by_user_id) {
      const blockDef = invite.target_block_type
        ? getBlockDefinition(invite.target_block_type as string)
        : undefined
      const { data: company } = await supabase
        .from('companies')
        .select('company_name')
        .eq('id', invite.company_id)
        .maybeSingle()
      const companyName =
        (company as { company_name?: string } | null)?.company_name?.trim() || 'Your company'

      void notifyEmployerCandidateActionComplete(supabase, {
        kind: 'invite_completed',
        employerUserId: invite.created_by_user_id as string,
        companyId: invite.company_id as string,
        companyName,
        candidateUserId,
        candidateDisplayName: (invite.candidate_name as string | null) ?? undefined,
        blockLabel: blockDef?.label ?? null,
        notificationData: { inviteId: invite.id, targetBlockType: invite.target_block_type },
      })
    }

    return NextResponse.json({
      success: true,
      inviteId: invite.id,
    })

  } catch (error) {
    console.error('[INVITE COMPLETE] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
