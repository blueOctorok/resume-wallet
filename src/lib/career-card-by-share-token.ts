/**
 * Load a public career card by share token without incrementing share_views_count.
 * Use for OG images, embeds, PDFs, and other crawlers — the public page + API GET still bump views.
 */
import { getAdminSupabaseClient } from '@/utils/supabase/admin'
import { buildProjectedCareerCard } from '@/lib/projected-career-card'
import type { ProjectedCareerCard } from '@/types/career-card'

const defaultShareSettings = { showContact: false, allowConnect: true }

export async function loadCareerCardByShareToken(
  shareToken: string,
): Promise<ProjectedCareerCard | null> {
  const trimmed = shareToken?.trim()
  if (!trimmed) return null

  const supabase = await getAdminSupabaseClient()
  const { data: user, error } = await supabase
    .from('users')
    .select('id, created_at, share_token, share_settings, share_views_count')
    .eq('share_token', trimmed)
    .maybeSingle()

  if (error || !user?.id) return null

  const raw = user.share_settings as { showContact?: boolean; allowConnect?: boolean } | null
  const settings = {
    showContact: Boolean(raw?.showContact),
    allowConnect: raw?.allowConnect !== false,
  }
  const viewCount = typeof user.share_views_count === 'number' ? user.share_views_count : 0

  return buildProjectedCareerCard(supabase, user.id, {
    memberSince: user.created_at ?? new Date().toISOString(),
    shareToken: user.share_token as string | null,
    shareSettings: settings,
    contactMode: 'public',
    viewCount,
  })
}
