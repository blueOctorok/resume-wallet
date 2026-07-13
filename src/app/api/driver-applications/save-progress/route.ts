import { NextRequest, NextResponse } from 'next/server'
import { saveDriverApplicationClient } from '@/lib/supabase-client-db'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { loadMvrDotProjection } from '@/lib/mvr-form1-projection'
import { applyProjectionToApplicationData } from '@/lib/apply-mvr-to-dot-application'
import type { Form1WithProvenance, Form2WithProvenance } from '@/lib/dot-field-provenance'

/**
 * GET — load saved application. Re-projects MVR-locked Form 1 + Form 2 rows from live MVR.
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
      form3?: unknown
    }

    const projection = await loadMvrDotProjection(supabase, userId)
    if (projection && (applicationData.form1 || applicationData.form2)) {
      const next = applyProjectionToApplicationData(applicationData, projection)
      applicationData.form1 = next.form1
      applicationData.form2 = next.form2
    }

    return NextResponse.json({
      application: {
        ...data,
        application_data: applicationData,
      },
    })
  } catch (e) {
    console.error('[SAVE PROGRESS GET]', e)
    return NextResponse.json({ error: 'Failed to load application' }, { status: 500 })
  }
}

/**
 * POST — save in-progress DOT application. MVR-locked Form 1 fields and Form 2
 * MVR rows are overwritten from the live MVR before persist (P3.7).
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
    let safeForm1 = form1Data as Form1WithProvenance | null
    let safeForm2 = form2Data as Form2WithProvenance | null

    const projection = await loadMvrDotProjection(supabase, userId)
    if (projection && (form1Data || form2Data)) {
      const next = applyProjectionToApplicationData(
        {
          form1: (form1Data as Record<string, unknown>) ?? null,
          form2: (form2Data as Record<string, unknown>) ?? null,
          form3: form3Data,
        },
        projection,
      )
      safeForm1 = next.form1
      safeForm2 = next.form2
    }

    const applicationData = {
      form1: safeForm1 || null,
      form2: safeForm2 || null,
      form3: form3Data || null,
    }

    console.log('[SAVE PROGRESS] Saving application progress:', {
      userId,
      currentStep,
      hasForm1: !!safeForm1,
      hasForm2: !!safeForm2,
      hasForm3: !!form3Data,
      lockedFields: projection
        ? Object.keys(projection.form1Provenance.fields).length
        : 0,
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
      form1Data: safeForm1,
      form2Data: safeForm2,
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
