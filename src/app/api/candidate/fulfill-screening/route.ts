import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { placeScreeningOrder } from '@/lib/place-screening-order'
import { isValidSsn, normalizeSsnDigits } from '@/lib/ssn'

/**
 * POST /api/candidate/fulfill-screening
 *
 * Candidate-initiated endpoint that places an Accio order AFTER the candidate
 * has signed the employer-requested disclosure form (MVR or PSP).
 *
 * Body:
 *   requestId    string   — candidate_requests.id being fulfilled
 *   type         'mvr' | 'psp'  — each places a single Accio suborder (no forced bundle).
 *   formData: {
 *     firstName, lastName, middleName?, dob, ssn (full 9-digit, not persisted),
 *     dlNumber, dlState, address, city, state, zip, email?, phone?
 *   }
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const { requestId, type, formData } = body

    if (!requestId || !type || !formData) {
      return NextResponse.json({ error: 'requestId, type, and formData are required' }, { status: 400 })
    }

    if (!['mvr', 'psp'].includes(type)) {
      return NextResponse.json({ error: 'type must be mvr or psp' }, { status: 400 })
    }

    const fullSsn = normalizeSsnDigits(formData.ssn)
    if (!isValidSsn(fullSsn)) {
      return NextResponse.json(
        {
          error:
            'A full 9-digit SSN is required (last-4 forces Accio onto the slow applicant-portal verification path).',
        },
        { status: 400 },
      )
    }

    const supabase = await getAdminSupabaseClient()

    // CASE 3: the screening order needs the user's email, so we still load the row by id.
    const { data: user } = await supabase
      .from('users')
      .select('id, email')
      .eq('id', userId)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { data: candidateRequest } = await supabase
      .from('candidate_requests')
      .select('id, company_id, requested_by_user_id, candidate_user_id, request_type, status')
      .eq('id', requestId)
      .eq('candidate_user_id', user.id)
      .single()

    if (!candidateRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    const placed = await placeScreeningOrder(supabase, request, {
      driverUserId: user.id,
      driverEmail: user.email ?? null,
      companyId: candidateRequest.company_id as string,
      employerUserId: (candidateRequest.requested_by_user_id as string | null) ?? null,
      type: type as 'mvr' | 'psp',
      formData,
      candidateRequestIdToComplete: requestId,
    })

    if (placed.ok === false) {
      return NextResponse.json({ error: placed.error, details: placed.details }, { status: placed.status })
    }

    if (placed.result.type === 'psp') {
      return NextResponse.json({
        success: true,
        order: {
          id: placed.result.pspOrderId,
          pspOrderId: placed.result.pspOrderId,
          orderNumber: placed.result.orderNumber,
          status: 'pending',
          type: 'psp',
        },
      })
    }

    return NextResponse.json({
      success: true,
      order: {
        id: placed.result.orderId,
        orderNumber: placed.result.orderNumber,
        status: 'pending',
        type: 'mvr',
      },
    })
  } catch (err) {
    console.error('[FULFILL SCREENING] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
