import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

/**
 * GET /api/candidate/requests
 * 
 * Gets all requests sent to the current candidate.
 * Any non-employer user can view their incoming requests.
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

    if (user.role === 'employer') {
      return NextResponse.json(
        { error: 'Employers cannot view candidate requests' },
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
        target_block_type,
        message,
        status,
        completed_at,
        expires_at,
        created_at,
        company:companies(id, company_name, logo_url, employer_user_id)
      `)
      .eq('candidate_user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[CANDIDATE REQUESTS] Fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 })
    }

    const completedBgcheckRequestIds = (requests || [])
      .filter(
        r =>
          r.status === 'completed' &&
          (r.request_type === 'mvr_order' ||
            (r.request_type === 'block_request' && r.target_block_type === 'driver-mvr')),
      )
      .map(r => r.id)

    const completedPspRequestIds = (requests || [])
      .filter(
        r =>
          r.status === 'completed' &&
          (r.request_type === 'psp_order' ||
            (r.request_type === 'block_request' && r.target_block_type === 'driver-psp')),
      )
      .map(r => r.id)

    let bgcheckConsentMap: Map<string, string> = new Map()
    if (completedBgcheckRequestIds.length > 0) {
      const { data: consents } = await supabase
        .from('bgcheck_consents')
        .select('id, request_id')
        .in('request_id', completedBgcheckRequestIds)

      if (consents) {
        bgcheckConsentMap = new Map(consents.map(c => [c.request_id, c.id]))
      }
    }

    let pspConsentMap: Map<string, string> = new Map()
    if (completedPspRequestIds.length > 0) {
      const { data: pspConsents } = await supabase
        .from('psp_consents')
        .select('id, request_id')
        .in('request_id', completedPspRequestIds)

      if (pspConsents) {
        pspConsentMap = new Map(pspConsents.map(c => [c.request_id, c.id]))
      }
    }

    // Count pending requests for badge
    const pendingCount = (requests || []).filter(
      r => r.status === 'pending' || r.status === 'viewed'
    ).length

    return NextResponse.json({
      success: true,
      requests: (requests || []).map(r => {
        const company = r.company as { id: string; company_name: string; logo_url: string | null; employer_user_id: string | null } | null
        return {
          id: r.id,
          requestType: r.request_type,
          documentType: r.document_type,
          targetBlockType: r.target_block_type ?? null,
          message: r.message,
          status: r.status,
          completedAt: r.completed_at,
          expiresAt: r.expires_at,
          createdAt: r.created_at,
          company: company ? {
            id: company.id,
            name: company.company_name,
            logoUrl: company.logo_url,
            ownerUserId: company.employer_user_id,
          } : null,
          consentId: bgcheckConsentMap.get(r.id) || pspConsentMap.get(r.id) || null,
        }
      }),
      pendingCount,
    })

  } catch (error) {
    console.error('[CANDIDATE REQUESTS] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
