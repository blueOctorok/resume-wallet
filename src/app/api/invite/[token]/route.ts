import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

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
        id, token, status, type, candidate_email, candidate_name,
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
        type: (invite as any).type || 'driver_dot',
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

    // Get the invite
    const { data: invite, error: fetchError } = await supabase
      .from('application_invites')
      .select('id, status, expires_at')
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

    // Update invite status
    const updateData: any = {
      status: 'in_progress',
    }
    if (userId) {
      updateData.used_by_user_id = userId
      updateData.used_at = new Date().toISOString()
    }

    const { error: updateError } = await supabase
      .from('application_invites')
      .update(updateData)
      .eq('id', invite.id)

    if (updateError) {
      console.error('[INVITE START] Update error:', updateError)
      return NextResponse.json({ error: 'Failed to update invite' }, { status: 500 })
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
      .select('id, status')
      .eq('token', token)
      .single()

    if (fetchError || !invite) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
    }

    // Get user ID from wallet address
    let userId = null
    if (walletAddress) {
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .ilike('wallet_address', walletAddress)
        .single()
      
      userId = user?.id || null
    }

    // Update invite to completed
    const updateData: any = {
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

    return NextResponse.json({ 
      success: true,
      inviteId: invite.id,
    })

  } catch (error) {
    console.error('[INVITE COMPLETE] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
