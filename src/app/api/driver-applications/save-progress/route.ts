import { NextRequest, NextResponse } from 'next/server'
import { saveDriverApplication } from '@/lib/driver-application-db'
import { getStormUserIdFromRequest } from '@/lib/auth-session'
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import {
  reprojectScreeningOntoApp,
  type DotApplicationData,
} from '@/lib/reproject-screening-onto-app'

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

    const next = await reprojectScreeningOntoApp(
      supabase,
      userId,
      (data.application_data ?? {}) as Partial<DotApplicationData>,
    )

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
    const projected = await reprojectScreeningOntoApp(supabase, userId, {
      form1: form1Data ?? null,
      form2: form2Data ?? null,
      form3: form3Data ?? null,
    })

    console.log('[SAVE PROGRESS] Saving application progress:', {
      userId,
      currentStep,
      hasForm1: !!projected.form1,
      hasForm2: !!projected.form2,
      hasForm3: !!projected.form3,
    })

    const result = await saveDriverApplication(supabase, userId, projected, currentStep)

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
