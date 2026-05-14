import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getBlockDefinition } from '@/lib/block-registry'
import { isRecruiterStatus, mapRecruiterStatusColumn } from '@/lib/employer-recruiter-pipeline'
import { isInviteStatus } from '@/components/employer/outreach/types'
import crypto from 'crypto'

const RECRUITER_NOTES_MAX = 8000

type InviteDbRow = {
  id: string
  token: string
  candidate_email: string | null
  candidate_name: string | null
  status: string
  type?: string | null
  target_block_type?: string | null
  job_posting_id: string | null
  view_count: number
  expires_at: string | null
  created_at: string
  updated_at?: string
  used_at: string | null
  used_by_user_id?: string | null
  driver_application_id: string | null
  email_sent_at?: string | null
  recruiter_status?: string | null
  recruiter_notes?: string | null
  job_postings?: { title: string } | null
  users?: { email: string } | null
}

function mapInviteToClient(invite: InviteDbRow, baseUrl: string) {
  return {
    id: invite.id,
    token: invite.token,
    url: `${baseUrl}/apply/${invite.token}`,
    type: invite.type || 'general',
    targetBlockType: invite.target_block_type || null,
    candidateEmail: invite.candidate_email,
    candidateName: invite.candidate_name,
    status: invite.status,
    updatedAt: invite.updated_at ?? invite.created_at,
    recruiterStatus: mapRecruiterStatusColumn(invite.recruiter_status),
    recruiterNotes: invite.recruiter_notes ?? null,
    jobTitle: invite.job_postings?.title || null,
    jobPostingId: invite.job_posting_id,
    viewCount: invite.view_count,
    expiresAt: invite.expires_at,
    createdAt: invite.created_at,
    usedAt: invite.used_at,
    usedByUserId: invite.used_by_user_id || null,
    usedByName: invite.users?.email || null,
    driverApplicationId: invite.driver_application_id,
    emailSentAt: invite.email_sent_at || null,
  }
}

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
        used_at, used_by_user_id, driver_application_id, email_sent_at,
        recruiter_status, recruiter_notes,
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
      invites: (invites || []).map((invite) =>
        mapInviteToClient(invite as unknown as InviteDbRow, baseUrl),
      ),
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
      .select(
        `
        id, token, candidate_email, candidate_name, status, type, target_block_type,
        job_posting_id, view_count, expires_at, created_at, updated_at, used_at, used_by_user_id,
        driver_application_id, email_sent_at, recruiter_status, recruiter_notes,
        job_postings(title),
        users!application_invites_used_by_user_id_fkey(email)
      `,
      )
      .single()

    if (error) {
      console.error('[EMPLOYER INVITES] Create error:', error)
      return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    return NextResponse.json({
      success: true,
      invite: mapInviteToClient(invite as unknown as InviteDbRow, baseUrl),
      companyName: ctx.companyName,
    })

  } catch (error) {
    console.error('[EMPLOYER INVITES] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/employer/invites
 * Update an invite (cancel, restore, field edits, recruiter notes, employer status override).
 *
 * Body:
 *   id - Invite ID
 *   status - With `employerStatusOverride: true`, any valid lifecycle status (pending…expired).
 *            Without override: only `cancelled` or restore `pending` (from cancelled/expired).
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
    const {
      id,
      status,
      candidateName,
      candidateEmail,
      jobPostingId,
      welcomeMessage,
      recruiterStatus,
      recruiterNotes,
      employerStatusOverride,
    } = body as {
      id?: string
      status?: string
      candidateName?: string
      candidateEmail?: string
      jobPostingId?: string | null
      welcomeMessage?: string | null
      recruiterStatus?: string
      recruiterNotes?: string | null
      /** When true with `status`, employer may set lifecycle to any valid value (ops / stuck sync). */
      employerStatusOverride?: boolean
    }

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

    // ── Path 0: employer pipeline / notes (kanban + Jira-style description) ──
    const hasRecruiterPatch = recruiterStatus !== undefined || recruiterNotes !== undefined
    if (hasRecruiterPatch) {
      const patch: Record<string, string | null> = {}
      if (recruiterStatus !== undefined) {
        if (!isRecruiterStatus(recruiterStatus)) {
          return NextResponse.json({ error: 'Invalid recruiterStatus' }, { status: 400 })
        }
        patch.recruiter_status = recruiterStatus
      }
      if (recruiterNotes !== undefined) {
        const raw = recruiterNotes === null ? '' : String(recruiterNotes)
        const trimmed = raw.trim()
        patch.recruiter_notes = trimmed.length === 0 ? null : trimmed.slice(0, RECRUITER_NOTES_MAX)
      }

      if (Object.keys(patch).length === 0) {
        return NextResponse.json({ error: 'No recruiter fields to update' }, { status: 400 })
      }

      const { data: updated, error } = await supabase
        .from('application_invites')
        .update(patch)
        .eq('id', id)
        .select('id, recruiter_status, recruiter_notes')
        .single()

      if (error) {
        console.error('[EMPLOYER INVITES] Recruiter patch error:', error)
        return NextResponse.json({ error: 'Failed to update invite' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        invite: {
          id: updated.id,
          recruiterStatus: mapRecruiterStatusColumn(updated.recruiter_status),
          recruiterNotes: updated.recruiter_notes ?? null,
        },
      })
    }

    // ── Path 0.5: employer forced lifecycle status (kanban detail modal) ────
    // Requires explicit flag so normal PATCH `status` rules (cancel / restore)
    // stay unchanged for older clients.
    if (employerStatusOverride === true && status !== undefined) {
      if (typeof status !== 'string' || !isInviteStatus(status)) {
        return NextResponse.json({ error: 'Invalid invite status' }, { status: 400 })
      }
      console.log(
        `[EMPLOYER INVITES] employerStatusOverride invite=${id} ${String(existing.status)} → ${status} company=${ctx.companyId}`,
      )
      const { data: updated, error: overrideErr } = await supabase
        .from('application_invites')
        .update({ status })
        .eq('id', id)
        .eq('company_id', ctx.companyId)
        .select('id, status, updated_at')
        .single()

      if (overrideErr || !updated) {
        console.error('[EMPLOYER INVITES] Status override error:', overrideErr)
        return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        invite: {
          id: updated.id,
          status: updated.status,
          updatedAt: updated.updated_at ?? new Date().toISOString(),
        },
      })
    }

    // ── Path A: field-level edit (no status change) ──────────────────────────
    // Allowed while the candidate has not finished: pending / viewed / in_progress.
    // Block once completed (or terminal cancelled/expired) so edits do not fight
    // a finished consent flow or audit trail.
    const isFieldEdit = status === undefined && (
      candidateName !== undefined ||
      candidateEmail !== undefined ||
      jobPostingId !== undefined ||
      welcomeMessage !== undefined
    )

    if (isFieldEdit) {
      if (!['pending', 'viewed', 'in_progress'].includes(existing.status)) {
        return NextResponse.json(
          { error: 'Only invites that are still open (not completed or expired) can have their details edited' },
          { status: 400 },
        )
      }

      const patch: Record<string, string | null> = {}
      if (candidateName !== undefined) patch.candidate_name = candidateName || null
      if (candidateEmail !== undefined) patch.candidate_email = candidateEmail || null
      if (jobPostingId !== undefined) patch.job_posting_id = jobPostingId || null
      if (welcomeMessage !== undefined) patch.welcome_message = welcomeMessage || null

      const { data: updated, error } = await supabase
        .from('application_invites')
        .update(patch)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('[EMPLOYER INVITES] Field update error:', error)
        return NextResponse.json({ error: 'Failed to update invite' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        invite: {
          id: updated.id,
          candidateName: updated.candidate_name,
          candidateEmail: updated.candidate_email,
          jobPostingId: updated.job_posting_id,
          welcomeMessage: updated.welcome_message,
        },
      })
    }

    // ── Path B: status transition ────────────────────────────────────────────
    // Only allow specific transitions to keep status clean:
    //   - cancelled: from any active state (employer cancels)
    //   - pending  : restore-from-archive — ONLY when currently cancelled or expired,
    //                so we never re-open a real "completed" or "in_progress" invite.
    const allowedStatuses = ['cancelled', 'pending']
    if (!allowedStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    if (status === 'pending' && !['cancelled', 'expired'].includes(existing.status)) {
      return NextResponse.json(
        { error: 'Only cancelled or expired invites can be restored' },
        { status: 400 },
      )
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

/**
 * DELETE /api/employer/invites?id=<uuid>
 * Permanently remove an invite for this company (link stops working).
 */
export async function DELETE(request: NextRequest) {
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

    const id = new URL(request.url).searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Invite id is required' }, { status: 400 })
    }

    const { data: existing } = await supabase
      .from('application_invites')
      .select('id')
      .eq('id', id)
      .eq('company_id', ctx.companyId)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
    }

    const { error } = await supabase.from('application_invites').delete().eq('id', id)

    if (error) {
      console.error('[EMPLOYER INVITES] Delete error:', error)
      return NextResponse.json({ error: 'Failed to remove invite' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[EMPLOYER INVITES] Unexpected delete error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
