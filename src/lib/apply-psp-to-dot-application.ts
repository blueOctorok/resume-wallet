/**
 * Apply a PSP projection onto Form 2 of an existing driver_applications row (P3.7).
 * Orthogonal to MVR — preserves MVR rows/provenance while replacing PSP crashes/inspections.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { mergePspRowsIntoForm2, type Form2WithProvenance } from '@/lib/dot-field-provenance'
import { loadPspDotProjection, type PspDotProjection } from '@/lib/psp-form2-projection'

export interface ApplyPspToDotResult {
  applied: boolean
  reason?: string
  pspCrashCount?: number
  pspInspectionCount?: number
  isCleanRecord?: boolean
}

export function applyPspProjectionToApplicationData(
  applicationData: {
    form1?: Record<string, unknown> | null
    form2?: Record<string, unknown> | null
    form3?: unknown
  },
  projection: PspDotProjection,
): {
  form1: Record<string, unknown> | null
  form2: Form2WithProvenance
  form3: unknown
} {
  const form2 = mergePspRowsIntoForm2(
    applicationData.form2 ?? null,
    projection.pspCrashesAsAccidents,
    projection.pspInspections,
    {
      pspResultId: projection.pspResultId,
      orderId: projection.orderId,
      accioOrderNumber: projection.accioOrderNumber,
      asOf: projection.asOf,
    },
  )

  return {
    form1: (applicationData.form1 as Record<string, unknown> | null) ?? null,
    form2,
    form3: applicationData.form3 ?? null,
  }
}

export async function applyPspProjectionToDriverApplication(
  supabase: SupabaseClient,
  userId: string,
  projection?: PspDotProjection | null,
): Promise<ApplyPspToDotResult> {
  const proj = projection === undefined ? await loadPspDotProjection(supabase, userId) : projection
  if (!proj) {
    return { applied: false, reason: 'no_psp_projection' }
  }

  const { data: app, error } = await supabase
    .from('driver_applications')
    .select('id, application_data')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.warn('[PSP→DOT] Failed to load application:', error.message)
    return { applied: false, reason: 'load_error' }
  }
  if (!app) {
    return { applied: false, reason: 'no_application' }
  }

  const ad = (app.application_data ?? {}) as {
    form1?: Record<string, unknown> | null
    form2?: Record<string, unknown> | null
    form3?: unknown
  }

  const next = applyPspProjectionToApplicationData(ad, proj)

  const { error: updateError } = await supabase
    .from('driver_applications')
    .update({
      application_data: next,
      updated_at: new Date().toISOString(),
    })
    .eq('id', app.id)

  if (updateError) {
    console.warn('[PSP→DOT] Failed to update application:', updateError.message)
    return { applied: false, reason: 'update_error' }
  }

  console.log('[PSP→DOT] Applied projection to application', app.id, {
    crashes: proj.crashCount,
    inspections: proj.inspectionCount,
    clean: proj.isCleanRecord,
  })

  return {
    applied: true,
    pspCrashCount: proj.crashCount,
    pspInspectionCount: proj.inspectionCount,
    isCleanRecord: proj.isCleanRecord,
  }
}
