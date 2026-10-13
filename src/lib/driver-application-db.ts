import type { SupabaseClient } from '@supabase/supabase-js'
import type { DotApplicationData } from '@/lib/reproject-screening-onto-app'

/**
 * `driver_applications` writes. Server-only — callers resolve `userId` from the
 * Supabase session first. This used to be a `'use server'` module, which made
 * every export a public POST endpoint keyed on a client-supplied user id.
 */

export interface DriverApplicationRecord {
  id: string
  user_id: string
  application_data: DotApplicationData
  application_hash: string | null
  current_step: number
  is_complete: boolean
  created_at: string
  updated_at: string
}

/** Id of the user's submitted application, or null if they haven't finished one. */
export async function findCompletedDriverApplicationId(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('driver_applications')
    .select('id')
    .eq('user_id', userId)
    .eq('is_complete', true)
    .maybeSingle()
  return (data?.id as string | undefined) ?? null
}

/** Upsert the one application row per user with the latest form data. */
export async function saveDriverApplication(
  supabase: SupabaseClient,
  userId: string,
  applicationData: DotApplicationData,
  currentStep: number,
): Promise<DriverApplicationRecord> {
  const { data: existing, error: fetchError } = await supabase
    .from('driver_applications')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()

  if (fetchError) {
    throw new Error(`Failed to check existing application: ${fetchError.message}`)
  }

  const query = existing
    ? supabase
        .from('driver_applications')
        .update({
          application_data: applicationData,
          current_step: currentStep,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
    : supabase.from('driver_applications').insert({
        user_id: userId,
        application_data: applicationData,
        current_step: currentStep,
        is_complete: false,
      })

  const { data, error } = await query.select().single()
  if (error) {
    throw new Error(`Failed to ${existing ? 'update' : 'create'} application: ${error.message}`)
  }
  return data as DriverApplicationRecord
}

/** Final submit: persist the data, stamp its content hash, flag complete. Idempotent. */
export async function completeDriverApplication(
  supabase: SupabaseClient,
  userId: string,
  applicationData: DotApplicationData,
  applicationHash: string,
): Promise<DriverApplicationRecord> {
  await saveDriverApplication(supabase, userId, applicationData, 10)

  const { data, error } = await supabase
    .from('driver_applications')
    .update({
      is_complete: true,
      application_hash: applicationHash,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to mark application as complete: ${error.message}`)
  }
  return data as DriverApplicationRecord
}
