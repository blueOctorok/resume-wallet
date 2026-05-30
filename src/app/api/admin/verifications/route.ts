import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'
import {
  anyFieldMatchesSearch,
  paginateInMemory,
  resolveUserIdsMatchingSearch,
} from '@/lib/admin-search'

/**
 * GET /api/admin/verifications
 * List all employment verification requests (for admin: remove test data, etc.)
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.authorized) return auth.error!

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search')?.trim() ?? ''
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)
  const offset = parseInt(searchParams.get('offset') || '0', 10)
  const hasSearch = search.length > 0

  try {
    const supabase = await getAdminSupabaseClient()

    let rowsQuery = supabase
      .from('employment_verification_requests')
      .select(
        'id, driver_id, employment_id, initiated_by, applicant_type, previous_employer_name, previous_employer_email, claimed_position, claimed_start_date, claimed_end_date, status, attempt_count, created_at',
        { count: hasSearch ? undefined : 'exact' },
      )
      .order('created_at', { ascending: false })

    if (!hasSearch) {
      rowsQuery = rowsQuery.range(offset, offset + limit - 1)
    }

    const { data: rows, error, count } = await rowsQuery

    if (error) {
      console.error('[ADMIN VERIFICATIONS] Query error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch verifications' },
        { status: 500 }
      )
    }

    const driverIds = [...new Set((rows || []).map((r: { driver_id: string }) => r.driver_id))]
    const { data: users } =
      driverIds.length > 0
        ? await supabase
            .from('users')
            .select('id, wallet_address')
            .in('id', driverIds)
        : { data: [] }
    const walletByUserId = new Map(
      (users || []).map((u: { id: string; wallet_address: string }) => [u.id, u.wallet_address])
    )

    const matchingUserIds = hasSearch
      ? new Set(await resolveUserIdsMatchingSearch(supabase, search))
      : null

    const verifications = (rows || []).map((r: Record<string, unknown>) => ({
      id: r.id,
      driverId: r.driver_id,
      applicantWallet: walletByUserId.get(r.driver_id as string) ?? null,
      employmentId: r.employment_id,
      initiatedBy: r.initiated_by,
      applicantType: r.applicant_type,
      previousEmployerName: r.previous_employer_name,
      previousEmployerEmail: r.previous_employer_email,
      claimedPosition: r.claimed_position,
      claimedStartDate: r.claimed_start_date,
      claimedEndDate: r.claimed_end_date,
      status: r.status,
      attemptCount: r.attempt_count,
      createdAt: r.created_at,
    }))

    const filtered = hasSearch
      ? verifications.filter(
          (row) =>
            matchingUserIds?.has(row.driverId as string) ||
            anyFieldMatchesSearch(
              search,
              row.applicantWallet,
              row.previousEmployerName as string,
              row.previousEmployerEmail as string | null,
              row.claimedPosition as string,
              row.status as string,
            ),
        )
      : verifications

    const page = hasSearch ? paginateInMemory(filtered, offset, limit) : filtered

    return NextResponse.json({
      success: true,
      verifications: page,
      total: hasSearch ? filtered.length : (count ?? 0),
    })
  } catch (err) {
    console.error('[ADMIN VERIFICATIONS] Error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
