import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'

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
  const auth = requireAdmin(request)
  if (!auth.authorized) return auth.error!

  try {
    const supabase = await getAdminSupabaseClient()
    const { searchParams } = new URL(request.url)
    
    const status = searchParams.get('status')
    const search = searchParams.get('search')?.toLowerCase()
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build query with joins to get all related data
    let query = supabase
      .from('application_invites')
      .select(`
        id, token, type, status, candidate_email, candidate_name,
        welcome_message, created_at, expires_at, email_sent_at,
        company_id, job_posting_id, created_by_user_id,
        companies(id, company_name),
        job_postings(id, title)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })

    // Apply status filter
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data: invites, error, count } = await query

    if (error) {
      console.error('[ADMIN OUTREACH] Query error:', error)
      return NextResponse.json({ error: 'Failed to fetch outreach invites' }, { status: 500 })
    }

    // Fetch creator user data separately
    const creatorIds = [...new Set((invites || []).map((i: any) => i.created_by_user_id).filter(Boolean))]
    let creatorsMap: Record<string, any> = {}
    
    if (creatorIds.length > 0) {
      const { data: creators } = await supabase
        .from('users')
        .select('id, wallet_address, email, name')
        .in('id', creatorIds)
      
      if (creators) {
        creatorsMap = Object.fromEntries(creators.map(u => [u.id, u]))
      }
    }

    // Transform for cleaner response
    const transformed = (invites || []).map((invite: any) => {
      const creator = creatorsMap[invite.created_by_user_id]
      return {
        id: invite.id,
        token: invite.token,
        type: invite.type || 'driver_dot',
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
        createdByEmail: creator?.email || creator?.name,
      }
    })

    // Filter by search (post-query since we search across joined fields)
    let filtered = transformed
    if (search) {
      filtered = transformed.filter((invite: any) => 
        invite.candidateName?.toLowerCase().includes(search) ||
        invite.candidateEmail?.toLowerCase().includes(search) ||
        invite.companyName?.toLowerCase().includes(search) ||
        invite.jobTitle?.toLowerCase().includes(search) ||
        invite.createdByEmail?.toLowerCase().includes(search)
      )
    }

    return NextResponse.json({
      success: true,
      outreach: filtered,
      total: search ? filtered.length : (count || 0),
      limit,
      offset,
    })

  } catch (error) {
    console.error('[ADMIN OUTREACH] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
