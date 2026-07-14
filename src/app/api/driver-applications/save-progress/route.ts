import { NextRequest, NextResponse } from 'next/server'
import { saveDriverApplicationClient } from '@/lib/supabase-client-db'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { loadMvrDotProjection } from '@/lib/mvr-form1-projection'
import { applyProjectionToApplicationData } from '@/lib/apply-mvr-to-dot-application'
import { loadPspDotProjection } from '@/lib/psp-form2-projection'
import { applyPspProjectionToApplicationData } from '@/lib/apply-psp-to-dot-application'
import {
  loadEmploymentForm3Projection,
  applyEmploymentProjectionToForm3,
} from '@/lib/employment-form3-projection'
import type { Form1WithProvenance, Form2WithProvenance } from '@/lib/dot-field-provenance'
import type { Form3WithProvenance } from '@/lib/employment-form3-provenance'

/** Re-project MVR → PSP → EVR onto application_data (order preserves prior stamps). */
function reprojectScreeningOntoApp(
  applicationData: {
    form1?: Form1WithProvenance | null
    form2?: Form2WithProvenance | null
    form3?: Form3WithProvenance | Record<string, unknown> | null
  },
  mvr: Awaited<ReturnType<typeof loadMvrDotProjection>>,
  psp: Awaited<ReturnType<typeof loadPspDotProjection>>,
  employment: Awaited<ReturnType<typeof loadEmploymentForm3Projection>>,
) {
  let form1 = applicationData.form1 ?? null
  let form2 = applicationData.form2 ?? null
  let form3 = (applicationData.form3 as Form3WithProvenance | null) ?? null

  if (mvr && (form1 || form2)) {
    const next = applyProjectionToApplicationData({ form1, form2, form3 }, mvr)
    form1 = next.form1
    form2 = next.form2
  }
  if (psp && (form1 || form2)) {
    const next = applyPspProjectionToApplicationData({ form1, form2, form3 }, psp)
    form1 = next.form1 as Form1WithProvenance | null
    form2 = next.form2
  }
  // Form 3 EVR projection runs even when form3 is empty — injects verified rows
  if (employment) {
    form3 = applyEmploymentProjectionToForm3(form3, employment)
  }
  return { form1, form2, form3 }
}

/**
 * GET — load saved application. Re-projects MVR + PSP locked Form 2 rows from live results.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const supabase = await getAdminSupabaseClient()

    const { data, error } = await supabase
      .from('driver_applications')
      .select('id, application_data, current_step, is_complete, updated_at')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      console.error('[SAVE PROGRESS GET]', error)
      return NextResponse.json({ error: 'Failed to load application' }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ application: null })
    }

    const applicationData = (data.application_data ?? {}) as {
      form1?: Form1WithProvenance | null
      form2?: Form2WithProvenance | null
      form3?: Form3WithProvenance | null
    }

    const [mvr, psp, employment] = await Promise.all([
      loadMvrDotProjection(supabase, userId),
      loadPspDotProjection(supabase, userId),
      loadEmploymentForm3Projection(supabase, userId),
    ])
    const next = reprojectScreeningOntoApp(applicationData, mvr, psp, employment)

    return NextResponse.json({
      application: {
        ...data,
        application_data: next,
      },
    })
  } catch (e) {
    console.error('[SAVE PROGRESS GET]', e)
    return NextResponse.json({ error: 'Failed to load application' }, { status: 500 })
  }
}

/**
 * POST — save in-progress DOT application. MVR + PSP Form 2 rows are overwritten
 * from live screening results before persist (P3.7).
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getStormUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { form1Data, form2Data, form3Data, currentStep } = await request.json()

    if (!currentStep || currentStep < 1 || currentStep > 3) {
      return NextResponse.json(
        { error: 'Valid currentStep (1-3) is required' },
        { status: 400 },
      )
    }

    const supabase = await getAdminSupabaseClient()
    const [mvr, psp, employment] = await Promise.all([
      loadMvrDotProjection(supabase, userId),
      loadPspDotProjection(supabase, userId),
      loadEmploymentForm3Projection(supabase, userId),
    ])

    const projected = reprojectScreeningOntoApp(
      {
        form1: (form1Data as Form1WithProvenance) ?? null,
        form2: (form2Data as Form2WithProvenance) ?? null,
        form3: form3Data,
      },
      mvr,
      psp,
      employment,
    )

    const applicationData = {
      form1: projected.form1 || null,
      form2: projected.form2 || null,
      form3: projected.form3 || null,
    }

    console.log('[SAVE PROGRESS] Saving application progress:', {
      userId,
      currentStep,
      hasForm1: !!projected.form1,
      hasForm2: !!projected.form2,
      hasForm3: !!projected.form3,
      lockedFields: mvr ? Object.keys(mvr.form1Provenance.fields).length : 0,
      pspCrashes: psp?.crashCount ?? 0,
      pspInspections: psp?.inspectionCount ?? 0,
      verifiedEmployers: employment?.verifiedCount ?? 0,
    })

    const result = await saveDriverApplicationClient(
      '',
      applicationData as unknown as Parameters<typeof saveDriverApplicationClient>[1],
      currentStep,
      userId,
    )

    return NextResponse.json({
      success: true,
      application: {
        id: result.id,
        currentStep: result.current_step,
        isComplete: result.is_complete,
        updatedAt: result.updated_at,
      },
      form1Data: projected.form1,
      form2Data: projected.form2,
      form3Data: projected.form3,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred'
    console.error('[SAVE PROGRESS] Error:', error)
    return NextResponse.json(
      { error: 'Failed to save progress', details: message },
      { status: 500 },
    )
  }
}
