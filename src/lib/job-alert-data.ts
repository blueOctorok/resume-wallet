/**
 * Job alert preferences + sent-job dedupe. Server-only; use with admin Supabase client.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  JOB_ALERTS_MAX_FREE,
  JOB_ALERTS_MAX_WITH_CREDITS,
  type JobAlertPreferenceRow,
} from '@/lib/job-alert-types'

export type { JobAlertPreferenceRow }
export { JOB_ALERTS_MAX_FREE, JOB_ALERTS_MAX_WITH_CREDITS }

export async function getMaxJobAlertsForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const { data } = await supabase
    .from('ava_chat_usage')
    .select('credits')
    .eq('user_id', userId)
    .maybeSingle()
  const credits = (data?.credits as number) ?? 0
  return credits > 0 ? JOB_ALERTS_MAX_WITH_CREDITS : JOB_ALERTS_MAX_FREE
}

export async function listJobAlertPreferences(
  supabase: SupabaseClient,
  userId: string,
): Promise<JobAlertPreferenceRow[]> {
  const { data, error } = await supabase
    .from('job_alert_preferences')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(`job_alert_preferences list: ${error.message}`)
  return (data ?? []) as JobAlertPreferenceRow[]
}

export async function countJobAlertPreferences(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('job_alert_preferences')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  if (error) throw new Error(`job_alert_preferences count: ${error.message}`)
  return count ?? 0
}

export async function getJobAlertPreferenceForUser(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<JobAlertPreferenceRow | null> {
  const { data, error } = await supabase
    .from('job_alert_preferences')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw new Error(`job_alert_preferences get: ${error.message}`)
  return (data as JobAlertPreferenceRow) ?? null
}

export async function createJobAlertPreference(
  supabase: SupabaseClient,
  userId: string,
  input: {
    label?: string | null
    keywords: string
    location?: string | null
    salary_min?: number | null
    min_match_score?: number
    is_active?: boolean
  },
): Promise<JobAlertPreferenceRow> {
  const { data, error } = await supabase
    .from('job_alert_preferences')
    .insert({
      user_id: userId,
      label: input.label?.trim() || null,
      keywords: input.keywords.trim(),
      location: input.location?.trim() || null,
      salary_min: input.salary_min ?? null,
      min_match_score: input.min_match_score ?? 72,
      is_active: input.is_active ?? true,
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single()

  if (error) throw new Error(`job_alert_preferences insert: ${error.message}`)
  return data as JobAlertPreferenceRow
}

export async function updateJobAlertPreference(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  patch: Partial<{
    label: string | null
    keywords: string
    location: string | null
    salary_min: number | null
    min_match_score: number
    is_active: boolean
  }>,
): Promise<JobAlertPreferenceRow> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.label !== undefined) row.label = patch.label?.trim() || null
  if (patch.keywords !== undefined) row.keywords = patch.keywords.trim()
  if (patch.location !== undefined) row.location = patch.location?.trim() || null
  if (patch.salary_min !== undefined) row.salary_min = patch.salary_min
  if (patch.min_match_score !== undefined) row.min_match_score = patch.min_match_score
  if (patch.is_active !== undefined) row.is_active = patch.is_active

  const { data, error } = await supabase
    .from('job_alert_preferences')
    .update(row)
    .eq('id', id)
    .eq('user_id', userId)
    .select('*')
    .single()

  if (error) throw new Error(`job_alert_preferences update: ${error.message}`)
  return data as JobAlertPreferenceRow
}

export async function deleteJobAlertPreference(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from('job_alert_preferences')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) throw new Error(`job_alert_preferences delete: ${error.message}`)
}

/** Oldest / never-scanned first so cron rotates through users fairly. */
export async function fetchActiveJobAlertPrefsForCron(
  supabase: SupabaseClient,
  limit: number,
): Promise<JobAlertPreferenceRow[]> {
  const { data, error } = await supabase
    .from('job_alert_preferences')
    .select('*')
    .eq('is_active', true)
    .order('last_scan_at', { ascending: true, nullsFirst: true })
    .limit(limit)

  if (error) throw new Error(`job_alert_preferences cron batch: ${error.message}`)
  return (data ?? []) as JobAlertPreferenceRow[]
}

export async function touchJobAlertLastScan(
  supabase: SupabaseClient,
  preferenceId: string,
): Promise<void> {
  const { error } = await supabase
    .from('job_alert_preferences')
    .update({ last_scan_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', preferenceId)

  if (error) console.error('[JOB_ALERT] touch last_scan_at:', error.message)
}

export async function getSentExternalJobIds(
  supabase: SupabaseClient,
  userId: string,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('job_alert_sent')
    .select('external_job_id')
    .eq('user_id', userId)

  if (error) throw new Error(`job_alert_sent list: ${error.message}`)
  return new Set((data ?? []).map((r) => String((r as { external_job_id: string }).external_job_id)))
}

export async function insertJobAlertSent(
  supabase: SupabaseClient,
  userId: string,
  externalJobId: string,
): Promise<boolean> {
  const { error } = await supabase.from('job_alert_sent').insert({
    user_id: userId,
    external_job_id: externalJobId,
  })
  if (error) {
    // Unique violation = race; treat as already notified
    if (error.code === '23505') return false
    throw new Error(`job_alert_sent insert: ${error.message}`)
  }
  return true
}
