import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'
import { anyFieldMatchesSearch, paginateInMemory } from '@/lib/admin-search'

/**
 * GET /api/admin/employer-requests
 * 
 * Lists all employer access requests for admin review.
 * Query params:
 *   - status: 'pending' | 'approved' | 'rejected' | 'all' (default: 'pending')
 *   - search: company name, requester name, or email
 *   - limit, offset: pagination (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if (!auth.authorized) return auth.error!

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'pending'
    const search = searchParams.get('search')?.trim() ?? ''
    const limit = parseInt(searchParams.get('limit') || '0', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)
    const paginate = limit > 0

    const supabase = await getAdminSupabaseClient()

    let query = supabase
      .from('employer_access_requests')
      .select('*')
      .order('created_at', { ascending: false })

    if (status !== 'all') {
      query = query.eq('status', status)
    }

    const { data: requests, error } = await query

    if (error) {
      console.error('[ADMIN REQUESTS] Error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch requests' },
        { status: 500 }
      )
    }

    // Get counts by status
    const { data: allRequests } = await supabase
      .from('employer_access_requests')
      .select('status')

    const stats = {
      pending: allRequests?.filter(r => r.status === 'pending').length || 0,
      flagged: allRequests?.filter(r => r.status === 'flagged').length || 0,
      approved: allRequests?.filter(r => r.status === 'approved').length || 0,
      auto_approved: allRequests?.filter(r => r.status === 'auto_approved').length || 0,
      rejected: allRequests?.filter(r => r.status === 'rejected').length || 0,
      blocked: allRequests?.filter(r => r.status === 'blocked').length || 0,
      total: allRequests?.length || 0,
    }

    // Ensure each request has a computed name (newer rows may have first_name/last_name but no name)
    const mappedRequests = (requests || []).map((req: Record<string, unknown>) => ({
      ...req,
      name: req.name || [req.first_name, req.last_name].filter(Boolean).join(' ') || 'Unknown',
    }))

    const filtered = search
      ? mappedRequests.filter((req) =>
          anyFieldMatchesSearch(
            search,
            req.company_name as string,
            req.name as string,
            req.email as string | null,
            req.wallet_address as string,
          ),
        )
      : mappedRequests

    const page = paginate ? paginateInMemory(filtered, offset, limit) : filtered

    return NextResponse.json({
      success: true,
      requests: page,
      total: filtered.length,
      stats,
    })

  } catch (error) {
    console.error('[ADMIN REQUESTS] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
