import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'
import {
  anyFieldMatchesSearch,
  paginateInMemory,
  resolveUserIdsMatchingSearch,
} from '@/lib/admin-search'

/**
 * GET /api/admin/psp
 * List PSP (FMCSA crash & inspection) orders. Mirrors the MVR admin list.
 *
 * Each row exposes `orderedBy` so admins can distinguish:
 *   - candidate self-orders (USDC payment)
 *   - employer-initiated orders (CRA-isolated, scoped by ordered_by_company_id)
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

    let ordersQuery = supabase
      .from('psp_orders')
      .select(
        'id, driver_user_id, status, dl_state, ordered_at, created_at, accio_order_number, ordered_by_company_id, ordered_by_employer',
        { count: hasSearch ? undefined : 'exact' },
      )
      .order('ordered_at', { ascending: false })

    if (!hasSearch) {
      ordersQuery = ordersQuery.range(offset, offset + limit - 1)
    }

    const { data: orders, error, count } = await ordersQuery

    if (error) {
      console.error('[ADMIN PSP] Query error:', error)
      return NextResponse.json({ error: 'Failed to fetch PSP orders' }, { status: 500 })
    }

    const driverIds = [
      ...new Set((orders || []).map((o: { driver_user_id: string }) => o.driver_user_id)),
    ]
    const companyIds = [
      ...new Set(
        (orders || [])
          .map((o: { ordered_by_company_id: string | null }) => o.ordered_by_company_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ]
    const orderIds = (orders || []).map((o: { id: string }) => o.id)

    const [{ data: users }, { data: profiles }, { data: companies }, { data: results }] =
      await Promise.all([
        supabase.from('users').select('id, wallet_address').in('id', driverIds),
        supabase
          .from('user_profiles')
          .select('user_id, first_name, last_name')
          .in('user_id', driverIds),
        companyIds.length > 0
          ? supabase.from('companies').select('id, company_name').in('id', companyIds)
          : Promise.resolve({ data: [] as { id: string; company_name: string }[] }),
        orderIds.length > 0
          ? supabase
              .from('psp_results')
              .select('psp_order_id, result_status, received_at')
              .in('psp_order_id', orderIds)
          : Promise.resolve({ data: [] as { psp_order_id: string; result_status: string; received_at: string }[] }),
      ])

    const userMap = new Map((users || []).map(u => [u.id, u.wallet_address]))
    const profileMap = new Map(
      driverIds.map(id => {
        const p = (profiles || []).find(p => p.user_id === id)
        return [id, p ? [p.first_name, p.last_name].filter(Boolean).join(' ') || null : null]
      }),
    )
    const companyMap = new Map((companies || []).map(c => [c.id, c.company_name]))
    const resultByOrderId = new Map(
      (results || []).map((r: { psp_order_id: string }) => [r.psp_order_id, r]),
    )

    const matchingUserIds = hasSearch
      ? new Set(await resolveUserIdsMatchingSearch(supabase, search))
      : null

    const pspList = (orders || []).map((o: Record<string, unknown>) => {
      const driverUserId = o.driver_user_id as string
      const wallet = userMap.get(driverUserId) || 'Unknown'
      const driverName = profileMap.get(driverUserId) || 'Unknown'
      const companyId = o.ordered_by_company_id as string | null
      const result = resultByOrderId.get(o.id as string) as
        | { result_status: string; received_at: string }
        | undefined
      return {
        id: o.id,
        driverUserId,
        walletAddress: wallet,
        driverName,
        status: o.status,
        dlState: o.dl_state,
        orderedAt: o.ordered_at,
        createdAt: o.created_at,
        accioOrderNumber: o.accio_order_number,
        orderedBy: companyId
          ? { type: 'employer' as const, companyId, companyName: companyMap.get(companyId) ?? null }
          : { type: 'self' as const },
        resultStatus: result?.result_status ?? null,
        resultReceivedAt: result?.received_at ?? null,
      }
    })

    const filtered = hasSearch
      ? pspList.filter(
          (row) =>
            matchingUserIds?.has(row.driverUserId) ||
            anyFieldMatchesSearch(
              search,
              row.driverName,
              row.walletAddress,
              row.accioOrderNumber as string | null,
              row.orderedBy.type === 'employer' ? row.orderedBy.companyName : null,
              row.dlState as string | null,
            ),
        )
      : pspList

    const page = hasSearch ? paginateInMemory(filtered, offset, limit) : filtered

    return NextResponse.json({
      success: true,
      pspOrders: page,
      total: hasSearch ? filtered.length : (count ?? 0),
    })
  } catch (err) {
    console.error('[ADMIN PSP] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
