import type { SupabaseClient } from '@supabase/supabase-js'
import type { DqCoachReview } from '@/lib/dq-coach'

export async function getDqCoachCache(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ snapshotHash: string; review: DqCoachReview } | null> {
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
  return { snapshotHash: data.snapshot_hash, review: data.review as DqCoachReview }
}

export async function saveDqCoachCache(
  supabase: SupabaseClient,
  userId: string,
  snapshotHash: string,
  review: DqCoachReview,
): Promise<void> {
  const { error } = await supabase.from('dq_coach_reviews').upsert(
    {
      user_id: userId,
      snapshot_hash: snapshotHash,
      review,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
  if (error) {
    console.error('[DQ REVIEW] Cache write failed:', error.message)
  }
}
