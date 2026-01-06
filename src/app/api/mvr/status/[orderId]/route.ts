import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

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

    // Use service role client to bypass RLS (we use Alchemy wallet auth, not Supabase Auth)
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

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

    // Get MVR order with result - include all detailed data
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
          violations,
          accident_count,
          accidents,
          suspension_count,
          suspensions,
          medical_cert_expiration,
          medical_cert_status,
          cdl_endorsements,
          cdl_restrictions,
          result_status,
          received_at,
          parsed_at,
          parsed_data
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
        errorMessage: mvrOrder.error_message,
        applicantPortalUrl: mvrOrder.applicant_portal_url
      },
      result: result ? {
        id: result.id,
        // License info
        licenseNumber: result.license_number,
        licenseState: result.license_state,
        licenseClass: result.license_class,
        licenseStatus: result.license_status,
        licenseExpirationDate: result.license_expiration_date,
        // All licenses (from parsed_data if available)
        licenses: result.parsed_data?.licenses || [],
        // Summary counts
        totalPoints: result.total_points,
        violationCount: result.violation_count,
        accidentCount: result.accident_count,
        suspensionCount: result.suspension_count,
        // Detailed arrays
        violations: result.violations || [],
        accidents: result.accidents || [],
        suspensions: result.suspensions || [],
        // Medical certificate
        medicalCertExpiration: result.medical_cert_expiration || result.parsed_data?.medical?.certExpiration,
        medicalCertIssueDate: result.parsed_data?.medical?.certIssueDate,
        medicalCertStatus: result.medical_cert_status || result.parsed_data?.medical?.certStatus,
        medicalCertSelfCertification: result.parsed_data?.medical?.selfCertification,
        // CDL info
        cdlEndorsements: result.cdl_endorsements || [],
        cdlRestrictions: result.cdl_restrictions || [],
        // Status
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

