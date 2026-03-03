import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

/**
 * GET /api/candidate/requests
 * 
 * Gets all requests sent to the current candidate (driver/developer).
 * Includes company info and request details.
 */
export async function GET(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 401 }
      )
    }

    const supabase = await getAdminSupabaseClient()

    // Get the candidate user
    const { data: user } = await supabase
      .from('users')
      .select('id, role')
      .ilike('wallet_address', walletAddress)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!['driver', 'developer'].includes(user.role || '')) {
      return NextResponse.json(
        { error: 'Only drivers and developers can view candidate requests' },
        { status: 403 }
      )
    }

    // Get all requests for this candidate with company info
    const { data: requests, error } = await supabase
      .from('candidate_requests')
      .select(`
        id,
        request_type,
        document_type,
        message,
        status,
        completed_at,
        expires_at,
        created_at,
        company:companies(id, company_name, logo_url)
      `)
      .eq('candidate_user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[CANDIDATE REQUESTS] Fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 })
    }

    // Get consent IDs for completed MVR requests
    const completedMvrRequestIds = (requests || [])
      .filter(r => r.request_type === 'mvr_order' && r.status === 'completed')
      .map(r => r.id)

    let consentMap: Map<string, string> = new Map()
    if (completedMvrRequestIds.length > 0) {
      const { data: consents } = await supabase
        .from('bgcheck_consents')
        .select('id, request_id')
        .in('request_id', completedMvrRequestIds)

      if (consents) {
        consentMap = new Map(consents.map(c => [c.request_id, c.id]))
      }
    }

    // Count pending requests for badge
    const pendingCount = (requests || []).filter(
      r => r.status === 'pending' || r.status === 'viewed'
    ).length

    return NextResponse.json({
      success: true,
      requests: (requests || []).map(r => {
        const company = r.company as { id: string; company_name: string; logo_url: string | null } | null
        return {
          id: r.id,
          requestType: r.request_type,
          documentType: r.document_type,
          message: r.message,
          status: r.status,
          completedAt: r.completed_at,
          expiresAt: r.expires_at,
          createdAt: r.created_at,
          company: company ? {
            id: company.id,
            name: company.company_name,
            logoUrl: company.logo_url,
          } : null,
          consentId: consentMap.get(r.id) || null,
        }
      }),
      pendingCount,
    })

  } catch (error) {
    console.error('[CANDIDATE REQUESTS] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
