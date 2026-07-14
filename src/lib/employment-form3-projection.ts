/**
 * Load VERIFIED / PARTIALLY_VERIFIED employment verification requests for Form 3 projection.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  mergeVerifiedEmployersIntoForm3,
  type Form3WithProvenance,
} from '@/lib/employment-form3-provenance'
import type { VerifiedEmploymentSource } from '@/lib/employment-to-form3-mapper'

export interface EmploymentForm3Projection {
  verifiedSources: VerifiedEmploymentSource[]
  verifiedCount: number
  asOf: string | null
}

export async function loadEmploymentForm3Projection(
  supabase: SupabaseClient,
  userId: string,
): Promise<EmploymentForm3Projection | null> {
  const { data, error } = await supabase
    .from('employment_verification_requests')
    .select(
      'id, employment_id, previous_employer_name, claimed_position, claimed_start_date, claimed_end_date, verified_at, status',
    )
    .eq('driver_id', userId)
    .in('status', ['VERIFIED', 'PARTIALLY_VERIFIED'])
    .not('verified_at', 'is', null)
    .order('verified_at', { ascending: false })

  if (error) {
    console.warn('[EVR→DOT] load failed:', error.message)
    return null
  }
  if (!data?.length) return null

  const verifiedSources: VerifiedEmploymentSource[] = data.map((row) => ({
    id: String(row.id),
    employment_id: String(row.employment_id ?? ''),
    previous_employer_name: String(row.previous_employer_name ?? ''),
    claimed_position: String(row.claimed_position ?? ''),
    claimed_start_date: String(row.claimed_start_date ?? ''),
    claimed_end_date: row.claimed_end_date != null ? String(row.claimed_end_date) : null,
    verified_at: row.verified_at != null ? String(row.verified_at) : null,
    status: String(row.status),
  }))

  const asOfDates = verifiedSources
    .map((v) => v.verified_at)
    .filter((d): d is string => Boolean(d))
    .sort()

  return {
    verifiedSources,
    verifiedCount: verifiedSources.length,
    asOf: asOfDates.length ? asOfDates[asOfDates.length - 1] : null,
  }
}

export function applyEmploymentProjectionToForm3(
  form3: Record<string, unknown> | null | undefined,
  projection: EmploymentForm3Projection,
): Form3WithProvenance {
  return mergeVerifiedEmployersIntoForm3(form3 ?? null, projection.verifiedSources)
}

/**
 * Persist EVR projection into driver_applications.form3 when a row exists.
 */
export async function applyEmploymentProjectionToDriverApplication(
  supabase: SupabaseClient,
  userId: string,
  projection?: EmploymentForm3Projection | null,
): Promise<{ applied: boolean; reason?: string; verifiedCount?: number }> {
  const proj =
    projection === undefined ? await loadEmploymentForm3Projection(supabase, userId) : projection
  if (!proj) return { applied: false, reason: 'no_verified_employment' }

  const { data: app, error } = await supabase
    .from('driver_applications')
    .select('id, application_data')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.warn('[EVR→DOT] load application failed:', error.message)
    return { applied: false, reason: 'load_error' }
  }
  if (!app) return { applied: false, reason: 'no_application' }

  const ad = (app.application_data ?? {}) as {
    form1?: unknown
    form2?: unknown
    form3?: Record<string, unknown> | null
  }

  const form3 = applyEmploymentProjectionToForm3(ad.form3, proj)

  const { error: updateError } = await supabase
    .from('driver_applications')
    .update({
      application_data: { ...ad, form3 },
      updated_at: new Date().toISOString(),
    })
    .eq('id', app.id)

  if (updateError) {
    console.warn('[EVR→DOT] update failed:', updateError.message)
    return { applied: false, reason: 'update_error' }
  }

  console.log('[EVR→DOT] Applied', proj.verifiedCount, 'verified employers to', app.id)
  return { applied: true, verifiedCount: proj.verifiedCount }
}
