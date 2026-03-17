import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'

/**
 * GET /api/employer/hub/driver-data
 *
 * Block-conditional endpoint: returns driver-specific enrichment data
 * (CDL, DOT status, MVR status) for a set of applicant user IDs.
 *
 * Only called by the employer hub when driver-related blocks are installed.
 * A steel or paint company would never call this endpoint.
 *
 * Query params:
 *   applicantIds: comma-separated user IDs
 *
 * Headers:
 *   x-wallet-address: employer's wallet address
 */
export async function GET(request: NextRequest) {
  try {
    const walletAddress = request.headers.get('x-wallet-address')
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 401 })
    }

    const applicantIdsParam = request.nextUrl.searchParams.get('applicantIds')
    if (!applicantIdsParam) {
      return NextResponse.json({ error: 'applicantIds required' }, { status: 400 })
    }

    const applicantIds = applicantIdsParam.split(',').filter(Boolean)
    if (applicantIds.length === 0) {
      return NextResponse.json({ driverData: {} })
    }

    const supabase = await getAdminSupabaseClient()

    // Verify the caller is an employer with a company
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .ilike('wallet_address', walletAddress)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Resolve company for FCRA-scoped MVR access
    const { data: membership } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    let companyId = membership?.company_id ?? null
    if (!companyId) {
      const { data: legacyCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('employer_user_id', user.id)
        .maybeSingle()
      companyId = legacyCompany?.id ?? null
    }

    if (!companyId) {
      return NextResponse.json({ error: 'No company found' }, { status: 403 })
    }

    // Parallel fetch: CDL from block table, DOT app completions, MVR + consent
    const [
      { data: cdlRows },
      { data: completedApps },
      { data: allMvrOrders },
      { data: consents },
    ] = await Promise.all([
      supabase
        .from('block_driver_cdl')
        .select('user_id, cdl_class, cdl_state, cdl_expiration')
        .in('user_id', applicantIds),
      supabase
        .from('driver_applications')
        .select('user_id')
        .in('user_id', applicantIds)
        .eq('is_complete', true),
      supabase
        .from('mvr_orders')
        .select('driver_user_id, status, ordered_by_company_id, ordered_at')
        .in('driver_user_id', applicantIds)
        .or(`ordered_by_company_id.is.null,ordered_by_company_id.eq.${companyId}`)
        .order('ordered_at', { ascending: false }),
      supabase
        .from('bgcheck_consents')
        .select('driver_user_id')
        .in('driver_user_id', applicantIds)
        .eq('company_id', companyId),
    ])

    // Build lookup maps
    const cdlMap = new Map(
      (cdlRows ?? []).map(p => [p.user_id, p])
    )
    const dotSet = new Set(
      (completedApps ?? []).map(d => d.user_id)
    )
    const mvrByUser = new Map<string, { status: string; orderedByThisCompany: boolean }>()
    for (const order of allMvrOrders ?? []) {
      if (!mvrByUser.has(order.driver_user_id)) {
        mvrByUser.set(order.driver_user_id, {
          status: order.status,
          orderedByThisCompany: order.ordered_by_company_id === companyId,
        })
      }
    }
    const consentSet = new Set(
      (consents ?? []).map(c => c.driver_user_id)
    )

    // Build per-applicant enrichment data
    const driverData: Record<string, {
      cdlClass: string | null
      cdlState: string | null
      cdlExpiration: string | null
      experienceYears: number | null
      hasDriverApp: boolean
      hasMvr: boolean
      mvrStatus: string | null
      mvrOrderedByThisCompany: boolean
      hasBgcheckConsent: boolean
    }> = {}

    for (const id of applicantIds) {
      const cdl = cdlMap.get(id)
      const mvr = mvrByUser.get(id)
      driverData[id] = {
        cdlClass: cdl?.cdl_class ?? null,
        cdlState: cdl?.cdl_state ?? null,
        cdlExpiration: cdl?.cdl_expiration ?? null,
        // experience_years has no block table equivalent yet — null until computed
        experienceYears: null,
        hasDriverApp: dotSet.has(id),
        hasMvr: mvrByUser.has(id),
        mvrStatus: mvr?.status ?? null,
        mvrOrderedByThisCompany: mvr?.orderedByThisCompany ?? false,
        hasBgcheckConsent: consentSet.has(id),
      }
    }

    return NextResponse.json({ driverData })
  } catch (error) {
    console.error('[EMPLOYER DRIVER-DATA] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
