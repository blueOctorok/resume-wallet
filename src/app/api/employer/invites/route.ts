import { NextRequest, NextResponse } from 'next/server'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getBlockDefinition } from '@/lib/block-registry'
import { isRecruiterStatus, mapRecruiterStatusColumn } from '@/lib/employer-recruiter-pipeline'
import { isInviteStatus } from '@/components/employer/outreach/types'
import { syncOutreachInvitesForCompany } from '@/lib/sync-outreach-invite-status'
import { normalizeToE164 } from '@/lib/phone-e164'
import { getEmployerCompanyAccess } from '@/lib/employer-company-access'
import { can, capabilityDeniedMessage } from '@/lib/employer-permissions'
import crypto from 'crypto'

const RECRUITER_NOTES_MAX = 8000

type InviteDbRow = {
  id: string
  token: string
  candidate_email: string | null
  candidate_phone?: string | null
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
  sms_sent_at?: string | null
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
    candidatePhone: invite.candidate_phone ?? null,
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
    smsSentAt: invite.sms_sent_at || null,
  }
}

/**
 * Helper to get employer's company ID and user ID
 */
async function getEmployerContext(
  supabase: Awaited<ReturnType<typeof getAdminSupabaseClient>>,
  employerUserId: string
): Promise<{
  companyId?: string
  userId?: string
  companyName?: string
  companyRole?: string
  error?: string
  status?: number
}> {
  const access = await getEmployerCompanyAccess(supabase, employerUserId)
  if (!access) return { error: 'No company found. Set up your company first.', status: 403 }

  // Get company name for invite context
  const { data: company } = await supabase
    .from('companies')
    .select('company_name')
    .eq('id', access.companyId)
    .single()

  return {
    companyId: access.companyId,
    userId: employerUserId,
    companyName: company?.company_name,
    companyRole: access.companyRole,
  }
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
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()
    const ctx = await getEmployerContext(supabase, userId)

    if (ctx.error) {
      if (ctx.status === 403) return NextResponse.json({ invites: [] })
      return NextResponse.json({ error: ctx.error }, { status: ctx.status })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'all'
    // Optional explicit cap — only applied when caller asks for one.
    // The default kanban request does NOT pass `limit`, so the result is
    // bounded by the data lifecycle (30-day pending expiry, 14-day archive
    // for completed) rather than an arbitrary row count. The 2026-05-28 bug
    // where Sean Buckner "disappeared" was caused by a hardcoded 50-row cap +
    // ORDER BY created_at DESC: as Pace's daily new-invite volume crossed 50,
    // older active rows fell off the bottom of the response. Removing the
    // default cap and sorting by `updated_at` (recency-of-activity, not
    // recency-of-creation) prevents that class of bug.
    const explicitLimit = searchParams.get('limit')
    const limit = explicitLimit ? parseInt(explicitLimit) : null

    let query = supabase
      .from('application_invites')
      .select(`
        id, token, candidate_email, candidate_phone, candidate_name, status, type,
        target_block_type,
        job_posting_id, view_count, expires_at, created_at, updated_at,
        used_at, used_by_user_id, driver_application_id, email_sent_at, sms_sent_at,
        recruiter_status, recruiter_notes,
        job_postings(title),
        users!application_invites_used_by_user_id_fkey(email)
      `)
      .eq('company_id', ctx.companyId)
      .order('updated_at', { ascending: false })

    if (limit !== null && Number.isFinite(limit) && limit > 0) {
      query = query.limit(limit)
    }

    if (status !== 'all') {
      if (status === 'active') {
        query = query.in('status', ['pending', 'viewed', 'in_progress'])
      } else {
        query = query.eq('status', status)
      }
    }

    // Backfill kanban columns: screening reports may have landed while invite.status
    // was still `in_progress` (webhook/reconcile did not run invite sync yet).
    await syncOutreachInvitesForCompany(supabase, ctx.companyId!)

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
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()
    const ctx = await getEmployerContext(supabase, userId)

    if (ctx.error) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status })
    }

    const body = await request.json()
    const {
      targetBlockType,
      candidateEmail,
      candidatePhone,
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

    // ── Screening invite dedup ─────────────────────────────────────────────
    // The unified consent flow (driver-screening-consent) supersedes the old
    // per-block invites (driver-psp, driver-mvr). Those blocks are now
    // direct-order-only — employers run them from the edit modal after consent.
    const DIRECT_ORDER_ONLY = ['driver-psp', 'driver-mvr']
    if (targetBlockType && DIRECT_ORDER_ONLY.includes(targetBlockType)) {
      return NextResponse.json(
        { error: 'MVR and PSP are now ordered directly after consent is collected. Send a Screening Consent invite instead.' },
        { status: 400 },
      )
    }

    if (targetBlockType === 'driver-screening-consent' && candidateEmail) {
      // Cancel any stale legacy per-block invites that are now superseded
      const emailLower = candidateEmail.trim().toLowerCase()
      await supabase
        .from('application_invites')
        .update({ status: 'cancelled' })
        .eq('company_id', ctx.companyId)
        .ilike('candidate_email', emailLower)
        .in('target_block_type', DIRECT_ORDER_ONLY)
        .in('status', ['pending', 'viewed'])
    }

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

    let phoneToStore: string | null = null
    if (candidatePhone) {
      const normalized = normalizeToE164(String(candidatePhone))
      if (!normalized) {
        return NextResponse.json(
          { error: 'Invalid phone number. Use a US 10-digit number or E.164 (+1…).' },
          { status: 400 },
        )
      }
      phoneToStore = normalized
    }

    const { data: invite, error } = await supabase
      .from('application_invites')
      .insert({
        company_id: ctx.companyId,
        created_by_user_id: ctx.userId,
        token,
        type,
        target_block_type: targetBlockType || null,
        candidate_email: candidateEmail || null,
        candidate_phone: phoneToStore,
        candidate_name: candidateName || null,
        candidate_user_id: candidateUserId || null,
        job_posting_id: jobPostingId || null,
        welcome_message: welcomeMessage || null,
        expires_at: expiresAt.toISOString(),
      })
      .select(
        `
        id, token, candidate_email, candidate_phone, candidate_name, status, type, target_block_type,
        job_posting_id, view_count, expires_at, created_at, updated_at, used_at, used_by_user_id,
        driver_application_id, email_sent_at, sms_sent_at, recruiter_status, recruiter_notes,
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
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()
    const ctx = await getEmployerContext(supabase, userId)

    if (ctx.error) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status })
    }

    const body = await request.json()
    const {
      id,
      status,
      candidateName,
      candidateEmail,
      candidatePhone,
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
      candidatePhone?: string
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
    // Allowed for any non-terminal invite. Cancelled / expired are blocked
    // because the link is dead. Completed is allowed because the screening
    // relationship is long-lived (Pace may run annual MVR re-pulls, etc.) and
    // the consent bundle's audit-relevant fields (signed names, signed_at,
    // SSN) live in `bgcheck_consents` / `psp_consents` / `screening_consent_bundles`,
    // not on the invite — so editing the invite's display name/email after
    // completion does not affect compliance records.
    const isFieldEdit = status === undefined && (
      candidateName !== undefined ||
      candidateEmail !== undefined ||
      candidatePhone !== undefined ||
      jobPostingId !== undefined ||
      welcomeMessage !== undefined
    )

    if (isFieldEdit) {
      if (['cancelled', 'expired'].includes(existing.status)) {
        return NextResponse.json(
          { error: 'Cancelled or expired invites cannot be edited' },
          { status: 400 },
        )
      }

      const patch: Record<string, string | null> = {}
      if (candidateName !== undefined) patch.candidate_name = candidateName || null
      if (candidateEmail !== undefined) patch.candidate_email = candidateEmail || null
      if (candidatePhone !== undefined) {
        if (!candidatePhone) {
          patch.candidate_phone = null
        } else {
          const normalized = normalizeToE164(String(candidatePhone))
          if (!normalized) {
            return NextResponse.json(
              { error: 'Invalid phone number. Use a US 10-digit number or E.164 (+1…).' },
              { status: 400 },
            )
          }
          patch.candidate_phone = normalized
        }
      }
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
          candidatePhone: updated.candidate_phone ?? null,
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
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()
    const ctx = await getEmployerContext(supabase, userId)

    if (ctx.error) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status })
    }

    if (!can(ctx.companyRole, 'manageCandidates')) {
      return NextResponse.json(
        { error: capabilityDeniedMessage('manageCandidates') },
        { status: 403 }
      )
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
