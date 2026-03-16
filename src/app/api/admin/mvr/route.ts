import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'

/**
 * GET /api/admin/mvr
 * List MVR orders with driver info.
 */
export async function GET(request: NextRequest) {
  const auth = requireAdmin(request)
  if (!auth.authorized) return auth.error!

  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)
  const offset = parseInt(searchParams.get('offset') || '0', 10)

  try {
    const supabase = await getAdminSupabaseClient()

    const { data: orders, error, count } = await supabase
      .from('mvr_orders')
      .select('id, driver_user_id, status, dl_state, ordered_at, created_at, accio_order_number', { count: 'exact' })
      .order('ordered_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('[ADMIN MVR] Query error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch MVR orders' },
        { status: 500 }
      )
    }

    const fixedUserIds = [...new Set((orders || []).map((o: { driver_user_id: string }) => o.driver_user_id))]

    const { data: users } = await supabase
      .from('users')
      .select('id, wallet_address')
      .in('id', fixedUserIds)

    const { data: userProfiles } = await supabase
      .from('user_profiles')
      .select('user_id, first_name, last_name')
      .in('user_id', fixedUserIds)

    const orderIds = (orders || []).map((o: { id: string }) => o.id)
    const { data: results } = orderIds.length > 0
      ? await supabase
          .from('mvr_results')
          .select('mvr_order_id, license_status, total_points, violation_count, result_status')
          .in('mvr_order_id', orderIds)
      : { data: [] }

    const userMap = new Map((users || []).map((u: { id: string; wallet_address: string }) => [u.id, u.wallet_address]))
    const upMap = new Map((userProfiles || []).map(p => [p.user_id, p]))
    const profileMap = new Map(
      fixedUserIds.map(id => {
        const p = upMap.get(id)
        return [id, p ? [p.first_name, p.last_name].filter(Boolean).join(' ') || null : null]
      })
    )
    const resultByOrderId = new Map(
      (results || []).map((r: { mvr_order_id: string }) => [r.mvr_order_id, r])
    )

    const mvrList = (orders || []).map((o: Record<string, unknown>) => {
      const wallet = userMap.get(o.driver_user_id as string) || 'Unknown'
      const driverName = profileMap.get(o.driver_user_id as string) || 'Unknown'
      const result = resultByOrderId.get(o.id as string)
      return {
        id: o.id,
        driverUserId: o.driver_user_id,
        walletAddress: wallet,
        driverName,
        status: o.status,
        dlState: o.dl_state,
        orderedAt: o.ordered_at,
        createdAt: o.created_at,
        accioOrderNumber: o.accio_order_number,
        licenseStatus: result?.license_status ?? null,
        totalPoints: result?.total_points ?? null,
        violationCount: result?.violation_count ?? null,
        resultStatus: result?.result_status ?? null,
      }
    })

    return NextResponse.json({
      success: true,
      mvrOrders: mvrList,
      total: count ?? 0,
    })
  } catch (err) {
    console.error('[ADMIN MVR] Error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
