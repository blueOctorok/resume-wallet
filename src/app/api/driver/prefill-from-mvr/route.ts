import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { loadMvrDotProjection } from '@/lib/mvr-form1-projection'
import { applyProjectionToApplicationData } from '@/lib/apply-mvr-to-dot-application'
import { loadPspDotProjection } from '@/lib/psp-form2-projection'
import { applyPspProjectionToApplicationData } from '@/lib/apply-psp-to-dot-application'

/**
 * POST /api/driver/prefill-from-mvr
 *
 * Returns Form 1 + Form 2 projected from the latest driver-owned MVR and/or PSP
 * (P3.7). Always overwrites issuer rows even when values match (late-screening path).
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
    const [mvr, psp] = await Promise.all([
      loadMvrDotProjection(supabase, sessionUserId),
      loadPspDotProjection(supabase, sessionUserId),
    ])

    if (!mvr && !psp) {
      return NextResponse.json(
        {
          error: 'No screening results found',
          message:
            'Complete a driver-owned MVR or PSP first, then return to auto-fill the DOT app.',
        },
        { status: 404 },
      )
    }

    let form1 = existingForm1
    let form2 = existingForm2

    if (mvr) {
      const next = applyProjectionToApplicationData(
        { form1, form2, form3: null },
        mvr,
      )
      form1 = next.form1
      form2 = next.form2
    }
    if (psp) {
      const next = applyPspProjectionToApplicationData(
        { form1, form2, form3: null },
        psp,
      )
      form1 = next.form1
      form2 = next.form2
    }

    console.log(
      '[SCREENING PREFILL] Projected Form 1+2 for',
      sessionUserId,
      'mvrLocked=',
      mvr ? Object.keys(mvr.form1Provenance.fields).length : 0,
      'pspCrashes=',
      psp?.crashCount ?? 0,
      'pspInspections=',
      psp?.inspectionCount ?? 0,
    )

    return NextResponse.json({
      success: true,
      form1Data: form1,
      form2Data: form2,
      summary: mvr?.summary ?? null,
      mvrResultId: mvr?.mvrResultId ?? null,
      mvrReceivedAt: mvr?.mvrReceivedAt ?? null,
      orderId: mvr?.orderId ?? null,
      accioOrderNumber: mvr?.accioOrderNumber ?? null,
      lockedFieldCount: mvr ? Object.keys(mvr.form1Provenance.fields).length : 0,
      mvrAccidentCount: mvr?.mvrAccidents.length ?? 0,
      mvrConvictionCount: mvr?.mvrConvictions.length ?? 0,
      pspResultId: psp?.pspResultId ?? null,
      pspCrashCount: psp?.crashCount ?? 0,
      pspInspectionCount: psp?.inspectionCount ?? 0,
      pspCleanRecord: psp?.isCleanRecord ?? false,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[SCREENING PREFILL] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: message },
      { status: 500 },
    )
  }
}
