import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'

/**
 * GET /api/admin/bgcheck-requests
 * 
 * Lists all background check requests and consents for admin visibility.
 * Shows the full pipeline: request → consent → MVR order
 */
export async function GET(request: NextRequest) {
  const auth = requireAdmin(request)
  if (!auth.authorized) return auth.error!

  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)
  const offset = parseInt(searchParams.get('offset') || '0', 10)
  const status = searchParams.get('status') // 'pending', 'signed', 'all'

  try {
    const supabase = await getAdminSupabaseClient()

    // Get all MVR-type candidate requests
    let requestQuery = supabase
      .from('candidate_requests')
      .select(`
        id,
        company_id,
        requested_by_user_id,
        candidate_user_id,
        request_type,
        status,
        message,
        created_at,
        updated_at,
        expires_at,
        completed_at
      `, { count: 'exact' })
      .eq('request_type', 'mvr_order')
      .order('created_at', { ascending: false })

    if (status === 'pending') {
      requestQuery = requestQuery.in('status', ['pending', 'viewed'])
    } else if (status === 'signed') {
      requestQuery = requestQuery.eq('status', 'completed')
    }

    const { data: requests, error: reqError, count } = await requestQuery
      .range(offset, offset + limit - 1)

    if (reqError) {
      console.error('[ADMIN BGCHECK] Request query error:', reqError)
      return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 })
    }

    if (!requests || requests.length === 0) {
      return NextResponse.json({
        success: true,
        requests: [],
        total: 0,
      })
    }

    // Get related data
    const companyIds = [...new Set(requests.map(r => r.company_id))]
    const candidateIds = [...new Set(requests.map(r => r.candidate_user_id))]
    const requestIds = requests.map(r => r.id)

    // Fetch companies
    const { data: companies } = await supabase
      .from('companies')
      .select('id, company_name')
      .in('id', companyIds)

    const [{ data: users }, { data: userProfiles }] = await Promise.all([
      supabase.from('users').select('id, wallet_address, email').in('id', candidateIds),
      supabase.from('user_profiles').select('user_id, first_name, last_name').in('user_id', candidateIds),
    ])

    // Fetch signed consents for these requests
    const { data: consents } = await supabase
      .from('bgcheck_consents')
      .select('id, request_id, signed_name, signed_at, form_data')
      .in('request_id', requestIds)

    const companyMap = new Map(companies?.map(c => [c.id, c.company_name]) || [])
    const userMap = new Map(users?.map(u => [u.id, u]) || [])
    const upMap = new Map(userProfiles?.map(p => [p.user_id, p]) || [])
    const consentMap = new Map(consents?.map(c => [c.request_id, c]) || [])

    const result = requests.map(req => {
      const user = userMap.get(req.candidate_user_id)
      const up = upMap.get(req.candidate_user_id)
      const consent = consentMap.get(req.id)

      const driverName = up
        ? [up.first_name, up.last_name].filter(Boolean).join(' ')
        : user?.email || 'Unknown'

      return {
        id: req.id,
        companyId: req.company_id,
        companyName: companyMap.get(req.company_id) || 'Unknown',
        candidateUserId: req.candidate_user_id,
        driverName,
        driverEmail: user?.email || null,
        driverWallet: user?.wallet_address || null,
        status: req.status,
        requestedAt: req.created_at,
        expiresAt: req.expires_at,
        // Consent info
        hasSigned: !!consent,
        signedAt: consent?.signed_at || null,
        signedName: consent?.signed_name || null,
        consentId: consent?.id || null,
      }
    })

    return NextResponse.json({
      success: true,
      requests: result,
      total: count ?? 0,
    })

  } catch (err) {
    console.error('[ADMIN BGCHECK] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
