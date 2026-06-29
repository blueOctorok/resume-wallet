import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { resolveEmployerCompanyForWallet } from '@/lib/employer-talent-auth'
import { fetchEmployerAccessiblePspOrder } from '@/lib/employer-screening-order-access'
import { getStormUserIdFromRequest } from '@/lib/auth-session'

const PSP_ORDER_SELECT = `
        *,
        psp_results (
          id,
          result_status,
          received_at,
          parsed_at,
          parsed_data
        )
      `

function jsonFromPspOrder(order: Record<string, unknown>) {
  const result = Array.isArray(order.psp_results)
    ? (order.psp_results[0] as Record<string, unknown> | undefined)
    : (order.psp_results as Record<string, unknown> | undefined)

  return {
    success: true,
    order: {
      id: order.id,
      orderNumber: order.accio_order_number,
      subOrderNumber: order.accio_suborder_number,
      remoteOrderNumber: order.accio_remote_order_number,
      remoteSubOrderNumber: order.accio_remote_suborder_number,
      status: order.status,
      // Accio-derived outcome (clear/hits/etc) — see src/lib/accio-result-status.ts
      resultOutcome: order.result_outcome ?? null,
      dlNumber: order.dl_number,
      dlState: order.dl_state,
      orderedAt: order.ordered_at,
      processedAt: order.processed_at,
      completedAt: order.completed_at,
      expiresAt: order.expires_at,
      feeAmount: order.fee_amount,
      errorMessage: order.error_message,
      orderedByEmployer: Boolean(order.ordered_by_company_id),
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
  }
}

/**
 * GET /api/psp/status/[orderId]?sessionUserId=...
 *
 * Optional **`employerCandidateUserId`**: company-paid OR consenting-company driver-owned.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const { orderId } = await params
    const { searchParams } = new URL(request.url)
    const sessionUserId = await getStormUserIdFromRequest(request)
    const employerCandidateUserId = searchParams.get('employerCandidateUserId')

    if (!sessionUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    if (employerCandidateUserId) {
      const ctx = await resolveEmployerCompanyForWallet(supabase, sessionUserId)
      if (!ctx) {
        return NextResponse.json({ error: 'No company access' }, { status: 403 })
      }

      const { data: order, error: orderError } = await fetchEmployerAccessiblePspOrder(
        supabase,
        PSP_ORDER_SELECT,
        { companyId: ctx.companyId, candidateUserId: employerCandidateUserId, orderId },
      )

      if (orderError || !order) {
        return NextResponse.json({ error: 'PSP order not found' }, { status: 404 })
      }

      return NextResponse.json(jsonFromPspOrder(order as Record<string, unknown>))
    }

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('id', sessionUserId)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { data: order, error: orderError } = await supabase
      .from('psp_orders')
      .select(PSP_ORDER_SELECT)
      .eq('id', orderId)
      .eq('driver_user_id', user.id)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'PSP order not found' }, { status: 404 })
    }

    return NextResponse.json(jsonFromPspOrder(order as Record<string, unknown>))
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[PSP STATUS]', error)
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 })
  }
}
