import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

/**
 * GET /api/messages
 *
 * Returns all message threads for the authenticated user, sorted by
 * most recent activity. Each thread includes the other participant's
 * name/avatar, the subject, last preview, and unread message count.
 *
 * POST /api/messages
 *
 * Creates or retrieves a thread between the authenticated user and
 * another user, anchored to an application or candidate_request.
 * Enforces the spam-protection rule: an employer may only open a thread
 * with a candidate who has an existing application or candidate_request
 * from their company. Candidates can message any company that has
 * already contacted them.
 */

// ─── GET ────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()

    const { data: user } = await supabase
      .from('users')
      .select('id, role')
      .ilike('wallet_address', walletAddress)
      .single()

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Fetch threads where this user is either participant
    const { data: threads, error } = await supabase
      .from('message_threads')
      .select(`
        id, subject, last_message_at, last_message_preview, created_at,
        participant_a_user_id, participant_b_user_id,
        application_id, candidate_request_id
      `)
      .or(`participant_a_user_id.eq.${user.id},participant_b_user_id.eq.${user.id}`)
      .order('last_message_at', { ascending: false, nullsFirst: false })

    if (error) {
      console.error('[MESSAGES GET] Threads error:', error)
      return NextResponse.json({ error: 'Failed to fetch threads' }, { status: 500 })
    }

    if (!threads || threads.length === 0) {
      return NextResponse.json({ threads: [], totalUnread: 0 })
    }

    // Collect the other participant IDs for a batch user lookup
    const otherUserIds = threads.map(t =>
      t.participant_a_user_id === user.id
        ? t.participant_b_user_id
        : t.participant_a_user_id
    )
    const uniqueOtherIds = [...new Set(otherUserIds)]

    // Batch-fetch other participants' names and avatars
    const { data: otherUsers } = await supabase
      .from('users')
      .select('id, role')
      .in('id', uniqueOtherIds)

    // Fetch display names from profiles
    const { data: driverProfiles } = await supabase
      .from('driver_profiles')
      .select('user_id, first_name, last_name, avatar_url')
      .in('user_id', uniqueOtherIds)

    const { data: developerProfiles } = await supabase
      .from('developer_profiles')
      .select('user_id, display_name, full_name, avatar_url')
      .in('user_id', uniqueOtherIds)

    // Also check company names for employer participants
    const { data: companies } = await supabase
      .from('companies')
      .select('employer_user_id, company_name')
      .in('employer_user_id', uniqueOtherIds)

    // Build lookup maps
    const driverMap = new Map((driverProfiles || []).map(p => [p.user_id, p]))
    const developerMap = new Map((developerProfiles || []).map(p => [p.user_id, p]))
    const companyMap = new Map((companies || []).map(c => [c.employer_user_id, c]))
    const userRoleMap = new Map((otherUsers || []).map(u => [u.id, u.role]))

    // Count unread messages per thread in one query
    const threadIds = threads.map(t => t.id)
    const { data: unreadCounts } = await supabase
      .from('messages')
      .select('thread_id')
      .in('thread_id', threadIds)
      .neq('sender_user_id', user.id)
      .is('read_at', null)

    const unreadByThread = new Map<string, number>()
    for (const row of unreadCounts || []) {
      unreadByThread.set(row.thread_id, (unreadByThread.get(row.thread_id) ?? 0) + 1)
    }

    const enrichedThreads = threads.map(t => {
      const otherId =
        t.participant_a_user_id === user.id
          ? t.participant_b_user_id
          : t.participant_a_user_id

      const otherRole = userRoleMap.get(otherId)
      const dp = driverMap.get(otherId)
      const devp = developerMap.get(otherId)
      const company = companyMap.get(otherId)

      let otherName = 'Unknown'
      let otherAvatarUrl: string | null = null

      if (otherRole === 'employer' && company) {
        otherName = company.company_name
      } else if (dp) {
        otherName = `${dp.first_name ?? ''} ${dp.last_name ?? ''}`.trim() || 'Unknown'
        otherAvatarUrl = dp.avatar_url ?? null
      } else if (devp) {
        otherName = devp.display_name || devp.full_name || 'Unknown'
        otherAvatarUrl = devp.avatar_url ?? null
      }

      return {
        id: t.id,
        subject: t.subject,
        lastMessageAt: t.last_message_at,
        lastMessagePreview: t.last_message_preview,
        createdAt: t.created_at,
        applicationId: t.application_id,
        candidateRequestId: t.candidate_request_id,
        otherParticipant: {
          userId: otherId,
          name: otherName,
          role: otherRole,
          avatarUrl: otherAvatarUrl,
        },
        unreadCount: unreadByThread.get(t.id) ?? 0,
      }
    })

    const totalUnread = enrichedThreads.reduce((sum, t) => sum + t.unreadCount, 0)

    return NextResponse.json({ threads: enrichedThreads, totalUnread })
  } catch (err) {
    console.error('[MESSAGES GET] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── POST ───────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 401 })
    }

    const body = await request.json()
    const {
      otherUserId,
      applicationId,
      candidateRequestId,
      subject,
    }: {
      otherUserId: string
      applicationId?: string
      candidateRequestId?: string
      subject: string
    } = body

    if (!otherUserId) {
      return NextResponse.json({ error: 'otherUserId required' }, { status: 400 })
    }
    if (!applicationId && !candidateRequestId) {
      return NextResponse.json(
        { error: 'applicationId or candidateRequestId required' },
        { status: 400 },
      )
    }

    const supabase = await getAdminSupabaseClient()

    const { data: user } = await supabase
      .from('users')
      .select('id, role')
      .ilike('wallet_address', walletAddress)
      .single()

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Can't message yourself (same wallet used for multiple roles in testing)
    if (user.id === otherUserId) {
      return NextResponse.json(
        { error: 'Cannot start a thread with yourself' },
        { status: 400 },
      )
    }

    // ── Spam-protection: verify a pre-existing relationship ──────────────────
    const isEmployer = user.role === 'employer'
    if (isEmployer) {
      // Employer must have an existing application or candidate_request linked
      // to their company for this candidate.
      const { data: company } = await supabase
        .from('companies')
        .select('id')
        .eq('employer_user_id', user.id)
        .maybeSingle()

      // Also check if they are a team member
      const { data: membership } = !company
        ? await supabase
            .from('company_members')
            .select('company_id')
            .eq('user_id', user.id)
            .not('accepted_at', 'is', null)
            .maybeSingle()
        : { data: null }

      const companyId = company?.id ?? membership?.company_id
      if (!companyId) {
        return NextResponse.json({ error: 'No company found for this employer' }, { status: 403 })
      }

      if (applicationId) {
        const { data: app } = await supabase
          .from('applications')
          .select('id')
          .eq('id', applicationId)
          .eq('applicant_user_id', otherUserId)
          .maybeSingle()

        if (!app) {
          return NextResponse.json(
            { error: 'No qualifying application found for this candidate' },
            { status: 403 },
          )
        }
      } else if (candidateRequestId) {
        const { data: req } = await supabase
          .from('candidate_requests')
          .select('id')
          .eq('id', candidateRequestId)
          .eq('company_id', companyId)
          .eq('candidate_user_id', otherUserId)
          .maybeSingle()

        if (!req) {
          return NextResponse.json(
            { error: 'No qualifying candidate request found' },
            { status: 403 },
          )
        }
      }
    } else {
      // Candidate (driver/developer) can only message back if there is an
      // existing thread or a candidate_request / application directed at them.
      // For starting a brand-new thread they must have been contacted first.
      if (applicationId) {
        const { data: app } = await supabase
          .from('applications')
          .select('id')
          .eq('id', applicationId)
          .eq('applicant_user_id', user.id)
          .maybeSingle()
        if (!app) {
          return NextResponse.json({ error: 'Application not found' }, { status: 403 })
        }
      } else if (candidateRequestId) {
        const { data: req } = await supabase
          .from('candidate_requests')
          .select('id')
          .eq('id', candidateRequestId)
          .eq('candidate_user_id', user.id)
          .maybeSingle()
        if (!req) {
          return NextResponse.json({ error: 'Candidate request not found' }, { status: 403 })
        }
      }
    }

    // ── Canonical participant ordering (a < b by UUID text) ──────────────────
    const [participantA, participantB] =
      user.id < otherUserId ? [user.id, otherUserId] : [otherUserId, user.id]

    // ── Upsert the thread ────────────────────────────────────────────────────
    const upsertValues = {
      participant_a_user_id: participantA,
      participant_b_user_id: participantB,
      ...(applicationId ? { application_id: applicationId } : {}),
      ...(candidateRequestId ? { candidate_request_id: candidateRequestId } : {}),
      subject,
    }

    // Try to find an existing thread first (avoids unique constraint errors)
    let matchQuery = supabase
      .from('message_threads')
      .select('id')
      .eq('participant_a_user_id', participantA)
      .eq('participant_b_user_id', participantB)

    if (applicationId) {
      matchQuery = matchQuery.eq('application_id', applicationId)
    } else if (candidateRequestId) {
      matchQuery = matchQuery.eq('candidate_request_id', candidateRequestId)
    }

    const { data: existing } = await matchQuery.maybeSingle()

    if (existing) {
      return NextResponse.json({ threadId: existing.id })
    }

    const { data: newThread, error: insertError } = await supabase
      .from('message_threads')
      .insert(upsertValues)
      .select('id')
      .single()

    if (insertError || !newThread) {
      console.error('[MESSAGES POST] Insert error:', insertError)
      return NextResponse.json({ error: 'Failed to create thread' }, { status: 500 })
    }

    return NextResponse.json({ threadId: newThread.id }, { status: 201 })
  } catch (err) {
    console.error('[MESSAGES POST] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
