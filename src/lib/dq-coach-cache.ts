import type { SupabaseClient } from '@supabase/supabase-js'
import type { DqCoachReview } from '@/lib/dq-coach'
import type { DqCoachBrief } from '@/lib/dq-coach-brief'

/**
 * The brief is saved inside the `review` jsonb, next to the review it was
 * written from. They are made by one call and go stale together, so a second
 * column would only be a second thing to keep in step.
 */
type CachedReview = DqCoachReview & { brief?: DqCoachBrief }

export async function getDqCoachCache(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ snapshotHash: string; review: DqCoachReview; brief: DqCoachBrief | null } | null> {
  const { data, error } = await supabase
    .from('dq_coach_reviews')
    .select('snapshot_hash, review')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('[DQ REVIEW] Cache read failed:', error.message)
    return null
  }
  if (!data?.snapshot_hash || !data.review || typeof data.review !== 'object') return null
  const { brief, ...review } = data.review as CachedReview
  return { snapshotHash: data.snapshot_hash, review, brief: brief ?? null }
}

export async function saveDqCoachCache(
  supabase: SupabaseClient,
  userId: string,
  snapshotHash: string,
  review: DqCoachReview,
  brief: DqCoachBrief,
): Promise<void> {
  const cached: CachedReview = { ...review, brief }
  const { error } = await supabase.from('dq_coach_reviews').upsert(
    {
      user_id: userId,
      snapshot_hash: snapshotHash,
      review: cached,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
  if (error) {
    console.error('[DQ REVIEW] Cache write failed:', error.message)
  }
}
