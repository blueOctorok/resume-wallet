import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'

/**
 * GET /api/candidate/verification/share-requests
 *
 * Employer share requests targeting this driver (Step 6 queue), newest first,
 * with the employer legal name the acknowledgment screen must display.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()
    const { data, error } = await supabase
      .from('ev_share_requests')
      .select(
        'id, company_id, application_context, payload_type, status, certified_at, created_at, companies(company_name), ev_share_grants(id, revoked_at)',
      )
      .eq('driver_user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[EV SHARE REQUESTS] List error:', error.message)
      if (error.code === '42P01') {
        return NextResponse.json({ shareRequests: [] })
      }
      return NextResponse.json({ error: 'Failed to load share requests' }, { status: 500 })
    }

    const shareRequests = (data ?? []).map((row) => {
      const companies = row.companies as { company_name?: string } | { company_name?: string }[] | null
      const company = Array.isArray(companies) ? companies[0] : companies
      const grants = row.ev_share_grants as
        | { id: string; revoked_at: string | null }
        | { id: string; revoked_at: string | null }[]
        | null
      const grant = Array.isArray(grants) ? grants[0] : grants
      return {
        id: row.id,
        companyId: row.company_id,
        companyName: company?.company_name ?? 'Unknown company',
        applicationContext: row.application_context,
        payloadType: row.payload_type,
        status: row.status,
        certifiedAt: row.certified_at,
        createdAt: row.created_at,
        grantId: grant && !grant.revoked_at ? grant.id : null,
      }
    })

    return NextResponse.json({ shareRequests })
  } catch (error) {
    console.error('[EV SHARE REQUESTS] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
