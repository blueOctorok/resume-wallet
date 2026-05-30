import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'
import { anyFieldMatchesSearch, paginateInMemory } from '@/lib/admin-search'

/**
 * GET /api/admin/outreach
 * List all candidate outreach invites with related data
 * 
 * Query params:
 *   status - Filter by status (pending, in_progress, completed, cancelled)
 *   search - Search by candidate name/email or company name
 *   limit - Results per page (default 20)
 *   offset - Pagination offset
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.authorized) return auth.error!

  try {
    const supabase = await getAdminSupabaseClient()
    const { searchParams } = new URL(request.url)
    
    const status = searchParams.get('status')
    const search = searchParams.get('search')?.trim() ?? ''
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const hasSearch = search.length > 0

    // Search spans joined company/job/creator fields — fetch without range when
    // searching, filter globally, then paginate in memory.
    let query = supabase
      .from('application_invites')
      .select(`
        id, token, type, status, candidate_email, candidate_name,
        welcome_message, created_at, expires_at, email_sent_at,
        company_id, job_posting_id, created_by_user_id,
        companies(id, company_name),
        job_postings(id, title)
      `, { count: hasSearch ? undefined : 'exact' })
      .order('created_at', { ascending: false })

    // Apply status filter
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    if (!hasSearch) {
      query = query.range(offset, offset + limit - 1)
    }

    const { data: invites, error, count } = await query

    if (error) {
      console.error('[ADMIN OUTREACH] Query error:', error)
      return NextResponse.json({ error: 'Failed to fetch outreach invites' }, { status: 500 })
    }

    // Fetch creator user data separately
    const creatorIds = [...new Set((invites || []).map((i: any) => i.created_by_user_id).filter(Boolean))]
    let creatorsMap: Record<string, any> = {}
    
    let creatorProfilesMap: Record<string, { first_name: string | null; last_name: string | null }> = {}

    if (creatorIds.length > 0) {
      const [{ data: creators }, { data: creatorProfiles }] = await Promise.all([
        supabase.from('users').select('id, wallet_address, email').in('id', creatorIds),
        supabase.from('user_profiles').select('user_id, first_name, last_name').in('user_id', creatorIds),
      ])
      
      if (creators) {
        creatorsMap = Object.fromEntries(creators.map(u => [u.id, u]))
      }
      if (creatorProfiles) {
        creatorProfilesMap = Object.fromEntries(creatorProfiles.map(p => [p.user_id, p]))
      }
    }

    // Transform for cleaner response
    const transformed = (invites || []).map((invite: any) => {
      const creator = creatorsMap[invite.created_by_user_id]
      const cp = creatorProfilesMap[invite.created_by_user_id]
      const creatorName = [cp?.first_name, cp?.last_name].filter(Boolean).join(' ').trim() || null
      return {
        id: invite.id,
        token: invite.token,
        type: invite.type || 'general',
        status: invite.status,
        candidateEmail: invite.candidate_email,
        candidateName: invite.candidate_name,
        welcomeMessage: invite.welcome_message,
        createdAt: invite.created_at,
        expiresAt: invite.expires_at,
        emailSentAt: invite.email_sent_at,
        // Company info
        companyId: invite.company_id,
        companyName: invite.companies?.company_name || 'Unknown Company',
        // Job info (optional)
        jobId: invite.job_posting_id,
        jobTitle: invite.job_postings?.title || null,
        // Creator info
        createdByWallet: creator?.wallet_address,
        createdByEmail: creator?.email || creatorName,
      }
    })

    const filtered = hasSearch
      ? transformed.filter((invite: {
          candidateName: string | null
          candidateEmail: string | null
          companyName: string
          jobTitle: string | null
          createdByEmail: string | null | undefined
        }) =>
          anyFieldMatchesSearch(
            search,
            invite.candidateName,
            invite.candidateEmail,
            invite.companyName,
            invite.jobTitle,
            invite.createdByEmail,
          ),
        )
      : transformed

    const page = hasSearch ? paginateInMemory(filtered, offset, limit) : filtered

    return NextResponse.json({
      success: true,
      outreach: page,
      total: hasSearch ? filtered.length : (count || 0),
      limit,
      offset,
    })

  } catch (error) {
    console.error('[ADMIN OUTREACH] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
