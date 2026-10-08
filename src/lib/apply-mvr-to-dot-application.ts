/**
 * Apply an MVR projection onto an existing driver_applications row (P3.7 late-MVR).
 * Overwrites Form 1 lock paths + Form 2 MVR rows even when values already match,
 * so badges/locks appear after a driver filled the DOT app before screening completed.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { saveCdlData } from '@/lib/block-data'
import {
  getForm1ValueAtPath,
  mergeMvrPrefillIntoForm1,
  mergeMvrRowsIntoForm2,
  type Form1WithProvenance,
  type Form2WithProvenance,
} from '@/lib/dot-field-provenance'
import { loadMvrDotProjection, type MvrDotProjection } from '@/lib/mvr-form1-projection'

export interface ApplyMvrToDotResult {
  applied: boolean
  reason?: string
  lockedFieldCount?: number
  mvrAccidentCount?: number
  mvrConvictionCount?: number
}

export function applyProjectionToApplicationData(
  applicationData: {
    form1?: Record<string, unknown> | null
    form2?: Record<string, unknown> | null
    form3?: unknown
  },
  projection: MvrDotProjection,
): {
  form1: Form1WithProvenance
  form2: Form2WithProvenance
  form3: unknown
} {
  const form1 = mergeMvrPrefillIntoForm1(
    applicationData.form1 ?? null,
    projection.form1Data,
    projection.form1Provenance,
  )

  const form2 = mergeMvrRowsIntoForm2(
    applicationData.form2 ?? null,
    projection.mvrAccidents,
    projection.mvrConvictions,
    {
      mvrResultId: projection.mvrResultId,
      orderId: projection.orderId,
      accioOrderNumber: projection.accioOrderNumber,
      asOf: projection.asOf,
    },
  )

  return {
    form1,
    form2,
    form3: applicationData.form3 ?? null,
  }
}

function classLetter(typeClass: string): string {
  const match = typeClass.match(/[A-C]/i)
  return match ? match[0].toUpperCase() : typeClass.trim()
}

/** MVR-owned license fields replace whatever the photo or the driver put on the CDL block. */
async function writeCdlFromMvr(
  supabase: SupabaseClient,
  userId: string,
  form1: Form1WithProvenance,
): Promise<void> {
  const fields = form1._fieldProvenance?.fields
  if (!fields) return
  const patch: Parameters<typeof saveCdlData>[2] = {}
  const take = (path: keyof typeof fields, write: (value: string) => void) => {
    if (fields[path]?.source !== 'mvr') return
    const value = getForm1ValueAtPath(form1, path).trim()
    if (value) write(value)
  }
  take('currentLicenses.0.licenseNumber', (value) => {
    patch.cdl_number = value
  })
  take('currentLicenses.0.state', (value) => {
    patch.cdl_state = value
  })
  take('currentLicenses.0.typeClass', (value) => {
    patch.cdl_class = classLetter(value)
  })
  take('currentLicenses.0.expirationDate', (value) => {
    patch.cdl_expiration = value
  })
  take('currentLicenses.0.endorsements', (value) => {
    const list = value.split(',').map((item) => item.trim()).filter(Boolean)
    if (list.length > 0) patch.endorsements = list
  })
  if (Object.keys(patch).length === 0) return
  await saveCdlData(supabase, userId, patch)
}

/**
 * Load MVR projection and merge into driver_applications for this user.
 * No-op if no application row or no MVR. Non-throwing for webhook use.
 */
export async function applyMvrProjectionToDriverApplication(
  supabase: SupabaseClient,
  userId: string,
  projection?: MvrDotProjection | null,
): Promise<ApplyMvrToDotResult> {
  const proj = projection === undefined ? await loadMvrDotProjection(supabase, userId) : projection
  if (!proj) {
    return { applied: false, reason: 'no_mvr_projection' }
  }

  const { data: app, error } = await supabase
    .from('driver_applications')
    .select('id, application_data, is_complete')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.warn('[MVR→DOT] Failed to load application:', error.message)
    return { applied: false, reason: 'load_error' }
  }

  if (!app) {
    return { applied: false, reason: 'no_application' }
  }

  // Still apply to completed apps — verified fields should stay honest if MVR refreshes
  const ad = (app.application_data ?? {}) as {
    form1?: Record<string, unknown> | null
    form2?: Record<string, unknown> | null
    form3?: unknown
  }

  const next = applyProjectionToApplicationData(ad, proj)

  const { error: updateError } = await supabase
    .from('driver_applications')
    .update({
      application_data: next,
      updated_at: new Date().toISOString(),
    })
    .eq('id', app.id)

  if (updateError) {
    console.warn('[MVR→DOT] Failed to update application:', updateError.message)
    return { applied: false, reason: 'update_error' }
  }

  await writeCdlFromMvr(supabase, userId, next.form1)

  console.log('[MVR→DOT] Applied projection to application', app.id, {
    lockedFields: Object.keys(proj.form1Provenance.fields).length,
    accidents: proj.mvrAccidents.length,
    convictions: proj.mvrConvictions.length,
  })

  return {
    applied: true,
    lockedFieldCount: Object.keys(proj.form1Provenance.fields).length,
    mvrAccidentCount: proj.mvrAccidents.length,
    mvrConvictionCount: proj.mvrConvictions.length,
  }
}
