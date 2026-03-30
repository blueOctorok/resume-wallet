import type { SupabaseClient } from '@supabase/supabase-js'

/** Candidate vs employer hub auto-welcome is tracked separately on `users`. */
export type StormiAutoWelcomeMode = 'candidate' | 'employer'

export function stormiAutoWelcomeColumn(
  mode: StormiAutoWelcomeMode,
): 'ava_auto_welcome_candidate_at' | 'ava_auto_welcome_employer_at' {
  return mode === 'candidate' ? 'ava_auto_welcome_candidate_at' : 'ava_auto_welcome_employer_at'
}

export async function hasCompletedStormiAutoWelcome(
  supabase: SupabaseClient,
  userId: string,
  mode: StormiAutoWelcomeMode,
): Promise<boolean> {
  const col = stormiAutoWelcomeColumn(mode)
  const { data, error } = await supabase.from('users').select(col).eq('id', userId).maybeSingle()
  if (error || !data) return false
  return Boolean((data as Record<string, unknown>)[col])
}

export async function markStormiAutoWelcomeComplete(
  supabase: SupabaseClient,
  userId: string,
  mode: StormiAutoWelcomeMode,
): Promise<void> {
  const col = stormiAutoWelcomeColumn(mode)
  await supabase.from('users').update({ [col]: new Date().toISOString() }).eq('id', userId)
}

/** Returned when the client retries auto-welcome but DB already recorded completion */
export const STORMI_DUPLICATE_AUTO_WELCOME_REPLY =
  "We already kicked this off when you first landed here — scroll up if you see my earlier note. If not, ask anything below and we'll pick up from there."
