import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

/**
 * API Route: Get MVR Order Status
 * 
 * GET /api/mvr/status/[orderId]
 * 
 * Returns the current status of an MVR order and its results (if available)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params
    const { searchParams } = new URL(request.url)
    const walletAddress = searchParams.get('walletAddress')

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .ilike('wallet_address', walletAddress)
      .single()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Get MVR order with result
    const { data: mvrOrder, error: orderError } = await supabase
      .from('mvr_orders')
      .select(`
        *,
        mvr_results (
          id,
          license_number,
          license_state,
          license_class,
          license_status,
          license_expiration_date,
          total_points,
          violation_count,
          accident_count,
          suspension_count,
          result_status,
          received_at,
          parsed_at
        )
      `)
      .eq('id', orderId)
      .eq('driver_user_id', user.id)
      .single()

    if (orderError || !mvrOrder) {
      return NextResponse.json(
        { error: 'MVR order not found' },
        { status: 404 }
      )
    }

    // Format response
    const result = Array.isArray(mvrOrder.mvr_results) 
      ? mvrOrder.mvr_results[0] 
      : mvrOrder.mvr_results

    return NextResponse.json({
      success: true,
      order: {
        id: mvrOrder.id,
        orderNumber: mvrOrder.accio_order_number,
        subOrderNumber: mvrOrder.accio_suborder_number,
        status: mvrOrder.status,
        orderType: mvrOrder.order_type,
        dlNumber: mvrOrder.dl_number,
        dlState: mvrOrder.dl_state,
        orderedAt: mvrOrder.ordered_at,
        processedAt: mvrOrder.processed_at,
        completedAt: mvrOrder.completed_at,
        expiresAt: mvrOrder.expires_at,
        feeAmount: mvrOrder.fee_amount,
        errorMessage: mvrOrder.error_message
      },
      result: result ? {
        id: result.id,
        licenseNumber: result.license_number,
        licenseState: result.license_state,
        licenseClass: result.license_class,
        licenseStatus: result.license_status,
        licenseExpirationDate: result.license_expiration_date,
        totalPoints: result.total_points,
        violationCount: result.violation_count,
        accidentCount: result.accident_count,
        suspensionCount: result.suspension_count,
        resultStatus: result.result_status,
        receivedAt: result.received_at,
        parsedAt: result.parsed_at
      } : null
    })

  } catch (error: any) {
    console.error('[MVR STATUS] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

