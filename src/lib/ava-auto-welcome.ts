import type { SupabaseClient } from '@supabase/supabase-js'
import type { HubContext } from '@/lib/ava-context'

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

/**
 * Synthetic user message for the first Stormi open on the candidate hub.
 * Hub state lives in the system prompt (`hubContext`); this line just triggers a welcome turn.
 */
export function buildCandidateAutoWelcomeUserMessage(
  hubContext: HubContext,
  candidateEmptyHub: boolean,
): string {
  const complete =
    hubContext.installedBlocks?.filter((b) => b.status === 'complete').length ?? 0
  const total = hubContext.installedBlocks?.length ?? 0
  const views = hubContext.cardViewsThisWeek ?? 0

  if (candidateEmptyHub || total === 0) {
    return (
      'Auto-welcome: I just opened Stormi on my candidate hub and I have no blocks yet. ' +
      'Give one short welcoming paragraph and suggest either uploading a resume or browsing blocks — warm, specific, no bullet lists.'
    )
  }

  let absence = ''
  if (hubContext.daysSinceLastVisit === null) {
    absence = ' This is my first visit on this browser.'
  } else if (typeof hubContext.daysSinceLastVisit === 'number' && hubContext.daysSinceLastVisit >= 3) {
    absence = ` I have not opened the hub for about ${hubContext.daysSinceLastVisit} days.`
  }

  return (
    'Auto-welcome: I just opened Stormi on my candidate hub.' +
    absence +
    ` I have ${total} block(s) installed and about ${complete} look complete from your context.` +
    (views > 0 ? ` My career card had ${views} employer view(s) this week.` : '') +
    ' Reply with one short paragraph: welcome + the single best next step for my card. No bullet lists.'
  )
}
