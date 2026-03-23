import type { SupabaseClient } from '@supabase/supabase-js'

/** Candidate vs employer hub auto-welcome is tracked separately on `users`. */
export type AvaAutoWelcomeMode = 'candidate' | 'employer'

export function avaAutoWelcomeColumn(
  mode: AvaAutoWelcomeMode,
): 'ava_auto_welcome_candidate_at' | 'ava_auto_welcome_employer_at' {
  return mode === 'candidate' ? 'ava_auto_welcome_candidate_at' : 'ava_auto_welcome_employer_at'
}

export async function hasCompletedAvaAutoWelcome(
  supabase: SupabaseClient,
  userId: string,
  mode: AvaAutoWelcomeMode,
): Promise<boolean> {
  const col = avaAutoWelcomeColumn(mode)
  const { data, error } = await supabase.from('users').select(col).eq('id', userId).maybeSingle()
  if (error || !data) return false
  return Boolean((data as Record<string, unknown>)[col])
}

export async function markAvaAutoWelcomeComplete(
  supabase: SupabaseClient,
  userId: string,
  mode: AvaAutoWelcomeMode,
): Promise<void> {
  const col = avaAutoWelcomeColumn(mode)
  await supabase.from('users').update({ [col]: new Date().toISOString() }).eq('id', userId)
}

/** Returned when the client retries auto-welcome but DB already recorded completion */
export const AVA_DUPLICATE_AUTO_WELCOME_REPLY =
  "We already kicked this off when you first landed here — scroll up if you see my earlier note. If not, ask anything below and we'll pick up from there."
