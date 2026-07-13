import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { loadMvrDotProjection } from '@/lib/mvr-form1-projection'
import { applyProjectionToApplicationData } from '@/lib/apply-mvr-to-dot-application'

/**
 * POST /api/driver/prefill-from-mvr
 *
 * Returns Form 1 + Form 2 projected from the latest MVR, with provenance so the
 * DOT wizard can hard-lock identity/license and MVR accident/conviction rows (P3.7).
 *
 * Always overwrites lock paths / MVR rows even when values match (late-MVR path).
 *
 * Body (optional): { existingForm1?, existingForm2? }
 */
export async function POST(request: NextRequest) {
  try {
    const sessionUserId = await getStormUserIdFromRequest(request)
    if (!sessionUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    let existingForm1: Record<string, unknown> | null = null
    let existingForm2: Record<string, unknown> | null = null
    try {
      const body = await request.json()
      if (body?.existingForm1 && typeof body.existingForm1 === 'object') {
        existingForm1 = body.existingForm1 as Record<string, unknown>
      }
      if (body?.existingForm2 && typeof body.existingForm2 === 'object') {
        existingForm2 = body.existingForm2 as Record<string, unknown>
      }
    } catch {
      // empty body is fine
    }

    const supabase = await getAdminSupabaseClient()
    const projection = await loadMvrDotProjection(supabase, sessionUserId)

    if (!projection) {
      return NextResponse.json(
        {
          error: 'No MVR results found',
          message: 'Complete a driver-owned MVR first, then return to auto-fill the DOT app.',
        },
        { status: 404 },
      )
    }

    const merged = applyProjectionToApplicationData(
      { form1: existingForm1, form2: existingForm2, form3: null },
      projection,
    )

    console.log(
      '[MVR PREFILL] Projected Form 1+2 for',
      sessionUserId,
      Object.keys(projection.form1Provenance.fields).length,
      'locked fields,',
      projection.mvrAccidents.length,
      'accidents,',
      projection.mvrConvictions.length,
      'convictions',
    )

    return NextResponse.json({
      success: true,
      form1Data: merged.form1,
      form2Data: merged.form2,
      summary: projection.summary,
      mvrResultId: projection.mvrResultId,
      mvrReceivedAt: projection.mvrReceivedAt,
      orderId: projection.orderId,
      accioOrderNumber: projection.accioOrderNumber,
      lockedFieldCount: Object.keys(projection.form1Provenance.fields).length,
      mvrAccidentCount: projection.mvrAccidents.length,
      mvrConvictionCount: projection.mvrConvictions.length,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[MVR PREFILL] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: message },
      { status: 500 },
    )
  }
}
