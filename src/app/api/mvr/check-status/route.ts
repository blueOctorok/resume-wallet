import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

/**
 * API Route: Check MVR Status by Wallet Address
 * 
 * GET /api/mvr/check-status?walletAddress=0x...
 * 
 * Returns whether the user has any MVR orders/results
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const walletAddress = searchParams.get('walletAddress')

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      )
    }

    // Use service role client to bypass RLS and read all payments/orders
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get user ID
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .ilike('wallet_address', walletAddress)
      .single()

    // If user doesn't exist yet, that's normal - just return no MVR
    if (userError || !user) {
      console.log('[MVR CHECK] User not found for wallet:', walletAddress, userError)
      return NextResponse.json({
        hasMvr: false,
        hasPayment: false,
        payments: [],
        order: null,
        result: null,
      })
    }

    console.log('[MVR CHECK] User found:', { userId: user.id, walletAddress })

    // Query ALL payments for this user first (for debugging)
    const { data: allPayments, error: allPaymentsError } = await supabase
      .from('payments')
      .select('id, tx_hash, amount_usdc, status, created_at, type, user_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    console.log('[MVR CHECK] All payments for user (debug):', {
      count: allPayments?.length || 0,
      payments: allPayments,
      error: allPaymentsError,
    })

    // Now filter for MVR_ORDER type
    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('id, tx_hash, amount_usdc, status, created_at, type')
      .eq('user_id', user.id)
      .eq('type', 'MVR_ORDER')
      .order('created_at', { ascending: false })

    console.log('[MVR CHECK] MVR payments query result:', {
      paymentsFound: payments?.length || 0,
      payments: payments,
      error: paymentsError,
    })

    if (paymentsError) {
      console.error('[MVR CHECK] Error fetching payments:', paymentsError)
    }

    // Get all MVR orders with results
    const { data: orders, error: orderError } = await supabase
      .from('mvr_orders')
      .select(`
        id,
        accio_order_number,
        status,
        ordered_at,
        payment_id,
        mvr_results (
          id,
          result_status,
          received_at,
          parsed_at,
          license_number,
          license_state
        )
      `)
      .eq('driver_user_id', user.id)
      .order('ordered_at', { ascending: false })

    console.log('[MVR CHECK] Orders query result:', {
      ordersFound: orders?.length || 0,
      error: orderError,
    })

    if (orderError) {
      console.error('[MVR CHECK] Error fetching MVR orders:', orderError)
      return NextResponse.json(
        { error: 'Failed to fetch MVR status' },
        { status: 500 }
      )
    }

    const latestOrder = orders && orders.length > 0 ? orders[0] : null

    // Check if there are any orphaned payments (payments without orders)
    const hasPayments = payments && payments.length > 0
    const hasOrders = orders && orders.length > 0
    const hasOrphanedPayments = hasPayments && !hasOrders

    // Format all orders
    const formattedOrders = orders?.map(order => {
      const result = Array.isArray(order.mvr_results)
        ? order.mvr_results[0]
        : order.mvr_results

      return {
        id: order.id,
        orderNumber: order.accio_order_number,
        status: order.status,
        orderedAt: order.ordered_at,
        paymentId: order.payment_id,
        hasResult: !!result,
        result: result ? {
          id: result.id,
          resultStatus: result.result_status,
          receivedAt: result.received_at,
          parsedAt: result.parsed_at,
          licenseNumber: result.license_number,
          licenseState: result.license_state,
        } : null,
      }
    }) || []

    // Return comprehensive status
    return NextResponse.json({
      hasMvr: hasOrders,
      hasPayment: hasPayments,
      paymentPending: hasOrphanedPayments,
      payments: payments?.map(p => ({
        id: p.id,
        txHash: p.tx_hash,
        amount: p.amount_usdc,
        status: p.status,
        createdAt: p.created_at,
      })) || [],
      orders: formattedOrders,
      // Keep legacy fields for backward compatibility
      order: latestOrder ? {
        id: latestOrder.id,
        orderNumber: latestOrder.accio_order_number,
        status: latestOrder.status,
        orderedAt: latestOrder.ordered_at,
        paymentId: latestOrder.payment_id,
      } : null,
      result: latestOrder ? (() => {
        const result = Array.isArray(latestOrder.mvr_results)
          ? latestOrder.mvr_results[0]
          : latestOrder.mvr_results
        return result ? {
          id: result.id,
          resultStatus: result.result_status,
          receivedAt: result.received_at,
          parsedAt: result.parsed_at,
          licenseNumber: result.license_number,
          licenseState: result.license_state,
        } : null
      })() : null,
    })

  } catch (error: any) {
    console.error('[MVR CHECK] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

