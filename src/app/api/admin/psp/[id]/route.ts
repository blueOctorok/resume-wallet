import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'

/**
 * GET /api/admin/psp/[id]
 * Full PSP order + result(s) for admin view.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request)
  if (!auth.authorized) return auth.error!

  const { id } = await params

  try {
    const supabase = await getAdminSupabaseClient()

    const { data: order, error: orderError } = await supabase
      .from('psp_orders')
      .select(`
        id,
        driver_user_id,
        accio_order_number,
        accio_suborder_number,
        accio_remote_order_number,
        dl_number,
        dl_state,
        status,
        ordered_at,
        processed_at,
        completed_at,
        expires_at,
        fee_amount,
        fee_currency,
        error_message,
        error_code,
        ordered_by_company_id,
        ordered_by_user_id,
        ordered_by_employer,
        created_at,
        updated_at,
        order_xml,
        result_xml,
        psp_results (
          id,
          result_status,
          received_at,
          parsed_at,
          parsed_data,
          raw_xml
        )
      `)
      .eq('id', id)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'PSP order not found' }, { status: 404 })
    }

    const results = Array.isArray(order.psp_results)
      ? order.psp_results
      : order.psp_results
        ? [order.psp_results]
        : []

    const [{ data: user }, { data: profile }, { data: company }] = await Promise.all([
      supabase.from('users').select('wallet_address').eq('id', order.driver_user_id).single(),
      supabase
        .from('user_profiles')
        .select('first_name, last_name')
        .eq('user_id', order.driver_user_id)
        .maybeSingle(),
      order.ordered_by_company_id
        ? supabase
            .from('companies')
            .select('id, company_name')
            .eq('id', order.ordered_by_company_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ])

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        driverUserId: order.driver_user_id,
        legacyWalletAddress: user?.wallet_address ?? null,
        driverName: profile?.first_name && profile?.last_name
          ? `${profile.first_name} ${profile.last_name}`
          : null,
        accioOrderNumber: order.accio_order_number,
        accioSuborderNumber: order.accio_suborder_number,
        accioRemoteOrderNumber: order.accio_remote_order_number,
        dlNumber: order.dl_number,
        dlState: order.dl_state,
        status: order.status,
        orderedAt: order.ordered_at,
        processedAt: order.processed_at,
        completedAt: order.completed_at,
        expiresAt: order.expires_at,
        feeAmount: order.fee_amount,
        feeCurrency: order.fee_currency,
        errorMessage: order.error_message,
        errorCode: order.error_code,
        orderedBy: order.ordered_by_company_id
          ? {
              type: 'employer' as const,
              companyId: order.ordered_by_company_id,
              companyName: company?.company_name ?? null,
            }
          : { type: 'self' as const },
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        orderXml: order.order_xml ?? null,
        resultXml: order.result_xml ?? null,
      },
      results: results.map((r: Record<string, unknown>) => ({
        id: r.id,
        resultStatus: r.result_status,
        receivedAt: r.received_at,
        parsedAt: r.parsed_at,
        parsedData: r.parsed_data ?? null,
        rawXml: r.raw_xml ?? null,
      })),
    })
  } catch (err) {
    console.error('[ADMIN PSP GET] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/psp/[id]
 * Remove a PSP order. Cascades to psp_results via FK ON DELETE CASCADE.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request)
  if (!auth.authorized) return auth.error!

  const { id } = await params

  try {
    const supabase = await getAdminSupabaseClient()

    const { data: row, error: findError } = await supabase
      .from('psp_orders')
      .select('id, dl_state, accio_order_number')
      .eq('id', id)
      .single()

    if (findError || !row) {
      return NextResponse.json({ error: 'PSP order not found' }, { status: 404 })
    }

    const { error: deleteError } = await supabase.from('psp_orders').delete().eq('id', id)

    if (deleteError) {
      console.error('[ADMIN PSP] Delete error:', deleteError)
      return NextResponse.json({ error: 'Failed to delete PSP order' }, { status: 500 })
    }

    console.log(
      `[ADMIN] PSP order deleted: ${id} (state: ${row.dl_state}, accio: ${row.accio_order_number}) by admin: ${auth.email}`,
    )

    return NextResponse.json({
      success: true,
      message: 'PSP order and associated results removed.',
    })
  } catch (err) {
    console.error('[ADMIN PSP] Delete unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
