import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { requireAdmin } from '@/lib/admin-auth'

/**
 * GET /api/admin/mvr/[id]
 * Full MVR order and result(s) for admin view. No wallet check.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request)
  if (!auth.authorized) return auth.error!

  const { id } = await params

  try {
    const supabase = await getAdminSupabaseClient()

    const { data: order, error: orderError } = await supabase
      .from('mvr_orders')
      .select(`
        id,
        driver_user_id,
        driver_profile_id,
        accio_order_number,
        accio_suborder_number,
        accio_remote_order_number,
        order_type,
        mvr_search_type,
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
        created_at,
        updated_at,
        order_xml,
        result_xml,
        mvr_results (
          id,
          license_number,
          license_state,
          license_class,
          license_status,
          license_issue_date,
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
      .eq('id', id)
      .single()

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'MVR order not found' },
        { status: 404 }
      )
    }

    const results = Array.isArray(order.mvr_results) ? order.mvr_results : order.mvr_results ? [order.mvr_results] : []

    const { data: user } = await supabase
      .from('users')
      .select('wallet_address')
      .eq('id', order.driver_user_id)
      .single()

    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('first_name, last_name')
      .eq('user_id', order.driver_user_id)
      .maybeSingle()

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        driverUserId: order.driver_user_id,
        driverProfileId: order.driver_profile_id,
        legacyWalletAddress: user?.wallet_address ?? null,
        driverName: userProfile?.first_name && userProfile?.last_name
          ? `${userProfile.first_name} ${userProfile.last_name}`
          : null,
        accioOrderNumber: order.accio_order_number,
        accioSuborderNumber: order.accio_suborder_number,
        accioRemoteOrderNumber: order.accio_remote_order_number,
        orderType: order.order_type,
        mvrSearchType: order.mvr_search_type,
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
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        orderXml: order.order_xml ?? null,
        resultXml: order.result_xml ?? null,
      },
      results: results.map((r: Record<string, unknown>) => ({
        id: r.id,
        licenseNumber: r.license_number,
        licenseState: r.license_state,
        licenseClass: r.license_class,
        licenseStatus: r.license_status,
        licenseIssueDate: r.license_issue_date,
        licenseExpirationDate: r.license_expiration_date,
        totalPoints: r.total_points,
        violationCount: r.violation_count,
        violations: r.violations ?? [],
        accidentCount: r.accident_count,
        accidents: r.accidents ?? [],
        suspensionCount: r.suspension_count,
        suspensions: r.suspensions ?? [],
        medicalCertExpiration: r.medical_cert_expiration,
        medicalCertStatus: r.medical_cert_status,
        cdlEndorsements: r.cdl_endorsements ?? [],
        cdlRestrictions: r.cdl_restrictions ?? [],
        resultStatus: r.result_status,
        receivedAt: r.received_at,
        parsedAt: r.parsed_at,
        parsedData: r.parsed_data ?? null,
      })),
    })
  } catch (err) {
    console.error('[ADMIN MVR GET] Error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/mvr/[id]
 * Remove an MVR order. Cascades to mvr_results. Block table refs get SET NULL.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request)
  if (!auth.authorized) return auth.error!

  const { id } = await params

  try {
    const supabase = await getAdminSupabaseClient()

    const { data: row, error: findError } = await supabase
      .from('mvr_orders')
      .select('id, driver_user_id, status, dl_state, accio_order_number')
      .eq('id', id)
      .single()

    if (findError || !row) {
      return NextResponse.json(
        { error: 'MVR order not found' },
        { status: 404 }
      )
    }

    // Delete mvr_results first (they reference mvr_orders).
    // mvr_results has ON DELETE CASCADE from mvr_orders, but we use admin client
    // so we delete the order and let FK CASCADE handle results if schema has it.
    // From migration: mvr_results.mvr_order_id REFERENCES mvr_orders(id) ON DELETE CASCADE
    // So deleting mvr_orders will cascade delete mvr_results. Good.
    const { error: deleteError } = await supabase
      .from('mvr_orders')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('[ADMIN MVR] Delete error:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete MVR order' },
        { status: 500 }
      )
    }

    console.log(
      `[ADMIN] MVR order deleted: ${id} (state: ${row.dl_state}, accio: ${row.accio_order_number}) by admin: ${auth.email}`
    )

    return NextResponse.json({
      success: true,
      message: 'MVR order and associated results removed.',
    })
  } catch (err) {
    console.error('[ADMIN MVR] Delete unexpected error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
