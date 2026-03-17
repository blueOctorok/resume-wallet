import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getBlockDefinition } from '@/lib/block-registry'
import crypto from 'crypto'

/**
 * Helper to get employer's company ID and user ID
 */
async function getEmployerContext(
  supabase: Awaited<ReturnType<typeof getAdminSupabaseClient>>,
  walletAddress: string
): Promise<{ companyId?: string; userId?: string; companyName?: string; error?: string; status?: number }> {
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .ilike('wallet_address', walletAddress)
    .single()

  if (!user) return { error: 'User not found', status: 404 }

  const { data: membership } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  let companyId = membership?.company_id || null

  if (!companyId) {
    const { data: legacyCompany } = await supabase
      .from('companies')
      .select('id')
      .eq('employer_user_id', user.id)
      .single()

    companyId = legacyCompany?.id || null
  }

  if (!companyId) return { error: 'No company found. Set up your company first.', status: 403 }

  // Get company name for invite context
  const { data: company } = await supabase
    .from('companies')
    .select('company_name')
    .eq('id', companyId)
    .single()

  return { companyId, userId: user.id, companyName: company?.company_name }
}

/**
 * Generate a URL-safe token
 */
function generateToken(): string {
  return crypto.randomBytes(16).toString('base64url')
}

/**
 * GET /api/employer/invites
 * List all application invites for the employer's company
 * 
 * Query params:
 *   status - Filter by status (pending, completed, all)
 *   limit - Max results (default 50)
 */
export async function GET(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()
    const ctx = await getEmployerContext(supabase, walletAddress)

    if (ctx.error) {
      if (ctx.status === 403) return NextResponse.json({ invites: [] })
      return NextResponse.json({ error: ctx.error }, { status: ctx.status })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'all'
    const limit = parseInt(searchParams.get('limit') || '50')

    let query = supabase
      .from('application_invites')
      .select(`
        id, token, candidate_email, candidate_name, status, type,
        target_block_type,
        job_posting_id, view_count, expires_at, created_at, updated_at,
        used_at, driver_application_id, email_sent_at,
        job_postings(title),
        users!application_invites_used_by_user_id_fkey(email)
      `)
      .eq('company_id', ctx.companyId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status !== 'all') {
      if (status === 'active') {
        query = query.in('status', ['pending', 'viewed', 'in_progress'])
      } else {
        query = query.eq('status', status)
      }
    }

    const { data: invites, error } = await query

    if (error) {
      console.error('[EMPLOYER INVITES] Fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch invites' }, { status: 500 })
    }

    // Transform to cleaner response
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    
    return NextResponse.json({
      invites: (invites || []).map(invite => ({
        id: invite.id,
        token: invite.token,
        url: `${baseUrl}/apply/${invite.token}`,
        type: (invite as any).type || 'general',
        targetBlockType: (invite as any).target_block_type || null,
        candidateEmail: invite.candidate_email,
        candidateName: invite.candidate_name,
        status: invite.status,
        jobTitle: (invite.job_postings as any)?.title || null,
        jobPostingId: invite.job_posting_id,
        viewCount: invite.view_count,
        expiresAt: invite.expires_at,
        createdAt: invite.created_at,
        usedAt: invite.used_at,
        usedByName: (invite.users as any)?.email || null,
        driverApplicationId: invite.driver_application_id,
        emailSentAt: (invite as any).email_sent_at || null,
      })),
      companyName: ctx.companyName,
    })

  } catch (error) {
    console.error('[EMPLOYER INVITES] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/employer/invites
 * Create a new application invite link
 * 
 * Body:
 *   candidateEmail - Optional email for tracking
 *   candidateName - Optional name for tracking
 *   jobPostingId - Optional job to associate
 *   welcomeMessage - Optional custom message
 *   expiresInDays - Optional (default 30)
 */
export async function POST(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()
    const ctx = await getEmployerContext(supabase, walletAddress)

    if (ctx.error) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status })
    }

    const body = await request.json()
    const {
      targetBlockType,
      candidateEmail,
      candidateName,
      candidateUserId,
      jobPostingId,
      welcomeMessage,
      expiresInDays = 30,
    } = body

    // If a target block is specified, validate it exists in the registry
    if (targetBlockType) {
      const blockDef = getBlockDefinition(targetBlockType)
      if (!blockDef) {
        return NextResponse.json({ error: `Unknown block type: ${targetBlockType}` }, { status: 400 })
      }
    }

    // Derive type from presence of targetBlockType
    const type = targetBlockType ? 'block' : 'general'

    // Validate job posting belongs to company (if provided)
    if (jobPostingId) {
      const { data: job } = await supabase
        .from('job_postings')
        .select('id')
        .eq('id', jobPostingId)
        .eq('company_id', ctx.companyId)
        .single()

      if (!job) {
        return NextResponse.json({ error: 'Job posting not found' }, { status: 404 })
      }
    }

    // Generate unique token
    const token = generateToken()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + expiresInDays)

    const { data: invite, error } = await supabase
      .from('application_invites')
      .insert({
        company_id: ctx.companyId,
        created_by_user_id: ctx.userId,
        token,
        type,
        target_block_type: targetBlockType || null,
        candidate_email: candidateEmail || null,
        candidate_name: candidateName || null,
        candidate_user_id: candidateUserId || null,
        job_posting_id: jobPostingId || null,
        welcome_message: welcomeMessage || null,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('[EMPLOYER INVITES] Create error:', error)
      return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    return NextResponse.json({
      success: true,
      invite: {
        id: invite.id,
        token: invite.token,
        url: `${baseUrl}/apply/${invite.token}`,
        type: (invite as any).type || type,
        targetBlockType: (invite as any).target_block_type || null,
        candidateEmail: invite.candidate_email,
        candidateName: invite.candidate_name,
        status: invite.status,
        expiresAt: invite.expires_at,
        createdAt: invite.created_at,
      },
      companyName: ctx.companyName,
    })

  } catch (error) {
    console.error('[EMPLOYER INVITES] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/employer/invites
 * Update an invite (cancel, etc.)
 * 
 * Body:
 *   id - Invite ID
 *   status - New status (cancelled)
 */
export async function PATCH(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()
    const ctx = await getEmployerContext(supabase, walletAddress)

    if (ctx.error) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status })
    }

    const body = await request.json()
    const { id, status } = body

    if (!id) {
      return NextResponse.json({ error: 'Invite ID is required' }, { status: 400 })
    }

    // Validate invite belongs to company
    const { data: existing } = await supabase
      .from('application_invites')
      .select('id, status')
      .eq('id', id)
      .eq('company_id', ctx.companyId)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
    }

    // Only allow certain status transitions
    const allowedStatuses = ['cancelled']
    if (!allowedStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const { data: updated, error } = await supabase
      .from('application_invites')
      .update({ status })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[EMPLOYER INVITES] Update error:', error)
      return NextResponse.json({ error: 'Failed to update invite' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      invite: {
        id: updated.id,
        status: updated.status,
      },
    })

  } catch (error) {
    console.error('[EMPLOYER INVITES] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
