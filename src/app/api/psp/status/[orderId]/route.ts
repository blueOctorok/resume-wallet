import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

/**
 * GET /api/psp/status/[orderId]?walletAddress=...
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const { orderId } = await params
    const { searchParams } = new URL(request.url)
    const walletAddress = searchParams.get('walletAddress')

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 })
    }

    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .ilike('wallet_address', walletAddress)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { data: order, error: orderError } = await supabase
      .from('psp_orders')
      .select(
        `
        *,
        psp_results (
          id,
          result_status,
          received_at,
          parsed_at,
          parsed_data
        )
      `,
      )
      .eq('id', orderId)
      .eq('driver_user_id', user.id)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'PSP order not found' }, { status: 404 })
    }

    const result = Array.isArray(order.psp_results) ? order.psp_results[0] : order.psp_results

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        orderNumber: order.accio_order_number,
        subOrderNumber: order.accio_suborder_number,
        status: order.status,
        dlNumber: order.dl_number,
        dlState: order.dl_state,
        orderedAt: order.ordered_at,
        processedAt: order.processed_at,
        completedAt: order.completed_at,
        expiresAt: order.expires_at,
        feeAmount: order.fee_amount,
        errorMessage: order.error_message,
      },
      result: result
        ? {
            id: result.id,
            resultStatus: result.result_status,
            receivedAt: result.received_at,
            parsedAt: result.parsed_at,
            parsedData: result.parsed_data,
          }
        : null,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[PSP STATUS]', error)
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 })
  }
}
