import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

const ADMIN_WALLETS = (process.env.ADMIN_WALLETS || '').toLowerCase().split(',').map(w => w.trim()).filter(Boolean)

function isAdmin(walletAddress: string | null): boolean {
  if (!walletAddress) return false
  return ADMIN_WALLETS.includes(walletAddress.toLowerCase())
}

/**
 * GET /api/admin/employer-requests
 * 
 * Lists all employer access requests for admin review.
 * Query params:
 *   - status: 'pending' | 'approved' | 'rejected' | 'all' (default: 'pending')
 */
export async function GET(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')

    if (!isAdmin(walletAddress)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'pending'

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

    return NextResponse.json({
      success: true,
      requests: requests || [],
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
